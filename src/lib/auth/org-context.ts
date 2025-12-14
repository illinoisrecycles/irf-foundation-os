import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

export type OrgContext = {
  organizationId: string
  userId: string
  role: string
}

/**
 * Secure org context resolver.
 * 
 * NEVER trusts orgId from query params blindly.
 * Always validates against user's actual membership.
 * 
 * Resolution order:
 * 1. x-org-id header (validated against membership)
 * 2. First active membership fallback
 */
export async function getOrgContext(
  supabase: SupabaseClient<Database>,
  request: Request
): Promise<OrgContext> {
  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  const headerOrgId = request.headers.get('x-org-id')

  if (headerOrgId) {
    // Validate membership - RLS ensures this only succeeds if user is actually a member
    const { data, error } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('organization_id', headerOrgId)
      .eq('profile_id', user.id)
      .single()

    if (error || !data) {
      throw new Error('Not authorized for requested organization')
    }

    return {
      organizationId: data.organization_id,
      userId: user.id,
      role: data.role,
    }
  }

  // Fallback: get first membership
  const { data: memberships, error: mErr } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('profile_id', user.id)
    .limit(1)
    .single()

  if (mErr || !memberships) {
    throw new Error('No organization membership found')
  }

  return {
    organizationId: memberships.organization_id,
    userId: user.id,
    role: memberships.role,
  }
}

/**
 * Require org context or throw 401
 */
export async function requireOrgContext(
  supabase: SupabaseClient<Database>,
  request: Request
): Promise<OrgContext> {
  return getOrgContext(supabase, request)
}

/**
 * Check if user has finance role
 */
export function hasFinanceRole(ctx: OrgContext): boolean {
  return ['owner', 'admin', 'staff', 'finance'].includes(ctx.role)
}

/**
 * Require finance role or throw 403
 */
export function requireFinanceRole(ctx: OrgContext): void {
  if (!hasFinanceRole(ctx)) {
    throw new Error('Forbidden: Finance role required')
  }
}
