import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext, requireFinanceRole } from '@/lib/auth/org-context'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)
    const { id } = await params

    const { data, error } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ rule: data })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)
    requireFinanceRole(ctx)
    const { id } = await params

    const body = await req.json()
    
    const { data, error } = await supabase
      .from('automation_rules')
      .update({
        name: body.name,
        description: body.description,
        trigger_events: body.trigger_events,
        conditions: body.conditions,
        actions: body.actions,
        is_active: body.is_active,
        stop_on_error: body.stop_on_error,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ rule: data })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)
    requireFinanceRole(ctx)
    const { id } = await params

    const { error } = await supabase
      .from('automation_rules')
      .delete()
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
