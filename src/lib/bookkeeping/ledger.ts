import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

// ============================================================================
// DOUBLE-ENTRY LEDGER OPERATIONS
// All posting goes through DB function to enforce balance
// ============================================================================

export type JournalLineInput = {
  accountId: string
  debitCents?: number
  creditCents?: number
  memo?: string | null
  functionalExpense?: 'program' | 'management_general' | 'fundraising' | null
  vendorId?: string | null
  grantId?: string | null
}

export type CreateJournalEntryInput = {
  organizationId: string
  entryDate: string // YYYY-MM-DD
  description: string
  sourceType?: string | null
  sourceId?: string | null
  aiCategorized?: boolean
  aiConfidence?: number
}

/**
 * Create a draft journal entry
 */
export async function createJournalEntry(
  supabase: SupabaseClient<Database>,
  input: CreateJournalEntryInput
) {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('journal_entries')
    .insert({
      organization_id: input.organizationId,
      entry_date: input.entryDate,
      description: input.description,
      status: 'draft',
      source_type: input.sourceType ?? null,
      source_id: input.sourceId ?? null,
      ai_categorized: input.aiCategorized ?? false,
      ai_confidence: input.aiConfidence ?? null,
      created_by_profile_id: user?.id,
    })
    .select('*')
    .single()

  if (error) throw new Error(`Failed to create journal entry: ${error.message}`)
  return data
}

/**
 * Add lines to a journal entry
 */
export async function addJournalLines(
  supabase: SupabaseClient<Database>,
  params: { 
    entryId: string
    organizationId: string
    lines: JournalLineInput[] 
  }
) {
  const payload = params.lines.map((l) => ({
    organization_id: params.organizationId,
    journal_entry_id: params.entryId,
    account_id: l.accountId,
    debit_cents: l.debitCents ?? 0,
    credit_cents: l.creditCents ?? 0,
    memo: l.memo ?? null,
    functional_expense: l.functionalExpense ?? null,
    vendor_id: l.vendorId ?? null,
    grant_id: l.grantId ?? null,
  }))

  const { data, error } = await supabase
    .from('journal_lines')
    .insert(payload)
    .select('*')

  if (error) throw new Error(`Failed to add journal lines: ${error.message}`)
  return data
}

/**
 * Post journal entry using DB function
 * This enforces that debits = credits
 */
export async function postJournalEntry(
  supabase: SupabaseClient<Database>,
  params: { entryId: string; postedByProfileId: string }
) {
  const { error } = await supabase.rpc('post_journal_entry', {
    p_entry_id: params.entryId,
    p_posted_by: params.postedByProfileId,
  })

  if (error) throw new Error(`Failed to post journal entry: ${error.message}`)
  return true
}

/**
 * Void a journal entry (reverses all lines)
 */
