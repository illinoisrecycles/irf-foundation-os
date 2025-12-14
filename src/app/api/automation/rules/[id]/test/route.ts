import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext, requireFinanceRole } from '@/lib/auth/org-context'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)
    requireFinanceRole(ctx)
    const { id } = await params

    const body = await req.json()
    const testPayload = body.payload || {}

    const { data: rule, error: ruleErr } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .single()

    if (ruleErr || !rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    const { data: queueItem, error: queueErr } = await supabase
      .from('automation_queue')
      .insert({
        organization_id: ctx.organizationId,
        rule_id: id,
        event_type: rule.trigger_events?.[0] || 'test.manual',
        event_payload: {
          ...testPayload,
          _test: true,
          _triggered_by: ctx.userId,
        },
        scheduled_for: new Date().toISOString(),
        status: 'pending',
      })
      .select('id')
      .single()

    if (queueErr) {
      return NextResponse.json({ error: queueErr.message }, { status: 500 })
    }

    return NextResponse.json({ 
      ok: true, 
      queue_item_id: queueItem.id,
    })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
