import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext, requireFinanceRole } from '@/lib/auth/org-context'
import { suggestCategorization, matchCategorizationRule } from '@/lib/bookkeeping/ai-categorizer'

export async function POST(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)
    requireFinanceRole(ctx)

    const body = await req.json()
    const bankTransactionId = body.bank_transaction_id || body.bankTransactionId

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

    const defaultCash = settings?.default_cash_account_code || '1000'

    // Get accounts
    const { data: accounts } = await supabase
      .from('ledger_accounts')
      .select('id, code, name, type')
      .eq('organization_id', ctx.organizationId)
      .eq('is_active', true)

    // Step 1: Try deterministic rules first
    const ruleMatch = await matchCategorizationRule(supabase, ctx.organizationId, tx)

    if (ruleMatch) {
      const account = accounts?.find(a => a.id === ruleMatch.accountId)
      const suggestion = {
        vendor_name: tx.merchant_name,
        memo: ruleMatch.memo || tx.name || '',
        expense_account_code: account?.code || null,
        functional_expense: null,
        confidence: 1.0,
        should_autopost: true,
        rationale: 'Matched categorization rule',
        proposed_entry: {
          debit_account_code: account?.code || '',
          credit_account_code: defaultCash,
          amount_cents: Math.abs(tx.amount_cents),
        },
      }

      // Store for audit
      await supabase.from('ai_suggestions').upsert({
        organization_id: ctx.organizationId,
        entity_type: 'bank_transaction',
        entity_id: tx.id,
        provider: 'rule',
        model: 'deterministic',
        confidence: 1.0,
        suggestion,
        created_by_profile_id: ctx.userId,
      }, { onConflict: 'organization_id,entity_type,entity_id' })

      return NextResponse.json({ suggestion, source: 'rule' })
    }

    // Step 2: AI categorization
    const aiSuggestion = await suggestCategorization({
      orgId: ctx.organizationId,
      currency: tx.iso_currency_code || 'USD',
      amountCents: tx.amount_cents,
      date: tx.date,
      description: tx.name || tx.description || '',
      merchantName: tx.merchant_name,
      accounts: (accounts || []).map(a => ({ id: a.id, code: a.code, name: a.name, type: a.type })),
      defaultCashAccountCode: defaultCash,
      orgType: 'nonprofit',
    })

    // Store AI suggestion
    await supabase.from('ai_suggestions').upsert({
      organization_id: ctx.organizationId,
      entity_type: 'bank_transaction',
      entity_id: tx.id,
      provider: 'openai',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      confidence: aiSuggestion.confidence,
      suggestion: aiSuggestion,
      rationale: aiSuggestion.rationale,
      created_by_profile_id: ctx.userId,
    }, { onConflict: 'organization_id,entity_type,entity_id' })

    // Update transaction with AI suggestion
    const account = accounts?.find(a => a.code === aiSuggestion.expense_account_code)
    if (account) {
      await supabase
        .from('bank_transactions')
        .update({
          ai_account_id: account.id,
          ai_confidence: aiSuggestion.confidence,
          ai_memo: aiSuggestion.memo,
          ai_reasoning: aiSuggestion.rationale,
          ai_categorized_at: new Date().toISOString(),
          ai_status: aiSuggestion.confidence >= 0.9 ? 'categorized' : 'needs_review',
          updated_at: new Date().toISOString(),
        })
        .eq('id', tx.id)
    }

    return NextResponse.json({ suggestion: aiSuggestion, source: 'ai' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
