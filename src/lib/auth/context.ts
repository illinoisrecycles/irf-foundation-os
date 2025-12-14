import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

type RequestContext = {
  supabase: any
  userId: string
  organizationId: string
  isAdmin: boolean
}

/**
 * Secure request context - validates auth and org membership
 * Replaces service-role usage in user-facing APIs
 */
export async function requireContext(req: Request): Promise<RequestContext> {
  const cookieStore = await cookies()

  // Create authenticated Supabase client (uses RLS)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw new AuthError('Unauthorized', 401)
  }

  // Get user's organization memberships
  const { data: memberships, error: membershipError } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)

  if (membershipError || !memberships?.length) {
    throw new AuthError('No organization membership', 403)
  }

  // Get org hint from query params (optional, validated against memberships)
  const { searchParams } = new URL(req.url)
  const orgIdHint = searchParams.get('organization_id')

  // Resolve organization
  let organizationId: string
  let isAdmin = false

  if (orgIdHint) {
    // Validate hint against actual memberships
    const membership = memberships.find(m => m.organization_id === orgIdHint)
    if (!membership) {
      throw new AuthError('Not a member of this organization', 403)
    }
    organizationId = orgIdHint
    isAdmin = membership.role === 'admin' || membership.role === 'owner'
  } else {
    // Get user's active organization or first membership
    const { data: profile } = await supabase
      .from('profiles')
      .select('active_organization_id')
      .eq('id', user.id)
      .single()

    if (profile?.active_organization_id) {
      const membership = memberships.find(m => m.organization_id === profile.active_organization_id)
      if (membership) {
        organizationId = profile.active_organization_id
        isAdmin = membership.role === 'admin' || membership.role === 'owner'
      } else {
        // Fallback to first membership
        organizationId = memberships[0].organization_id
        isAdmin = memberships[0].role === 'admin' || memberships[0].role === 'owner'
      }
    } else {
      // Fallback to first membership
      organizationId = memberships[0].organization_id
      isAdmin = memberships[0].role === 'admin' || memberships[0].role === 'owner'
    }
  }

  return {
    supabase,
    userId: user.id,
    organizationId,
    isAdmin,
  }
}

/**
 * For public/anonymous endpoints (directory, published events, etc.)
 */
export async function getPublicClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

/**
 * Require admin role for sensitive operations
 */
export async function requireAdmin(req: Request): Promise<RequestContext> {
  const ctx = await requireContext(req)
  
  if (!ctx.isAdmin) {
    throw new AuthError('Admin access required', 403)
  }
  
  return ctx
}

/**
 * Custom error class for auth failures
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
 * Helper to handle auth errors in API routes
 */
export function handleAuthError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  console.error('Unexpected error:', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
