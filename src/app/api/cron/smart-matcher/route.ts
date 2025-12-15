import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Ask/Offer Smart Matcher
 * 
 * Nightly cron that:
 * 1. Finds members who have asks that match others' offers
 * 2. Creates match suggestions
 * 3. Optionally sends introduction emails
 * 
 * Cron: 0 2 * * * (2 AM daily)
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = {
      organizations_processed: 0,
      matches_created: 0,
      intros_sent: 0,
    }

    // Get all organizations
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name')

    for (const org of orgs || []) {
      const orgResults = await processOrganization(org.id)
      results.matches_created += orgResults.matches
      results.intros_sent += orgResults.intros
      results.organizations_processed++
    }

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    })

  } catch (error: any) {
    console.error('Smart matcher error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function processOrganization(orgId: string): Promise<{ matches: number; intros: number }> {
  let matches = 0
  let intros = 0

  // Get all profiles with matching enabled and asks/offers populated
  const { data: profiles } = await supabase
    .from('profiles')
    .select(`
      id,
      full_name,
      email,
      company,
      job_title,
      asks,
      offers,
      matching_enabled
    `)
    .eq('matching_enabled', true)
    .not('asks', 'is', null)

  const { data: offerers } = await supabase
    .from('profiles')
    .select(`
      id,
      full_name,
      email,
      company,
      job_title,
      offers
    `)
    .eq('matching_enabled', true)
    .not('offers', 'is', null)

  if (!profiles || !offerers) return { matches: 0, intros: 0 }

  // Find matches
  for (const asker of profiles) {
    if (!asker.asks || asker.asks.length === 0) continue

    for (const ask of asker.asks) {
      // Find offerers who might match this ask
      for (const offerer of offerers) {
        if (offerer.id === asker.id) continue // Don't match with self
        if (!offerer.offers || offerer.offers.length === 0) continue

        // Check for matching offers
        const matchingOffer = findMatchingOffer(ask, offerer.offers)
        if (!matchingOffer) continue

        // Check if this match already exists
        const { data: existingMatch } = await supabase
          .from('member_matches')
          .select('id')
          .eq('organization_id', orgId)
          .eq('asker_profile_id', asker.id)
          .eq('offerer_profile_id', offerer.id)
          .eq('asker_need', ask)
          .single()

        if (existingMatch) continue

        // Calculate match score based on keyword similarity
        const matchScore = calculateMatchScore(ask, matchingOffer)

        // Create match suggestion
        const { data: match, error } = await supabase
          .from('member_matches')
          .insert({
            organization_id: orgId,
            asker_profile_id: asker.id,
            offerer_profile_id: offerer.id,
            match_type: 'ask_offer',
            asker_need: ask,
            offerer_capability: matchingOffer,
            match_score: matchScore,
            status: 'suggested',
          })
          .select()
          .single()

        if (!error && match) {
          matches++

          // Auto-send introduction if high confidence match (>0.7)
          if (matchScore > 0.7) {
            const introSent = await sendIntroduction(
              asker,
              offerer,
              ask,
              matchingOffer,
              orgId
            )
            if (introSent) {
              await supabase
                .from('member_matches')
                .update({
                  status: 'sent',
                  intro_sent_at: new Date().toISOString(),
                })
                .eq('id', match.id)
              intros++
            }
          }
        }
      }
    }
  }

  return { matches, intros }
}

/**
 * Find a matching offer for an ask using keyword matching
 */
function findMatchingOffer(ask: string, offers: string[]): string | null {
  const askKeywords = extractKeywords(ask.toLowerCase())
  
  for (const offer of offers) {
    const offerKeywords = extractKeywords(offer.toLowerCase())
    
    // Check for keyword overlap
    const overlap = askKeywords.filter(k => 
      offerKeywords.some(ok => ok.includes(k) || k.includes(ok))
    )
    
    if (overlap.length > 0) {
      return offer
    }
  }
  
  // Check for semantic categories
  const categories: Record<string, string[]> = {
    legal: ['legal', 'law', 'attorney', 'lawyer', 'counsel', 'contract'],
    finance: ['finance', 'financial', 'accounting', 'investment', 'funding', 'capital'],
    marketing: ['marketing', 'branding', 'social media', 'pr', 'communications', 'advertising'],
    tech: ['technology', 'tech', 'software', 'development', 'coding', 'programming', 'engineering'],
    hr: ['hr', 'human resources', 'recruiting', 'hiring', 'talent'],
    strategy: ['strategy', 'consulting', 'advisory', 'business development'],
    mentorship: ['mentor', 'mentorship', 'coaching', 'guidance', 'advice'],
  }
  
  for (const [category, keywords] of Object.entries(categories)) {
    const askInCategory = keywords.some(k => ask.toLowerCase().includes(k))
    if (askInCategory) {
      const matchingOffer = offers.find(o => 
        keywords.some(k => o.toLowerCase().includes(k))
      )
      if (matchingOffer) return matchingOffer
    }
  }
  
  return null
}

/**
 * Extract keywords from a string
 */
function extractKeywords(text: string): string[] {
  const stopWords = ['a', 'an', 'the', 'in', 'on', 'at', 'for', 'to', 'of', 'and', 'or', 'with', 'help', 'need', 'looking', 'seeking']
  return text
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.includes(w))
}

/**
 * Calculate match score based on keyword overlap
 */
function calculateMatchScore(ask: string, offer: string): number {
  const askWords = new Set(extractKeywords(ask.toLowerCase()))
  const offerWords = new Set(extractKeywords(offer.toLowerCase()))
  
  let matches = 0
  for (const word of askWords) {
    for (const offerWord of offerWords) {
      if (word === offerWord || word.includes(offerWord) || offerWord.includes(word)) {
        matches++
      }
    }
  }
  
  const maxPossible = Math.max(askWords.size, offerWords.size)
  if (maxPossible === 0) return 0.3
  
  return Math.min(1, 0.3 + (matches / maxPossible) * 0.7)
}

/**
 * Send introduction email to both parties
 */
async function sendIntroduction(
  asker: any,
  offerer: any,
  ask: string,
  offer: string,
  orgId: string
): Promise<boolean> {
  try {
    // Get org details for email branding
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single()

    // Queue introduction email
    await supabase.from('email_outbox').insert({
      organization_id: orgId,
      to_email: offerer.email,
      subject: `${org?.name || 'Network'} Introduction: ${asker.full_name} is looking for ${ask}`,
      template: 'member_introduction',
      template_data: {
        org_name: org?.name,
        asker_name: asker.full_name,
        asker_email: asker.email,
        asker_title: asker.job_title,
        asker_company: asker.company,
        asker_need: ask,
        offerer_name: offerer.full_name,
        offerer_capability: offer,
      },
      status: 'pending',
    })

    // Also notify the asker
    await supabase.from('email_outbox').insert({
      organization_id: orgId,
      to_email: asker.email,
      subject: `We found a connection for you: ${offerer.full_name}`,
      template: 'match_notification',
      template_data: {
        org_name: org?.name,
        asker_name: asker.full_name,
        asker_need: ask,
        offerer_name: offerer.full_name,
        offerer_email: offerer.email,
        offerer_title: offerer.job_title,
        offerer_company: offerer.company,
        offerer_capability: offer,
      },
      status: 'pending',
    })

    return true
  } catch (err) {
    console.error('Failed to send introduction:', err)
    return false
  }
}
