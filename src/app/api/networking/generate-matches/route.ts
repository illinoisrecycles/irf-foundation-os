import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Network Match Generator
 * 
 * Finds members whose "asks" match other members' "offers" and vice versa.
 * Uses fuzzy text matching and optional AI for semantic similarity.
 */

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { orgId } = await req.json().catch(() => ({}))

    // Get all members who have opted into matching
    const { data: members, error } = await supabase
      .from('profiles')
      .select('id, full_name, asks, offers, matching_enabled')
      .eq('matching_enabled', true)
      .not('asks', 'is', null)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!members || members.length < 2) {
      return NextResponse.json({ 
        message: 'Not enough members opted into matching',
        matches_created: 0 
      })
    }

    const newMatches: any[] = []

    // For each member's asks, find members who offer that capability
    for (const asker of members) {
      const asks = asker.asks || []
      
      for (const ask of asks) {
        // Find potential matches
        for (const offerer of members) {
          if (offerer.id === asker.id) continue // Don't match with self
          
          const offers = offerer.offers || []
          
          // Check for matching offers
          for (const offer of offers) {
            const score = calculateMatchScore(ask, offer)
            
            if (score >= 0.5) { // 50% threshold
              newMatches.push({
                organization_id: orgId || null,
                asker_profile_id: asker.id,
                offerer_profile_id: offerer.id,
                match_type: 'ask_offer',
                asker_need: ask,
                offerer_capability: offer,
                match_score: score,
                status: 'suggested',
              })
            }
          }
        }
      }
    }

    // Deduplicate and insert
    const uniqueMatches = deduplicateMatches(newMatches)
    
    if (uniqueMatches.length > 0) {
      // Upsert to avoid duplicates
      const { error: insertError } = await supabase
        .from('member_matches')
        .upsert(uniqueMatches, {
          onConflict: 'organization_id,asker_profile_id,offerer_profile_id,asker_need',
          ignoreDuplicates: true,
        })

      if (insertError) {
        console.error('Insert error:', insertError)
      }
    }

    return NextResponse.json({
      success: true,
      matches_found: newMatches.length,
      matches_created: uniqueMatches.length,
    })

  } catch (error: any) {
    console.error('Match generation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Calculate match score between an ask and an offer
 * Uses keyword matching and Jaccard similarity
 */
function calculateMatchScore(ask: string, offer: string): number {
  const askLower = ask.toLowerCase()
  const offerLower = offer.toLowerCase()

  // Exact match
  if (askLower === offerLower) return 1.0

  // Contains match
  if (askLower.includes(offerLower) || offerLower.includes(askLower)) {
    return 0.9
  }

  // Keyword overlap (Jaccard similarity)
  const askWords = new Set(askLower.split(/\s+/).filter(w => w.length > 2))
  const offerWords = new Set(offerLower.split(/\s+/).filter(w => w.length > 2))
  
  const intersection = new Set([...askWords].filter(w => offerWords.has(w)))
  const union = new Set([...askWords, ...offerWords])
  
  if (union.size === 0) return 0
  
  const jaccardScore = intersection.size / union.size

  // Synonym/related term matching
  const synonymGroups = [
    ['legal', 'lawyer', 'attorney', 'law'],
    ['finance', 'financial', 'accounting', 'money', 'investment'],
    ['marketing', 'sales', 'advertising', 'promotion'],
    ['tech', 'technology', 'software', 'programming', 'development', 'coding'],
    ['mentor', 'mentorship', 'coaching', 'guidance', 'advice'],
    ['hr', 'hiring', 'recruiting', 'talent', 'people'],
    ['design', 'creative', 'branding', 'graphics'],
    ['strategy', 'strategic', 'planning', 'business'],
  ]

  let synonymBonus = 0
  for (const group of synonymGroups) {
    const askHas = group.some(term => askLower.includes(term))
    const offerHas = group.some(term => offerLower.includes(term))
    if (askHas && offerHas) {
      synonymBonus = 0.3
      break
    }
  }

  return Math.min(1, jaccardScore + synonymBonus)
}

/**
 * Remove duplicate matches (same pair, same need)
 */
function deduplicateMatches(matches: any[]): any[] {
  const seen = new Set<string>()
  return matches.filter(m => {
    const key = `${m.asker_profile_id}-${m.offerer_profile_id}-${m.asker_need}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const status = url.searchParams.get('status')

  let query = supabase
    .from('member_matches')
    .select(`
      *,
      asker_profile:profiles!asker_profile_id(id, full_name, email, company, job_title, avatar_url),
      offerer_profile:profiles!offerer_profile_id(id, full_name, email, company, job_title, avatar_url)
    `)
    .order('match_score', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query.limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ matches: data || [] })
}
