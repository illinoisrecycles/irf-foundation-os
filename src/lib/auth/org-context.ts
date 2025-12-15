import { SupabaseClient, User } from '@supabase/supabase-js'
import { Database } from '@/types/database'

/**
 * Organization Context Resolver
 * 
 * This module provides secure organization context resolution for all user-facing routes.
 * It NEVER trusts organization IDs from query params or request bodies.
 * 
 * Security model:
 * 1. User must be authenticated
 * 2. Organization membership is validated via organization_members table
 * 3. Optional x-org-id header for multi-org users (validated against membership)
 * 4. Role-based access control for sensitive operations
 */

export type OrgContext = {
  organizationId: string
  organizationName?: string
  userId: string
  user?: User
  role: 'owner' | 'admin' | 'staff' | 'member' | 'viewer' | string
  permissions: string[]
  allOrganizations: { id: string; name: string; role: string }[]
}

export interface OrgContextOptions {
  requireAdmin?: boolean
  requireOwner?: boolean
  requiredPermissions?: string[]
}

/**
 * Custom auth error class
 */
export class AuthError extends Error {
  status: number
  
  constructor(message: string, status: number = 401) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
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
    throw new AuthError('Unauthorized', 401)
  }

  // Get all organization memberships
  const { data: memberships, error: mErr } = await supabase
    .from('organization_members')
    .select(`
      organization_id,
      role,
      permissions,
      organization:organizations(id, name, slug)
    `)
    .eq('profile_id', user.id)
    .eq('is_active', true)

  if (mErr || !memberships || memberships.length === 0) {
    throw new AuthError('No organization membership found', 403)
  }

  // Determine which organization to use
  let selectedMembership = memberships[0]

  const headerOrgId = request.headers.get('x-org-id')
  if (headerOrgId) {
    // Validate membership
    const requested = memberships.find(
      (m: any) => m.organization_id === headerOrgId
    )
    if (requested) {
      selectedMembership = requested
    } else {
      throw new AuthError('Not authorized for requested organization', 403)
    }
  }

  const org = selectedMembership.organization as any

  return {
    organizationId: selectedMembership.organization_id,
    organizationName: org?.name,
    userId: user.id,
    user,
    role: selectedMembership.role,
    permissions: (selectedMembership.permissions as string[]) || [],
    allOrganizations: memberships.map((m: any) => ({
      id: m.organization_id,
      name: m.organization?.name,
      role: m.role,
    })),
  }
}

/**
 * Require org context or throw appropriate error
 */
export async function requireOrgContext(
  supabase: SupabaseClient<Database>,
  request: Request,
  options: OrgContextOptions = {}
): Promise<OrgContext> {
  const ctx = await getOrgContext(supabase, request)

  // Check role requirements
  if (options.requireOwner && ctx.role !== 'owner') {
    throw new AuthError('Owner access required', 403)
  }

  if (options.requireAdmin && !['owner', 'admin'].includes(ctx.role)) {
    throw new AuthError('Admin access required', 403)
  }

  // Check permission requirements
  if (options.requiredPermissions?.length) {
    const hasAllPermissions = options.requiredPermissions.every(
      p => ctx.permissions.includes(p) || ['owner', 'admin'].includes(ctx.role)
    )
    if (!hasAllPermissions) {
      throw new AuthError('Insufficient permissions', 403)
    }
  }

  return ctx
}

/**
 * Check if user has finance role
 */
export function hasFinanceRole(ctx: OrgContext): boolean {
  const financeRoles = ['owner', 'admin', 'staff', 'finance']
  const financePermissions = ['finance', 'finance.read', 'finance.write']
  
  return financeRoles.includes(ctx.role) || 
    ctx.permissions.some(p => financePermissions.includes(p))
}

/**
 * Require finance role or throw 403
 */
export function requireFinanceRole(ctx: OrgContext): void {
  if (!hasFinanceRole(ctx)) {
    throw new AuthError('Finance access required', 403)
  }
}

/**
 * Check if user has grants role
 */
export function hasGrantsRole(ctx: OrgContext): boolean {
  const grantsRoles = ['owner', 'admin', 'staff', 'grants_officer']
  const grantsPermissions = ['grants', 'grants.read', 'grants.write', 'grants.review']
  
  return grantsRoles.includes(ctx.role) || 
    ctx.permissions.some(p => grantsPermissions.includes(p))
}

/**
 * Require grants role or throw 403
 */
export function requireGrantsRole(ctx: OrgContext): void {
  if (!hasGrantsRole(ctx)) {
    throw new AuthError('Grants access required', 403)
  }
}

/**
 * Utility to handle auth errors in API routes
 */
export function handleAuthError(error: unknown) {
  if (error instanceof AuthError) {
    return { error: error.message, status: error.status }
  }
  console.error('Unexpected error:', error)
  return { error: 'Internal server error', status: 500 }
}

/**
 * Log audit event
 */
export async function logAudit(
  supabase: SupabaseClient<Database>,
  params: {
    organization_id: string
    actor_profile_id: string
    action: string
    entity_type: string
    entity_id?: string
    metadata?: Record<string, any>
    ip_address?: string
  }
) {
  try {
    await supabase.from('audit_logs').insert({
      organization_id: params.organization_id,
      actor_profile_id: params.actor_profile_id,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      changes: params.metadata,
      ip_address: params.ip_address,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to log audit event:', error)
  }
}
