import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Data Enrichment API
 * 
 * Enriches member profiles from email using:
 * 1. Clearbit (if CLEARBIT_API_KEY set)
 * 2. PeopleDataLabs (if PDL_API_KEY set)
 * 3. Fallback: domain-based company lookup
 * 
 * POST /api/enrichment/profile
 * Body: { email: "jane@tesla.com" }
 * 
 * Returns: { full_name, company, job_title, location, linkedin_url, avatar_url }
 */

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { email, profile_id, auto_save } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Check cache first
    const { data: existing } = await supabase
      .from('profiles')
      .select('enrichment_data, enrichment_updated_at')
      .eq('email', email)
      .single()

    // If enriched within last 30 days, return cached data
    if (existing?.enrichment_data && existing?.enrichment_updated_at) {
      const lastUpdate = new Date(existing.enrichment_updated_at)
      const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)
      
      if (daysSinceUpdate < 30) {
        return NextResponse.json({
          source: 'cache',
          data: existing.enrichment_data,
        })
      }
    }

    // Try enrichment providers
    let enrichedData: EnrichmentResult | null = null

    // 1. Try Clearbit
    if (process.env.CLEARBIT_API_KEY) {
      enrichedData = await enrichWithClearbit(email)
    }

    // 2. Try PeopleDataLabs
    if (!enrichedData && process.env.PDL_API_KEY) {
      enrichedData = await enrichWithPDL(email)
    }

    // 3. Fallback: domain-based company lookup
    if (!enrichedData) {
      enrichedData = await enrichFromDomain(email)
    }

    if (!enrichedData) {
      return NextResponse.json({
        source: 'none',
        data: null,
        message: 'No enrichment data found',
      })
    }

    // Optionally save to profile
    if (auto_save !== false) {
      const updateId = profile_id || email

      if (profile_id) {
        await supabase
          .from('profiles')
          .update({
            full_name: enrichedData.full_name || undefined,
            company: enrichedData.company || undefined,
            job_title: enrichedData.job_title || undefined,
            linkedin_url: enrichedData.linkedin_url || undefined,
            avatar_url: enrichedData.avatar_url || undefined,
            enrichment_data: enrichedData,
            enrichment_updated_at: new Date().toISOString(),
          })
          .eq('id', profile_id)
      } else {
        await supabase
          .from('profiles')
          .update({
            full_name: enrichedData.full_name || undefined,
            company: enrichedData.company || undefined,
            job_title: enrichedData.job_title || undefined,
            linkedin_url: enrichedData.linkedin_url || undefined,
            avatar_url: enrichedData.avatar_url || undefined,
            enrichment_data: enrichedData,
            enrichment_updated_at: new Date().toISOString(),
          })
          .eq('email', email)
      }
    }

    return NextResponse.json({
      source: enrichedData.source,
      data: enrichedData,
    })

  } catch (error: any) {
    console.error('Enrichment error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

interface EnrichmentResult {
  source: string
  full_name?: string
  first_name?: string
  last_name?: string
  company?: string
  job_title?: string
  location?: string
  linkedin_url?: string
  twitter_url?: string
  avatar_url?: string
  industry?: string
  company_size?: string
  company_domain?: string
}

/**
 * Enrich using Clearbit Enrichment API
 */
async function enrichWithClearbit(email: string): Promise<EnrichmentResult | null> {
  try {
    const response = await fetch(
      `https://person-stream.clearbit.com/v2/combined/find?email=${encodeURIComponent(email)}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.CLEARBIT_API_KEY}`,
        },
      }
    )

    if (!response.ok) {
      console.log('Clearbit response:', response.status)
      return null
    }

    const data = await response.json()

    if (!data.person) return null

    return {
      source: 'clearbit',
      full_name: data.person.name?.fullName,
      first_name: data.person.name?.givenName,
      last_name: data.person.name?.familyName,
      company: data.company?.name,
      job_title: data.person.employment?.title,
      location: data.person.geo?.city 
        ? `${data.person.geo.city}, ${data.person.geo.state || data.person.geo.country}`
        : undefined,
      linkedin_url: data.person.linkedin?.handle 
        ? `https://linkedin.com/in/${data.person.linkedin.handle}`
        : undefined,
      twitter_url: data.person.twitter?.handle
        ? `https://twitter.com/${data.person.twitter.handle}`
        : undefined,
      avatar_url: data.person.avatar,
      industry: data.company?.category?.industry,
      company_size: data.company?.metrics?.employeesRange,
      company_domain: data.company?.domain,
    }
  } catch (error) {
    console.error('Clearbit error:', error)
    return null
  }
}

/**
 * Enrich using PeopleDataLabs API
 */
async function enrichWithPDL(email: string): Promise<EnrichmentResult | null> {
  try {
    const response = await fetch(
      `https://api.peopledatalabs.com/v5/person/enrich?email=${encodeURIComponent(email)}`,
      {
        headers: {
          'X-Api-Key': process.env.PDL_API_KEY!,
        },
      }
    )

    if (!response.ok) {
      console.log('PDL response:', response.status)
      return null
    }

    const { data } = await response.json()

    if (!data) return null

    return {
      source: 'peopledatalabs',
      full_name: data.full_name,
      first_name: data.first_name,
      last_name: data.last_name,
      company: data.job_company_name,
      job_title: data.job_title,
      location: data.location_name,
      linkedin_url: data.linkedin_url,
      twitter_url: data.twitter_url,
      avatar_url: undefined, // PDL doesn't provide avatars
      industry: data.industry,
      company_size: data.job_company_size,
      company_domain: data.job_company_website,
    }
  } catch (error) {
    console.error('PDL error:', error)
    return null
  }
}

/**
 * Fallback: Extract company from email domain
 */
async function enrichFromDomain(email: string): Promise<EnrichmentResult | null> {
  const domain = email.split('@')[1]
  
  if (!domain) return null

  // Skip common email providers
  const commonProviders = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
    'aol.com', 'icloud.com', 'protonmail.com', 'mail.com'
  ]
  
  if (commonProviders.includes(domain.toLowerCase())) {
    return null
  }

  // Extract company name from domain
  const domainParts = domain.split('.')
  const companyName = domainParts[0]
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')

  return {
    source: 'domain',
    company: companyName,
    company_domain: domain,
  }
}

/**
 * Batch enrich multiple profiles
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const limit = parseInt(url.searchParams.get('limit') || '10')

  // Get profiles that haven't been enriched
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, company')
    .is('enrichment_data', null)
    .not('email', 'is', null)
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    profiles_to_enrich: profiles?.length || 0,
    profiles,
  })
}
