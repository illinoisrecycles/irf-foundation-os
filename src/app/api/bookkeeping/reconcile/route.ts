import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext, requireFinanceRole } from '@/lib/auth/org-context'
import { journalFromBankTransaction } from '@/lib/bookkeeping/ledger'
import { createLearnedRule } from '@/lib/bookkeeping/ai-categorizer'

/**
 * Post a categorized bank transaction to the ledger
 */
export async function POST(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)
    requireFinanceRole(ctx)

    const body = await req.json()
    const bankTransactionId = body.bank_transaction_id || body.bankTransactionId
    const expenseAccountCode = body.expense_account_code
    const functionalExpense = body.functional_expense
    const memo = body.memo || 'Posted from bank feed'
    const createRule = body.create_rule === true

    if (!bankTransactionId) {
      return NextResponse.json({ error: 'bank_transaction_id required' }, { status: 400 })
    }

    // Get transaction
    const { data: tx, error: txErr } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .eq('id', bankTransactionId)
      .single()

    if (txErr || !tx) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Get settings
    const { data: settings } = await supabase
      .from('org_bookkeeping_settings')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .maybeSingle()

    const cashCode = settings?.default_cash_account_code || '1000'
    const incomeCode = settings?.default_income_account_code || '4000'
    const defaultExpenseCode = settings?.default_expense_account_code || '6000'
    const expenseCode = expenseAccountCode || defaultExpenseCode

    // Get account IDs
    const { data: accounts } = await supabase
      .from('ledger_accounts')
      .select('id, code')
      .eq('organization_id', ctx.organizationId)
      .in('code', [cashCode, incomeCode, expenseCode])

    const byCode = new Map((accounts || []).map(a => [a.code, a.id]))
    const cashId = byCode.get(cashCode)
    const expenseId = byCode.get(expenseCode)

    if (!cashId || !expenseId) {
      return NextResponse.json({ 
        error: 'Missing required accounts. Initialize chart of accounts first.' 
      }, { status: 400 })
    }

    // Create and post journal entry
    const entryId = await journalFromBankTransaction(supabase, {
      orgId: ctx.organizationId,
      bankTransactionId: tx.id,
      expenseAccountId: expenseId,
      cashAccountId: cashId,
      memo,
      functionalExpense: functionalExpense || null,
      postedByProfileId: ctx.userId,
    })

    // Mark AI suggestion as accepted
    await supabase
      .from('ai_suggestions')
      .update({ accepted: true, accepted_at: new Date().toISOString() })
      .eq('organization_id', ctx.organizationId)
      .eq('entity_type', 'bank_transaction')
      .eq('entity_id', tx.id)

    // Optionally create learned rule
    if (createRule && tx.merchant_name) {
      await createLearnedRule(supabase, ctx.organizationId, tx.merchant_name, expenseId, memo)
    }

    // Audit log
    await supabase.from('activity_log').insert({
      organization_id: ctx.organizationId,
      actor_profile_id: ctx.userId,
      action: 'created',
      entity_type: 'journal_entry',
      entity_id: entryId,
      entity_name: memo,
      details: { 
        bank_transaction_id: tx.id, 
        amount_cents: tx.amount_cents,
        expense_account_code: expenseCode,
      },
    })

    return NextResponse.json({ journal_entry_id: entryId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
