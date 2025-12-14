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

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (body.status) updates.status = body.status
    if (body.amount_cents) updates.amount_cents = body.amount_cents
    if (body.scheduled_date) updates.scheduled_date = body.scheduled_date
    if (body.description !== undefined) updates.description = body.description
    
    // Mark as paid
    if (body.status === 'paid') {
      updates.paid_at = new Date().toISOString()
      updates.payment_reference = body.payment_reference
    }

    const { data, error } = await supabase
      .from('grant_disbursements')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ disbursement: data })
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
      .from('grant_disbursements')
      .delete()
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .eq('status', 'scheduled') // Can only delete scheduled ones

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
