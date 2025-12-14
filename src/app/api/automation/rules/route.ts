import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext, requireFinanceRole } from '@/lib/auth/org-context'

export async function GET(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)

    const { searchParams } = new URL(req.url)
    const isActive = searchParams.get('is_active')

    let query = supabase
      .from('automation_rules')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .order('created_at', { ascending: false })

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ rules: data || [] })
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
      .from('automation_rules')
      .insert({
        organization_id: ctx.organizationId,
        name: body.name,
        description: body.description,
        trigger_events: body.trigger_events || [],
        conditions: body.conditions || {},
        actions: body.actions || [],
        is_active: body.is_active ?? true,
        stop_on_error: body.stop_on_error ?? true,
        created_by_profile_id: ctx.userId,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ rule: data })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
