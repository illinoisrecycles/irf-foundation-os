import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext, requireFinanceRole } from '@/lib/auth/org-context'

export async function GET(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)

    const { searchParams } = new URL(req.url)
    const accountId = searchParams.get('account_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)

    let query = supabase
      .from('ledger_entries')
      .select(`
        *,
        account:gl_accounts(id, code, name, account_type),
        journal_entry:journal_entries(id, entry_date, memo, status)
      `)
      .eq('organization_id', ctx.organizationId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (accountId) query = query.eq('account_id', accountId)
    if (startDate) query = query.gte('created_at', startDate)
    if (endDate) query = query.lte('created_at', endDate)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ entries: data || [] })
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
      .from('ledger_entries')
      .insert({
        organization_id: ctx.organizationId,
        journal_entry_id: body.journal_entry_id,
        account_id: body.account_id,
        debit_cents: body.debit_cents || 0,
        credit_cents: body.credit_cents || 0,
        memo: body.memo,
        class_id: body.class_id,
        project_id: body.project_id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ entry: data })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
