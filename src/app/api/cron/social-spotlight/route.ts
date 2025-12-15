import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

/**
 * Social Autopilot - Member Spotlight Generator
 * 
 * Monthly cron job that:
 * 1. Selects a member who hasn't been spotlighted recently
 * 2. Generates AI-drafted social posts (LinkedIn, Twitter)
 * 3. Queues for admin review
 * 
 * Cron: 0 9 1 * * (9 AM on the 1st of each month)
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get all organizations
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name, description')

    let spotlightsCreated = 0

    for (const org of orgs || []) {
      // Find a member to spotlight (hasn't been spotlighted in 6 months)
      const member = await selectMemberForSpotlight(org.id)
      
      if (!member) continue

      // Generate spotlight content
      const content = await generateSpotlightContent(org, member)

      // Queue for review
      await supabase.from('social_queue').insert([
        {
          organization_id: org.id,
          content_type: 'member_spotlight',
          platform: 'linkedin',
          headline: content.linkedinHeadline,
          body: content.linkedinBody,
          hashtags: content.hashtags,
          ai_generated: true,
          source_type: 'member',
          source_id: member.id,
          status: 'draft',
        },
        {
          organization_id: org.id,
          content_type: 'member_spotlight',
          platform: 'twitter',
          body: content.twitterBody,
          hashtags: content.hashtags.slice(0, 3),
          ai_generated: true,
          source_type: 'member',
          source_id: member.id,
          status: 'draft',
        },
      ])

      spotlightsCreated++
    }

    return NextResponse.json({
      success: true,
      spotlights_created: spotlightsCreated,
      timestamp: new Date().toISOString(),
    })

  } catch (error: any) {
    console.error('Social autopilot error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function selectMemberForSpotlight(orgId: string) {
  // Get IDs of recently spotlighted members
  const { data: recentSpotlights } = await supabase
    .from('social_queue')
    .select('source_id')
    .eq('organization_id', orgId)
    .eq('content_type', 'member_spotlight')
    .gte('created_at', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()) // 6 months

  const excludeIds = recentSpotlights?.map(s => s.source_id).filter(Boolean) || []

  // Find an active member with good engagement
  const { data: members } = await supabase
    .from('member_organizations')
    .select(`
      id,
      organization_name,
      primary_contact_email,
      membership_type_id,
      joined_at,
      profile:profiles!primary_contact_email(
        id, full_name, company, job_title, bio, avatar_url
      )
    `)
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .not('id', 'in', `(${excludeIds.join(',')})`)
    .order('joined_at', { ascending: true }) // Prioritize long-standing members
    .limit(10)

  if (!members || members.length === 0) return null

  // Pick one with the most complete profile
  const scored = members.map((m: any) => {
    let score = 0
    if (m.profile?.full_name) score += 2
    if (m.profile?.company) score += 2
    if (m.profile?.job_title) score += 2
    if (m.profile?.bio) score += 3
    if (m.profile?.avatar_url) score += 1
    return { ...m, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored[0]
}

async function generateSpotlightContent(org: any, member: any) {
  const profile = member.profile || {}
  
  const prompt = `Generate a member spotlight social media post for a nonprofit/professional association.

Organization: ${org.name}
${org.description ? `About: ${org.description}` : ''}

Member to spotlight:
- Name: ${profile.full_name || 'A valued member'}
- Company: ${profile.company || 'Not specified'}
- Title: ${profile.job_title || 'Not specified'}
- Member since: ${member.joined_at ? new Date(member.joined_at).getFullYear() : 'Recently'}
- Bio: ${profile.bio || 'Not provided'}

Generate:
1. A LinkedIn post (150-200 words) that celebrates this member, highlights their contribution to the industry/community, and tags the organization
2. A Twitter/X post (under 280 characters) that's engaging and celebratory
3. 5 relevant hashtags

Respond in JSON format:
{
  "linkedinHeadline": "Short attention-grabbing headline",
  "linkedinBody": "Full LinkedIn post body",
  "twitterBody": "Twitter post text",
  "hashtags": ["hashtag1", "hashtag2", ...]
}

Be professional, warm, and celebratory. Don't make up facts about the member. If bio is missing, focus on their membership tenure and role.`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 500,
      temperature: 0.7,
    })

    return JSON.parse(completion.choices[0].message.content || '{}')
  } catch (error) {
    console.error('AI generation failed:', error)
    return {
      linkedinHeadline: `🌟 Member Spotlight`,
      linkedinBody: `We're proud to highlight one of our valued members! Thank you for being part of ${org.name}. Your contribution to our community makes a difference every day. #MemberSpotlight`,
      twitterBody: `🌟 Shoutout to our amazing members! Thank you for being part of ${org.name}! #MemberSpotlight`,
      hashtags: ['MemberSpotlight', 'Community', 'ThankYou'],
    }
  }
}
