import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext } from '@/lib/auth/org-context'

export async function GET(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)

    const { searchParams } = new URL(req.url)
    const applicationId = searchParams.get('application_id')
    const reviewerId = searchParams.get('reviewer_id')

    let query = supabase
      .from('grant_reviewer_assignments')
      .select(`
        *,
        application:grant_applications(id, title, status),
        reviewer:profiles(id, email, first_name, last_name)
      `)
      .eq('organization_id', ctx.organizationId)
      .order('created_at', { ascending: false })

    if (applicationId) query = query.eq('application_id', applicationId)
    if (reviewerId) query = query.eq('reviewer_profile_id', reviewerId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ assignments: data || [] })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)

    const body = await req.json()
    const { application_id, reviewer_profile_id, role } = body

    if (!application_id || !reviewer_profile_id) {
      return NextResponse.json({ error: 'application_id and reviewer_profile_id required' }, { status: 400 })
    }

    // Verify application belongs to org
    const { data: app } = await supabase
      .from('grant_applications')
      .select('id')
      .eq('id', application_id)
      .eq('organization_id', ctx.organizationId)
      .single()

    if (!app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('grant_reviewer_assignments')
      .insert({
        organization_id: ctx.organizationId,
        application_id,
        reviewer_profile_id,
        role: role || 'reviewer',
        status: 'assigned',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ assignment: data })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
