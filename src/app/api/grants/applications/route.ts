import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgContext } from '@/lib/auth/org-context'
import { triggerEvent } from '@/lib/automation/run'

// GET: List applications (authed)
export async function GET(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)

    const { searchParams } = new URL(req.url)
    const programId = searchParams.get('program_id')
    const status = searchParams.get('status')

    let query = supabase
      .from('grant_applications')
      .select(`
        *,
        program:grant_programs(id, name),
        assignments:grant_reviewer_assignments(
          id, reviewer_profile_id, status, score,
          reviewer:profiles(id, email, first_name, last_name)
        )
      `)
      .eq('organization_id', ctx.organizationId)
      .order('created_at', { ascending: false })

    if (programId) query = query.eq('program_id', programId)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ applications: data || [] })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Submit application (public - uses admin client)
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { program_id, form_data, applicant_name, applicant_email } = body

    if (!program_id || !form_data) {
      return NextResponse.json({ error: 'program_id and form_data required' }, { status: 400 })
    }

    // Use admin client for public submissions
    const supabase = createAdminClient()

    // Get program to get org ID
    const { data: program, error: pErr } = await supabase
      .from('grant_programs')
      .select('organization_id, status')
      .eq('id', program_id)
      .single()

    if (pErr || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    if (program.status !== 'open') {
      return NextResponse.json({ error: 'Program is not accepting applications' }, { status: 400 })
    }

    // Create application
    const { data, error } = await supabase
      .from('grant_applications')
      .insert({
        organization_id: program.organization_id,
        program_id,
        title: form_data.project_title || form_data.title || 'Grant Application',
        applicant_name,
        applicant_email,
        form_data,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Trigger automation event
    await triggerEvent(
      supabase,
      program.organization_id,
      'grant.application_submitted',
      {
        application_id: data.id,
        program_id,
        applicant_name,
        applicant_email,
      }
    ).catch(console.error)

    return NextResponse.json({ application: data })
  } catch (err: any) {
    console.error('Grant application error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
