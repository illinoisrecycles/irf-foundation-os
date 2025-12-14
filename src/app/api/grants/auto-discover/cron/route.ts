import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { searchGrantsGov, buildSearchKeywords } from '@/lib/grants/grantsGov'
import OpenAI from 'openai'

// Use service role for cron jobs
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for Vercel Pro

/**
 * Daily cron job to discover and match federal grants
 * Schedule: 0 6 * * * (6 AM daily)
 */
export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('Starting automated grant discovery...')

  const stats = {
    orgs_processed: 0,
    opportunities_found: 0,
    high_matches: 0,
    errors: [] as string[],
  }

  try {
    // Get all organizations with focus areas
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name, description, focus_areas, mission_statement, service_area, grant_preferences')
      .not('focus_areas', 'is', null)

    if (orgsError) {
      throw new Error(`Failed to fetch orgs: ${orgsError.message}`)
    }

    for (const org of orgs || []) {
      try {
        stats.orgs_processed++

        // Build search query from org profile
        const keywords = buildSearchKeywords({
          focus_areas: org.focus_areas,
          mission_statement: org.mission_statement,
        })

        if (!keywords) {
          continue
        }

        // Search Grants.gov
        const results = await searchGrantsGov({
          keyword: keywords,
          oppStatuses: ['posted', 'forecasted'],
          rows: 30,
        })

        console.log(`Found ${results.opportunities.length} opportunities for ${org.name}`)

        for (const opp of results.opportunities) {
          try {
            // Skip if deadline passed
            if (new Date(opp.closeDate) < new Date()) {
              continue
            }

            // Check if already processed
            const { data: existing } = await supabase
              .from('external_grant_opportunities')
              .select('id')
              .eq('external_id', opp.opportunityID)
              .eq('organization_id', org.id)
              .single()

            if (existing) {
              continue // Already processed
            }

            // AI match scoring
            const matchScore = await calculateMatchScore(org, opp)
            
            if (matchScore < 0.5) {
              continue // Skip low matches
            }

            stats.opportunities_found++

            const status = matchScore >= 0.85 
              ? 'high_priority' 
              : matchScore >= 0.7 
                ? 'recommended' 
                : 'discovered'

            if (status === 'high_priority') {
              stats.high_matches++
            }

            // Save opportunity
            await supabase.from('external_grant_opportunities').insert({
              external_id: opp.opportunityID,
              organization_id: org.id,
              source_type: 'federal',
              title: opp.title,
              synopsis: opp.synopsis,
              agency: opp.agency,
              deadline: opp.closeDate,
              estimated_funding: opp.estimatedFunding || null,
              min_award: opp.awardFloor || null,
              max_award: opp.awardCeiling || null,
              match_score: matchScore,
              status,
              application_url: `https://www.grants.gov/search-results-detail/${opp.opportunityID}`,
              eligibility_notes: opp.eligibility,
              raw_data: opp,
            })

            // If high priority, generate initial draft
            if (status === 'high_priority') {
              await generateInitialDraft(org, opp)
            }

          } catch (oppError: any) {
            stats.errors.push(`Opp ${opp.opportunityID}: ${oppError.message}`)
          }
        }

        // Rate limiting - wait between orgs
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (orgError: any) {
        stats.errors.push(`Org ${org.id}: ${orgError.message}`)
      }
    }

    // Log results
    console.log('Grant discovery completed:', stats)

    // Send notification if high matches found
    if (stats.high_matches > 0) {
      await sendDiscoveryNotifications(stats.high_matches)
    }

    return NextResponse.json({
      success: true,
      ...stats,
    })

  } catch (error: any) {
    console.error('Grant discovery failed:', error)
    return NextResponse.json(
      { success: false, error: error.message, stats },
      { status: 500 }
    )
  }
}

async function calculateMatchScore(
  org: any,
  opp: any
): Promise<number> {
  try {
    const prompt = `Rate alignment 0.0-1.0 for this nonprofit applying to this federal grant.

**Organization:**
- Name: ${org.name}
- Mission: ${org.mission_statement || org.description || 'Not provided'}
- Focus Areas: ${org.focus_areas?.join(', ') || 'General nonprofit'}
- Service Area: ${org.service_area || 'National'}

**Grant Opportunity:**
- Title: ${opp.title}
- Agency: ${opp.agency}
- Synopsis: ${opp.synopsis?.slice(0, 500) || 'No synopsis'}
- Eligibility: ${opp.eligibility || 'Not specified'}
- Funding: $${opp.estimatedFunding?.toLocaleString() || 'Varies'}
- Deadline: ${opp.closeDate}

Consider:
1. Mission alignment (40%)
2. Eligibility fit (30%)
3. Capacity to execute (20%)
4. Geographic match (10%)

Output ONLY a decimal number between 0.0 and 1.0.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 10,
      temperature: 0,
    })

    const scoreText = completion.choices[0].message.content?.trim() || '0'
    const score = parseFloat(scoreText)
    
    return isNaN(score) ? 0 : Math.min(Math.max(score, 0), 1)

  } catch (error) {
    console.error('Match scoring failed:', error)
    return 0.5 // Default to medium match on error
  }
}

async function generateInitialDraft(org: any, opp: any): Promise<void> {
  try {
    const prompt = `Generate a brief application outline for this grant opportunity.

**Organization:** ${org.name}
**Mission:** ${org.mission_statement || org.description}
**Grant:** ${opp.title} from ${opp.agency}
**Synopsis:** ${opp.synopsis?.slice(0, 800)}

Create a 200-word outline covering:
1. Project Summary (2-3 sentences)
2. Key Objectives (3 bullets)
3. Why We're Qualified (2-3 bullets)
4. Estimated Budget Use

Be specific and actionable.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
    })

    const draft = completion.choices[0].message.content

    await supabase
      .from('external_grant_opportunities')
      .update({ application_draft: { outline: draft, generated_at: new Date().toISOString() } })
      .eq('external_id', opp.opportunityID)
      .eq('organization_id', org.id)

  } catch (error) {
    console.error('Draft generation failed:', error)
  }
}

async function sendDiscoveryNotifications(highMatchCount: number): Promise<void> {
  // In production, send push notifications or emails
  console.log(`Notification: ${highMatchCount} high-priority grants discovered`)
  
  // Could integrate with your push notification system:
  // await sendPushNotification({
  //   title: 'New Grant Opportunities',
  //   body: `${highMatchCount} high-priority grants match your profile!`,
  //   url: '/portal/grants/opportunities'
  // })
}
