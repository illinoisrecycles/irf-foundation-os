import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext, requireFinanceRole } from '@/lib/auth/org-context'

export async function GET(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    let query = supabase
      .from('grant_programs')
      .select(`
        *,
        applications:grant_applications(count)
      `)
      .eq('organization_id', ctx.organizationId)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ programs: data || [] })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)
    requireFinanceRole(ctx)

    const body = await req.json()

    const { data, error } = await supabase
      .from('grant_programs')
      .insert({
        organization_id: ctx.organizationId,
        name: body.name,
        description: body.description,
        status: body.status || 'draft',
        deadline: body.deadline,
        budget_cents: body.budget_cents,
        max_amount_cents: body.max_amount_cents,
        form_fields: body.form_fields || [],
        rubric: body.rubric || [],
        settings: body.settings || {},
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ program: data })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
