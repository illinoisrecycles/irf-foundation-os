/**
 * Frontend API Wrapper
 * 
 * All API calls should go through this wrapper to ensure:
 * 1. x-org-id header is always sent
 * 2. Authentication is handled
 * 3. Consistent error handling
 */

type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: any
  headers?: Record<string, string>
}

let activeOrgId: string | null = null

/**
 * Set the active organization ID
 * Called by org switcher when user changes orgs
 */
export function setActiveOrg(orgId: string) {
  activeOrgId = orgId
  // Also persist to localStorage for page refreshes
  if (typeof window !== 'undefined') {
    localStorage.setItem('active_org_id', orgId)
  }
}

/**
 * Get the active organization ID
 */
export function getActiveOrg(): string | null {
  if (activeOrgId) return activeOrgId
  if (typeof window !== 'undefined') {
    return localStorage.getItem('active_org_id')
  }
  return null
}

/**
 * Clear the active organization
 */
export function clearActiveOrg() {
  activeOrgId = null
  if (typeof window !== 'undefined') {
    localStorage.removeItem('active_org_id')
  }
}

/**
 * Make an authenticated API request with org context
 */
export async function apiFetch<T = any>(
  path: string,
  options: ApiOptions = {}
): Promise<{ data: T | null; error: string | null; status: number }> {
  const { method = 'GET', body, headers = {} } = options

  // Build headers
  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  }

  // Add org context if available
  const orgId = getActiveOrg()
  if (orgId) {
    finalHeaders['x-org-id'] = orgId
  }

  try {
    const response = await fetch(path, {
      method,
      headers: finalHeaders,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include', // Include cookies for auth
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      return {
        data: null,
        error: data?.error || `Request failed with status ${response.status}`,
        status: response.status,
      }
    }

    return { data, error: null, status: response.status }

  } catch (error: any) {
    return {
      data: null,
      error: error.message || 'Network error',
      status: 0,
    }
  }
}

// Convenience methods
export const api = {
  get: <T = any>(path: string, headers?: Record<string, string>) =>
    apiFetch<T>(path, { method: 'GET', headers }),

  post: <T = any>(path: string, body?: any, headers?: Record<string, string>) =>
    apiFetch<T>(path, { method: 'POST', body, headers }),

  put: <T = any>(path: string, body?: any, headers?: Record<string, string>) =>
    apiFetch<T>(path, { method: 'PUT', body, headers }),

  patch: <T = any>(path: string, body?: any, headers?: Record<string, string>) =>
    apiFetch<T>(path, { method: 'PATCH', body, headers }),

  delete: <T = any>(path: string, headers?: Record<string, string>) =>
    apiFetch<T>(path, { method: 'DELETE', headers }),
}

/**
 * Hook for React components to get org context
 */
export function useOrgContext() {
  // This would be enhanced with React context in a full implementation
  return {
    orgId: getActiveOrg(),
    setOrg: setActiveOrg,
    clearOrg: clearActiveOrg,
  }
}

// Type-safe API endpoints
export const endpoints = {
  // Members
  members: {
    list: () => '/api/members',
    get: (id: string) => `/api/members/${id}`,
    healthScores: () => '/api/analytics/health-scores',
  },

  // Donations
  donations: {
    list: () => '/api/donations',
    create: () => '/api/donations',
    taxReceipts: () => '/api/donations/tax-receipts',
  },

  // Events
  events: {
    list: () => '/api/events',
    get: (id: string) => `/api/events/${id}`,
    registrations: () => '/api/events/registrations',
  },

  // Grants
  grants: {
    programs: () => '/api/grants/programs',
    applications: () => '/api/grants/applications',
    disbursements: () => '/api/grants/disbursements',
  },

  // Automation
  automation: {
    rules: () => '/api/automation/rules',
    recipes: () => '/api/automation/recipes',
  },

  // Analytics
  analytics: {
    churn: () => '/api/analytics/churn',
    grantSuccess: () => '/api/analytics/grant-success',
    healthScores: () => '/api/analytics/health-scores',
  },

  // Insights
  insights: {
    generate: () => '/api/insights/generate',
  },

  // Social
  social: {
    queue: () => '/api/social/queue',
    spotlight: () => '/api/cron/social-spotlight',
  },

  // Networking
  networking: {
    matches: () => '/api/networking/generate-matches',
  },

  // Board
  board: {
    meetings: () => '/api/board/meetings',
    fundraising: () => '/api/board/fundraising',
  },
}
