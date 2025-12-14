import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext, requireFinanceRole } from '@/lib/auth/org-context'
import { applyRulesToTransactions } from '@/lib/bookkeeping/bank-rules'

export async function POST(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)
    requireFinanceRole(ctx)

    const body = await req.json()
    const { transaction_ids } = body

    if (!transaction_ids?.length) {
      return NextResponse.json({ error: 'transaction_ids required' }, { status: 400 })
    }

    const results = await applyRulesToTransactions(
      supabase,
      ctx.organizationId,
      transaction_ids
    )

    return NextResponse.json(results)
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
