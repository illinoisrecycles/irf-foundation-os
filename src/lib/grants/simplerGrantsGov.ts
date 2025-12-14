/**
 * Simpler.Grants.gov API Integration
 * 
 * Modern replacement for legacy Grants.gov search API.
 * No API key required for basic search (rate-limited anonymously).
 * Optional API key for higher limits (60/min, 10k/day).
 * 
 * Docs: https://api.simpler.grants.gov/docs
 */

const BASE_URL = 'https://api.simpler.grants.gov'

export interface SimplerGrantsSearchParams {
  query?: string
  filters?: {
    opportunity_status?: { one_of: string[] }
    agency?: { one_of: string[] }
    applicant_type?: { one_of: string[] }
    funding_instrument?: { one_of: string[] }
    category?: { one_of: string[] }
  }
  pagination?: {
    page_offset: number
    page_size: number
  }
  sort?: {
    order_by: string
    sort_direction: 'ascending' | 'descending'
  }
}

export interface SimplerGrantsOpportunity {
  id: string
  opportunity_id: string
  opportunity_number: string
  title: string
  agency: string
  agency_code: string
  summary: string
  description?: string
  category: string
  category_explanation?: string
  applicant_types: string[]
  funding_instrument: string
  expected_number_of_awards?: number
  estimated_total_program_funding?: number
  award_floor?: number
  award_ceiling?: number
  post_date: string
  close_date: string
  close_date_description?: string
  archive_date?: string
  opportunity_status: string
  cost_sharing_or_matching_requirement: boolean
  link?: string
}

export interface SimplerGrantsResponse {
  data: SimplerGrantsOpportunity[]
  pagination: {
    page_offset: number
    page_size: number
    total_pages: number
    total_records: number
  }
  message?: string
  status_code?: number
}

/**
 * Search opportunities via Simpler.Grants.gov API
 */
export async function searchSimplerGrants(
  params: SimplerGrantsSearchParams = {}
): Promise<SimplerGrantsResponse> {
  const defaultParams: SimplerGrantsSearchParams = {
    pagination: { page_offset: 1, page_size: 25 },
    sort: { order_by: 'close_date', sort_direction: 'ascending' },
  }

  const body = {
    ...defaultParams,
    ...params,
    filters: {
      ...defaultParams.filters,
      ...params.filters,
    },
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  // Optional API key for higher rate limits
  if (process.env.SIMPLER_GRANTS_API_KEY) {
    headers['X-Api-Key'] = process.env.SIMPLER_GRANTS_API_KEY
  }

  try {
    const response = await fetch(`${BASE_URL}/v1/opportunities/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Simpler.Grants.gov API error: ${response.status} - ${error}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Simpler.Grants.gov search failed:', error)
    throw error
  }
}

/**
 * Fetch single opportunity by ID
 */
export async function fetchSimplerGrantOpportunity(
  opportunityId: string
): Promise<SimplerGrantsOpportunity | null> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  if (process.env.SIMPLER_GRANTS_API_KEY) {
    headers['X-Api-Key'] = process.env.SIMPLER_GRANTS_API_KEY
  }

  try {
    const response = await fetch(`${BASE_URL}/v1/opportunities/${opportunityId}`, {
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      throw new Error(`Simpler.Grants.gov API error: ${response.status}`)
    }

    const data = await response.json()
    return data.data
  } catch (error) {
    console.error('Simpler.Grants.gov fetch failed:', error)
    return null
  }
}

/**
 * Build search query from organization profile
 */
export function buildSimplerSearchQuery(org: {
  focus_areas?: string[]
  mission_statement?: string
  service_area?: string
}): SimplerGrantsSearchParams {
  const query = org.focus_areas?.join(' ') || ''
  
  return {
    query,
    filters: {
      opportunity_status: { one_of: ['posted', 'forecasted'] },
      applicant_type: { one_of: ['nonprofits', 'state_governments', 'county_governments', 'city_or_township_governments'] },
    },
    pagination: { page_offset: 1, page_size: 50 },
  }
}

/**
 * Map opportunity status codes
 */
export const OPPORTUNITY_STATUSES: Record<string, string> = {
  posted: 'Open',
  forecasted: 'Forecasted',
  closed: 'Closed',
  archived: 'Archived',
}

/**
 * Map agency codes to names
 */
export const AGENCY_CODES: Record<string, string> = {
  EPA: 'Environmental Protection Agency',
  DOE: 'Department of Energy',
  USDA: 'Department of Agriculture',
  HHS: 'Health and Human Services',
  ED: 'Department of Education',
  DOT: 'Department of Transportation',
  HUD: 'Housing and Urban Development',
  DOI: 'Department of Interior',
  DOL: 'Department of Labor',
  DOC: 'Department of Commerce',
}

/**
 * Check if deadline is urgent (within 14 days)
 */
export function isDeadlineUrgent(closeDate: string): boolean {
  const deadline = new Date(closeDate)
  const now = new Date()
  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return daysLeft > 0 && daysLeft <= 14
}

/**
 * Format funding amount for display
 */
export function formatFunding(opportunity: SimplerGrantsOpportunity): string {
  if (opportunity.estimated_total_program_funding) {
    return `$${opportunity.estimated_total_program_funding.toLocaleString()} total`
  }
  if (opportunity.award_floor && opportunity.award_ceiling) {
    return `$${opportunity.award_floor.toLocaleString()} - $${opportunity.award_ceiling.toLocaleString()}`
  }
  if (opportunity.award_ceiling) {
    return `Up to $${opportunity.award_ceiling.toLocaleString()}`
  }
  return 'Amount varies'
}
