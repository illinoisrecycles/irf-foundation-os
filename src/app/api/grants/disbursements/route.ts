import { NextResponse } from 'next/server'
import { requireContext, handleAuthError } from '@/lib/auth/context'
import { logAudit } from '@/lib/auth/audit'

// GET - List disbursements
export async function GET(req: Request) {
  try {
    const ctx = await requireContext(req)
    const { searchParams } = new URL(req.url)
    const applicationId = searchParams.get('application_id')
    const status = searchParams.get('status')

    let query = ctx.supabase
      .from('grant_disbursements')
      .select(`
        *,
        grant_applications(
          project_title,
          applicant_name,
          applicant_email,
          grant_programs(name)
        )
      `)
      .eq('organization_id', ctx.organizationId)
      .order('scheduled_date', { ascending: true })

    if (applicationId) query = query.eq('application_id', applicationId)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return handleAuthError(err)
  }
}

// POST - Create disbursement schedule
export async function POST(req: Request) {
  try {
    const ctx = await requireContext(req)
    const body = await req.json()

    const { data, error } = await ctx.supabase
      .from('grant_disbursements')
      .insert({
        ...body,
        organization_id: ctx.organizationId,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'create',
      entityType: 'grant_disbursement',
      entityId: data.id,
      changes: body,
    })

    return NextResponse.json(data)
  } catch (err) {
    return handleAuthError(err)
  }
}

// PATCH - Update disbursement (mark as paid, etc)
export async function PATCH(req: Request) {
  try {
    const ctx = await requireContext(req)
    const body = await req.json()
    const { id, ...updates } = body

    const { data, error } = await ctx.supabase
      .from('grant_disbursements')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'update',
      entityType: 'grant_disbursement',
      entityId: id,
      changes: updates,
    })

    return NextResponse.json(data)
  } catch (err) {
    return handleAuthError(err)
  }
}
