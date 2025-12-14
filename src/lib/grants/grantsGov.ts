/**
 * Grants.gov API Integration
 * 
 * Integrates with the official Grants.gov REST API for federal grant discovery.
 * No API key required for basic search/fetch.
 */

const GRANTS_GOV_BASE_URL = 'https://api.grants.gov/v1/api'

export interface GrantsGovSearchParams {
  keyword?: string
  oppStatuses?: ('forecasted' | 'posted' | 'closed' | 'archived')[]
  fundingCategories?: string[]
  agencies?: string[]
  eligibilities?: string[]
  sortBy?: string
  rows?: number
  startRecord?: number
}

export interface GrantsGovOpportunity {
  id: string
  opportunityID: string
  title: string
  agency: string
  agencyCode: string
  synopsis: string
  eligibility: string
  openDate: string
  closeDate: string
  estimatedFunding: number
  awardCeiling: number
  awardFloor: number
  expectedAwards: number
  costSharing: boolean
  category: string
  cfdaNumbers: string[]
  applicationUrl?: string
}

export interface GrantsGovSearchResponse {
  totalCount: number
  opportunities: GrantsGovOpportunity[]
}

/**
 * Search Grants.gov opportunities
 */
export async function searchGrantsGov(
  params: GrantsGovSearchParams
): Promise<GrantsGovSearchResponse> {
  const defaultParams = {
    oppStatuses: ['posted', 'forecasted'],
    rows: 50,
    startRecord: 0,
    sortBy: 'closeDate|asc',
  }

  const searchBody = {
    ...defaultParams,
    ...params,
  }

  try {
    const response = await fetch(`${GRANTS_GOV_BASE_URL}/search2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchBody),
    })

    if (!response.ok) {
      throw new Error(`Grants.gov API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    return {
      totalCount: data.totalCount || 0,
      opportunities: data.opportunities || [],
    }
  } catch (error) {
    console.error('Grants.gov search failed:', error)
    throw error
  }
}

/**
 * Fetch single opportunity details
 */
export async function fetchGrantOpportunity(
  opportunityId: string
): Promise<GrantsGovOpportunity | null> {
  try {
    const response = await fetch(`${GRANTS_GOV_BASE_URL}/fetchOpportunity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ opportunityID: opportunityId }),
    })

    if (!response.ok) {
      throw new Error(`Grants.gov API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Grants.gov fetch failed:', error)
    return null
  }
}

/**
 * Build search keywords from organization profile
 */
export function buildSearchKeywords(org: {
  focus_areas?: string[]
  name?: string
  mission_statement?: string
}): string {
  const keywords: string[] = []
  
  if (org.focus_areas?.length) {
    keywords.push(...org.focus_areas)
  }
  
  // Extract key terms from mission
  if (org.mission_statement) {
    const missionKeywords = org.mission_statement
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 4)
      .slice(0, 5)
    keywords.push(...missionKeywords)
  }
  
  return keywords.join(' OR ')
}

/**
 * Map Grants.gov category codes to human-readable names
 */
export const FUNDING_CATEGORIES: Record<string, string> = {
  'AG': 'Agriculture',
  'AR': 'Arts',
  'BC': 'Business and Commerce',
  'CD': 'Community Development',
  'CP': 'Consumer Protection',
  'DPR': 'Disaster Prevention and Relief',
  'ED': 'Education',
  'ELT': 'Employment, Labor and Training',
  'EN': 'Energy',
  'ENV': 'Environment',
  'FN': 'Food and Nutrition',
  'HL': 'Health',
  'HO': 'Housing',
  'HU': 'Humanities',
  'ISS': 'Information and Statistics',
  'IS': 'Income Security and Social Services',
  'LJL': 'Law, Justice and Legal Services',
  'NR': 'Natural Resources',
  'RA': 'Recovery Act',
  'RD': 'Regional Development',
  'ST': 'Science and Technology',
  'T': 'Transportation',
  'O': 'Other',
}

/**
 * Check if opportunity deadline is approaching
 */
export function isDeadlineApproaching(closeDate: string, daysThreshold = 14): boolean {
  const deadline = new Date(closeDate)
  const now = new Date()
  const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return diffDays > 0 && diffDays <= daysThreshold
}
