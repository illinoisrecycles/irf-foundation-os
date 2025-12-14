import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext, requireFinanceRole } from '@/lib/auth/org-context'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)
    requireFinanceRole(ctx)
    const { id } = await params

    const body = await req.json()

    const { data, error } = await supabase
      .from('bank_rules')
      .update({
        name: body.name,
        priority: body.priority,
        is_active: body.is_active,
        conditions: body.conditions,
        account_id: body.account_id,
        class_id: body.class_id,
        project_id: body.project_id,
        vendor_id: body.vendor_id,
        tags: body.tags,
        memo_template: body.memo_template,
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
      .from('bank_rules')
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