export async function voidJournalEntry(
  supabase: SupabaseClient<Database>,
  params: { entryId: string; voidedByProfileId: string; reason: string }
) {
  const { data: { user } } = await supabase.auth.getUser()

  // Get original entry
  const { data: entry, error: fetchError } = await supabase
    .from('journal_entries')
    .select('*, journal_lines(*)')
    .eq('id', params.entryId)
    .single()

  if (fetchError || !entry) throw new Error('Journal entry not found')
  if (entry.status === 'void') throw new Error('Entry already voided')

  // Create reversing entry
  const { data: reversal, error: reversalError } = await supabase
    .from('journal_entries')
    .insert({
      organization_id: entry.organization_id,
      entry_date: new Date().toISOString().split('T')[0],
      description: `VOID: ${entry.description}`,
      status: 'draft',
      source_type: 'void_reversal',
      source_id: entry.id,
      created_by_profile_id: user?.id,
    })
    .select()
    .single()

  if (reversalError) throw new Error(`Failed to create reversal: ${reversalError.message}`)

  // Reverse all lines (swap debits/credits)
  const reversedLines = (entry.journal_lines || []).map((line: any) => ({
    organization_id: entry.organization_id,
    journal_entry_id: reversal.id,
    account_id: line.account_id,
    debit_cents: line.credit_cents, // Swap
    credit_cents: line.debit_cents, // Swap
    memo: `Reversal: ${line.memo || ''}`,
    functional_expense: line.functional_expense,
    vendor_id: line.vendor_id,
  }))

  await supabase.from('journal_lines').insert(reversedLines)

  // Post the reversal
  await postJournalEntry(supabase, { 
    entryId: reversal.id, 
    postedByProfileId: params.voidedByProfileId 
  })

  // Mark original as void
  await supabase
    .from('journal_entries')
    .update({
      status: 'void',
      voided_by_profile_id: params.voidedByProfileId,
      voided_at: new Date().toISOString(),
      void_reason: params.reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.entryId)

  return { reversalId: reversal.id }
}

/**
 * Get account balances for a date range
 */
export async function getAccountBalances(
  supabase: SupabaseClient<Database>,
  orgId: string,
  startDate?: string,
  endDate?: string
) {
  let query = supabase
    .from('journal_lines')
    .select(`
      account_id,
      debit_cents,
      credit_cents,
      journal_entry:journal_entries!inner(entry_date, status)
    `)
    .eq('organization_id', orgId)
    .eq('journal_entry.status', 'posted')

  if (startDate) {
    query = query.gte('journal_entry.entry_date', startDate)
  }
  if (endDate) {
    query = query.lte('journal_entry.entry_date', endDate)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  // Aggregate by account
  const balances: Record<string, { debits: number; credits: number }> = {}
  for (const line of data || []) {
    if (!balances[line.account_id]) {
      balances[line.account_id] = { debits: 0, credits: 0 }
    }
    balances[line.account_id].debits += line.debit_cents || 0
    balances[line.account_id].credits += line.credit_cents || 0
  }

  return balances
}

/**
 * Create journal entry from bank transaction
 */
export async function journalFromBankTransaction(
  supabase: SupabaseClient<Database>,
  params: {
    orgId: string
    bankTransactionId: string
    expenseAccountId: string
    cashAccountId: string
    memo: string
    functionalExpense?: 'program' | 'management_general' | 'fundraising' | null
    postedByProfileId: string
  }
) {
  // Get transaction
  const { data: tx, error: txErr } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('id', params.bankTransactionId)
    .eq('organization_id', params.orgId)
    .single()

  if (txErr || !tx) throw new Error('Bank transaction not found')
  if (tx.journal_entry_id) throw new Error('Transaction already has journal entry')

  const amount = Math.abs(tx.amount_cents)
  const isExpense = tx.amount_cents < 0

  // Create entry
  const entry = await createJournalEntry(supabase, {
    organizationId: params.orgId,
    entryDate: tx.date,
    description: tx.merchant_name || tx.name || params.memo,
    sourceType: 'bank_transaction',
    sourceId: tx.id,
    aiCategorized: !!tx.ai_account_id,
    aiConfidence: tx.ai_confidence,
  })

  // Add lines
  if (isExpense) {
    // Expense: Debit expense, Credit cash
    await addJournalLines(supabase, {
      entryId: entry.id,
      organizationId: params.orgId,
      lines: [
        {
          accountId: params.expenseAccountId,
          debitCents: amount,
          creditCents: 0,
          memo: params.memo,
          functionalExpense: params.functionalExpense,
        },
        {
          accountId: params.cashAccountId,
          debitCents: 0,
          creditCents: amount,
          memo: params.memo,
        },
      ],
    })
  } else {
    // Income: Debit cash, Credit revenue
    await addJournalLines(supabase, {
      entryId: entry.id,
      organizationId: params.orgId,
      lines: [
        {
          accountId: params.cashAccountId,
          debitCents: amount,
          creditCents: 0,
          memo: params.memo,
        },
        {
          accountId: params.expenseAccountId, // This would actually be income account
          debitCents: 0,
          creditCents: amount,
          memo: params.memo,
        },
      ],
    })
  }

  // Post entry (enforces balance via DB function)
  await postJournalEntry(supabase, {
    entryId: entry.id,
    postedByProfileId: params.postedByProfileId,
  })

  // Link transaction to entry
  await supabase
    .from('bank_transactions')
    .update({
      journal_entry_id: entry.id,
      ai_status: 'matched',
      matched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', tx.id)

  // Create match record
  await supabase.from('bank_transaction_matches').insert({
    organization_id: params.orgId,
    bank_transaction_id: tx.id,
    journal_entry_id: entry.id,
    match_type: tx.ai_account_id ? 'auto' : 'manual',
    match_confidence: tx.ai_confidence || 1.0,
    matched_by_profile_id: params.postedByProfileId,
  })

  return entry.id
}
