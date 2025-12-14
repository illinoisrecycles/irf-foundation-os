import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================================
// AUTO-JOURNALING ENGINE
// Automatically creates journal entries from transactions
// ============================================================================

/**
 * Create journal entry from categorized bank transaction
 */
export async function journalFromBankTransaction(
  organizationId: string,
  transactionId: string
): Promise<string> {
  const supabase = createAdminClient()

  // Get transaction with account info
  const { data: tx } = await supabase
    .from('bank_transactions')
    .select(`
      *,
      bank_account:bank_accounts(*, chart_account:chart_account_id(*)),
      expense_account:final_account_id(*)
    `)
    .eq('id', transactionId)
    .single()

  if (!tx) throw new Error('Transaction not found')
  if (!tx.final_account_id) throw new Error('Transaction not categorized')
  if (tx.journal_entry_id) throw new Error('Journal entry already exists')

  // Get next entry number
  const { data: lastEntry } = await supabase
    .from('journal_entries')
    .select('entry_number')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const entryNumber = `JE-${String(parseInt(lastEntry?.entry_number?.split('-')[1] || '0') + 1).padStart(6, '0')}`

  const isExpense = tx.amount_cents < 0
  const amountAbs = Math.abs(tx.amount_cents)

  // Create journal entry
  const { data: entry } = await supabase
    .from('journal_entries')
    .insert({
      organization_id: organizationId,
      entry_number: entryNumber,
      entry_date: tx.transaction_date,
      entry_type: 'standard',
      source: 'bank_import',
      source_type: 'bank_transaction',
      source_id: tx.id,
      memo: tx.ai_memo || tx.user_memo || tx.name,
      status: 'posted',
      ai_categorized: !!tx.ai_account_id,
      ai_confidence: tx.ai_confidence,
      posted_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  // Create debit and credit lines
  if (isExpense) {
    // Expense: Debit expense account, Credit bank account
    await supabase.from('journal_entry_lines').insert([
      {
        journal_entry_id: entry!.id,
        account_id: tx.final_account_id,
        amount_cents: amountAbs,
        line_type: 'debit',
        description: tx.merchant_name || tx.name,
        bank_transaction_id: tx.id,
      },
      {
        journal_entry_id: entry!.id,
        account_id: tx.bank_account.chart_account_id,
        amount_cents: amountAbs,
        line_type: 'credit',
        description: tx.merchant_name || tx.name,
        bank_transaction_id: tx.id,
        reconciled: true,
        reconciled_at: new Date().toISOString(),
      },
    ])
  } else {
    // Income: Debit bank account, Credit revenue account
    await supabase.from('journal_entry_lines').insert([
      {
        journal_entry_id: entry!.id,
        account_id: tx.bank_account.chart_account_id,
        amount_cents: amountAbs,
        line_type: 'debit',
        description: tx.merchant_name || tx.name,
        bank_transaction_id: tx.id,
        reconciled: true,
        reconciled_at: new Date().toISOString(),
      },
      {
        journal_entry_id: entry!.id,
        account_id: tx.final_account_id,
        amount_cents: amountAbs,
        line_type: 'credit',
        description: tx.merchant_name || tx.name,
        bank_transaction_id: tx.id,
      },
    ])
  }

  // Update transaction
  await supabase
    .from('bank_transactions')
    .update({
      journal_entry_id: entry!.id,
      status: 'matched',
      matched_at: new Date().toISOString(),
    })
    .eq('id', transactionId)

  // Update account balances
  await updateAccountBalances(organizationId, entry!.id)

  return entry!.id
}

/**
 * Create journal entry from donation
 */
export async function journalFromDonation(
  organizationId: string,
  donationId: string
): Promise<string> {
  const supabase = createAdminClient()

  const { data: donation } = await supabase
    .from('donations')
    .select('*')
    .eq('id', donationId)
    .single()

  if (!donation) throw new Error('Donation not found')

  // Get accounts
  const { data: accounts } = await supabase
    .from('chart_of_accounts')
    .select('id, account_subtype')
    .eq('organization_id', organizationId)
    .in('account_subtype', ['cash', 'donations_revenue', 'accounts_receivable'])

  const cashAccount = accounts?.find(a => a.account_subtype === 'cash')
  const donationRevenue = accounts?.find(a => a.account_subtype === 'donations_revenue')
  const arAccount = accounts?.find(a => a.account_subtype === 'accounts_receivable')

  if (!donationRevenue) throw new Error('Donation revenue account not configured')

  const entryNumber = `DON-${String(Date.now()).slice(-6)}`

  const { data: entry } = await supabase
    .from('journal_entries')
    .insert({
      organization_id: organizationId,
      entry_number: entryNumber,
      entry_date: donation.donated_at?.split('T')[0] || new Date().toISOString().split('T')[0],
      entry_type: 'standard',
      source: 'donation',
      source_type: 'donation',
      source_id: donationId,
      memo: `Donation from ${donation.donor_name || 'Anonymous'}`,
      status: 'posted',
      posted_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  // If paid, debit cash; if pledge, debit AR
  const debitAccount = donation.payment_status === 'succeeded' ? cashAccount : arAccount

  await supabase.from('journal_entry_lines').insert([
    {
      journal_entry_id: entry!.id,
      account_id: debitAccount?.id,
      amount_cents: donation.amount_cents,
      line_type: 'debit',
      description: `Donation - ${donation.donor_name || 'Anonymous'}`,
      member_organization_id: donation.member_organization_id,
    },
    {
      journal_entry_id: entry!.id,
      account_id: donationRevenue.id,
      amount_cents: donation.amount_cents,
      line_type: 'credit',
      description: `Donation - ${donation.donor_name || 'Anonymous'}`,
      member_organization_id: donation.member_organization_id,
    },
  ])

  await updateAccountBalances(organizationId, entry!.id)
  return entry!.id
}

/**
 * Create journal entry from membership payment
 */
export async function journalFromMembershipPayment(
  organizationId: string,
  paymentId: string
): Promise<string> {
  const supabase = createAdminClient()

  const { data: payment } = await supabase
    .from('payments')
    .select('*, member_organizations(*)')
    .eq('id', paymentId)
    .single()

  if (!payment) throw new Error('Payment not found')

  const { data: accounts } = await supabase
    .from('chart_of_accounts')
    .select('id, account_subtype')
    .eq('organization_id', organizationId)
    .in('account_subtype', ['cash', 'membership_revenue'])

  const cashAccount = accounts?.find(a => a.account_subtype === 'cash')
  const membershipRevenue = accounts?.find(a => a.account_subtype === 'membership_revenue')

  if (!cashAccount || !membershipRevenue) {
    throw new Error('Required accounts not configured')
  }

  const entryNumber = `MEM-${String(Date.now()).slice(-6)}`

  const { data: entry } = await supabase
    .from('journal_entries')
    .insert({
      organization_id: organizationId,
      entry_number: entryNumber,
      entry_date: payment.created_at.split('T')[0],
      entry_type: 'standard',
      source: 'payment',
      source_type: 'payment',
      source_id: paymentId,
      memo: `Membership payment - ${payment.member_organizations?.name || 'Member'}`,
      status: 'posted',
      posted_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  await supabase.from('journal_entry_lines').insert([
    {
      journal_entry_id: entry!.id,
      account_id: cashAccount.id,
      amount_cents: payment.amount_cents,
      line_type: 'debit',
      description: `Membership - ${payment.member_organizations?.name}`,
      member_organization_id: payment.member_organization_id,
    },
    {
      journal_entry_id: entry!.id,
      account_id: membershipRevenue.id,
      amount_cents: payment.amount_cents,
      line_type: 'credit',
      description: `Membership - ${payment.member_organizations?.name}`,
      member_organization_id: payment.member_organization_id,
    },
  ])

  await updateAccountBalances(organizationId, entry!.id)
  return entry!.id
}

/**
 * Create journal entry from bill payment
 */
export async function journalFromBillPayment(
  organizationId: string,
  paymentId: string
): Promise<string> {
  const supabase = createAdminClient()

  const { data: payment } = await supabase
    .from('bill_payments')
    .select(`
      *,
      allocations:bill_payment_allocations(*, bill:bills(*, vendor:vendors(*)))
    `)
    .eq('id', paymentId)
    .single()

  if (!payment) throw new Error('Payment not found')

  const { data: accounts } = await supabase
    .from('chart_of_accounts')
    .select('id, account_subtype')
    .eq('organization_id', organizationId)
    .in('account_subtype', ['cash', 'accounts_payable'])

  const cashAccount = accounts?.find(a => a.account_subtype === 'cash')
  const apAccount = accounts?.find(a => a.account_subtype === 'accounts_payable')

  if (!cashAccount || !apAccount) {
    throw new Error('Required accounts not configured')
  }

  const entryNumber = `PMT-${String(Date.now()).slice(-6)}`
  const vendorNames = payment.allocations
    ?.map((a: any) => a.bill?.vendor?.name)
    .filter(Boolean)
    .join(', ')

  const { data: entry } = await supabase
    .from('journal_entries')
    .insert({
      organization_id: organizationId,
      entry_number: entryNumber,
      entry_date: payment.payment_date,
      entry_type: 'standard',
      source: 'bill_payment',
      source_type: 'bill_payment',
      source_id: paymentId,
      memo: `Payment to ${vendorNames}`,
      status: 'posted',
      posted_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  // Debit AP, Credit Cash
  await supabase.from('journal_entry_lines').insert([
    {
      journal_entry_id: entry!.id,
      account_id: apAccount.id,
      amount_cents: payment.amount_cents,
      line_type: 'debit',
      description: `Payment - ${vendorNames}`,
    },
    {
      journal_entry_id: entry!.id,
      account_id: cashAccount.id,
      amount_cents: payment.amount_cents,
      line_type: 'credit',
      description: `Payment - ${vendorNames}`,
    },
  ])

  // Update payment
  await supabase
    .from('bill_payments')
    .update({ journal_entry_id: entry!.id })
    .eq('id', paymentId)

  await updateAccountBalances(organizationId, entry!.id)
  return entry!.id
}

/**
 * Update account balances after journal entry
 */
async function updateAccountBalances(
  organizationId: string,
  journalEntryId: string
): Promise<void> {
  const supabase = createAdminClient()

  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select('account_id, amount_cents, line_type')
    .eq('journal_entry_id', journalEntryId)

  for (const line of lines || []) {
    const { data: account } = await supabase
      .from('chart_of_accounts')
      .select('current_balance_cents, normal_balance, ytd_debits_cents, ytd_credits_cents')
      .eq('id', line.account_id)
      .single()

    if (!account) continue

    let newBalance = account.current_balance_cents
    let newDebits = account.ytd_debits_cents
    let newCredits = account.ytd_credits_cents

    if (line.line_type === 'debit') {
      newDebits += line.amount_cents
      newBalance = account.normal_balance === 'debit'
        ? newBalance + line.amount_cents
        : newBalance - line.amount_cents
    } else {
      newCredits += line.amount_cents
      newBalance = account.normal_balance === 'credit'
        ? newBalance + line.amount_cents
        : newBalance - line.amount_cents
    }

    await supabase
      .from('chart_of_accounts')
      .update({
        current_balance_cents: newBalance,
        ytd_debits_cents: newDebits,
        ytd_credits_cents: newCredits,
        updated_at: new Date().toISOString(),
      })
      .eq('id', line.account_id)
  }
}

/**
 * Auto-journal all pending categorized transactions
 */
export async function autoJournalPendingTransactions(
  organizationId: string
): Promise<{ journaled: number; errors: string[] }> {
  const supabase = createAdminClient()

  const { data: transactions } = await supabase
    .from('bank_transactions')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('status', 'categorized')
    .is('journal_entry_id', null)
    .limit(100)

  let journaled = 0
  const errors: string[] = []

  for (const tx of transactions || []) {
    try {
      await journalFromBankTransaction(organizationId, tx.id)
      journaled++
    } catch (err: any) {
      errors.push(`${tx.id}: ${err.message}`)
    }
  }

  return { journaled, errors }
}
