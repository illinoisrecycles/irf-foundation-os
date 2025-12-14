import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext, requireFinanceRole } from '@/lib/auth/org-context'

export async function GET(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)
    
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

    let query = supabase
      .from('bank_transactions')
      .select(`
        *,
        bank_account:bank_accounts(name, mask),
        ai_account:ai_account_id(code, name),
        final_account:final_account_id(code, name)
      `)
      .eq('organization_id', ctx.organizationId)
      .order('date', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('ai_status', status)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ transactions: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)
    requireFinanceRole(ctx)

    const body = await req.json()
    const { id, status, account_id, memo } = body

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const updates: any = { updated_at: new Date().toISOString() }
    if (status) updates.ai_status = status
    if (account_id) {
      updates.user_account_id = account_id
      updates.final_account_id = account_id
      updates.user_categorized_at = new Date().toISOString()
      updates.categorized_by_profile_id = ctx.userId
    }
    if (memo) updates.user_memo = memo

    const { data, error } = await supabase
      .from('bank_transactions')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Audit
    await supabase.from('activity_log').insert({
      organization_id: ctx.organizationId,
      actor_profile_id: ctx.userId,
      action: 'updated',
      entity_type: 'bank_transaction',
      entity_id: id,
      details: updates,
    })

    return NextResponse.json({ transaction: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
