import { createAdminClient } from '@/lib/supabase/admin'
import { categorizeTransaction } from './ai-categorizer'

// ============================================================================
// BANK SYNC (Plaid Integration)
// Auto-imports and categorizes transactions from connected banks
// ============================================================================

const PLAID_BASE_URL = process.env.PLAID_ENV === 'production'
  ? 'https://production.plaid.com'
  : 'https://sandbox.plaid.com'

/**
 * Create Plaid link token for connecting bank
 */
export async function createLinkToken(organizationId: string, userId: string): Promise<string> {
  const response = await fetch(`${PLAID_BASE_URL}/link/token/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      user: { client_user_id: userId },
      client_name: 'FoundationOS',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
    }),
  })

  const data = await response.json()
  return data.link_token
}

/**
 * Exchange public token for access token after user connects bank
 */
export async function exchangePublicToken(
  organizationId: string,
  publicToken: string
): Promise<{ connectionId: string; accounts: any[] }> {
  const supabase = createAdminClient()

  // Exchange token
  const exchangeResponse = await fetch(`${PLAID_BASE_URL}/item/public_token/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      public_token: publicToken,
    }),
  })
  const { access_token, item_id } = await exchangeResponse.json()

  // Get institution info
  const itemResponse = await fetch(`${PLAID_BASE_URL}/item/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      access_token,
    }),
  })
  const itemData = await itemResponse.json()

  // Get accounts
  const accountsResponse = await fetch(`${PLAID_BASE_URL}/accounts/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      access_token,
    }),
  })
  const accountsData = await accountsResponse.json()

  // Store connection
  const { data: connection } = await supabase
    .from('bank_connections')
    .insert({
      organization_id: organizationId,
      plaid_item_id: item_id,
      plaid_access_token: access_token, // In production, encrypt this!
      institution_id: itemData.item?.institution_id,
      institution_name: itemData.item?.institution_id, // Would fetch from /institutions/get_by_id
      status: 'active',
    })
    .select()
    .single()

  // Store accounts
  const accounts = []
  for (const account of accountsData.accounts || []) {
    const { data: bankAccount } = await supabase
      .from('bank_accounts')
      .insert({
        organization_id: organizationId,
        connection_id: connection.id,
        plaid_account_id: account.account_id,
        name: account.name,
        official_name: account.official_name,
        mask: account.mask,
        account_type: account.type,
        account_subtype: account.subtype,
        current_balance_cents: Math.round(account.balances.current * 100),
        available_balance_cents: Math.round((account.balances.available || 0) * 100),
        balance_updated_at: new Date().toISOString(),
      })
      .select()
      .single()
    
    accounts.push(bankAccount)
  }

  return { connectionId: connection.id, accounts }
}

/**
 * Sync transactions from all connected banks
 */
export async function syncAllBankTransactions(organizationId: string): Promise<{
  synced: number
  categorized: number
  errors: string[]
}> {
  const supabase = createAdminClient()

  const { data: connections } = await supabase
    .from('bank_connections')
    .select('*, bank_accounts(*)')
    .eq('organization_id', organizationId)
    .eq('status', 'active')

  let totalSynced = 0
  let totalCategorized = 0
  const errors: string[] = []

  for (const connection of connections || []) {
    try {
      const result = await syncConnectionTransactions(organizationId, connection)
      totalSynced += result.synced
      totalCategorized += result.categorized
    } catch (err: any) {
      errors.push(`${connection.institution_name}: ${err.message}`)
      
      // Update connection status
      await supabase
        .from('bank_connections')
        .update({ status: 'error', error_message: err.message })
        .eq('id', connection.id)
    }
  }

  return { synced: totalSynced, categorized: totalCategorized, errors }
}

/**
 * Sync transactions for a single bank connection
 */
async function syncConnectionTransactions(
  organizationId: string,
  connection: any
): Promise<{ synced: number; categorized: number }> {
  const supabase = createAdminClient()

  // Use cursor for incremental sync
  const cursor = connection.last_cursor

  const response = await fetch(`${PLAID_BASE_URL}/transactions/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      access_token: connection.plaid_access_token,
      cursor,
    }),
  })

  const data = await response.json()
  let synced = 0
  let categorized = 0

  // Process added transactions
  for (const tx of data.added || []) {
    const bankAccount = connection.bank_accounts?.find(
      (a: any) => a.plaid_account_id === tx.account_id
    )
    if (!bankAccount) continue

    // Check if already exists
    const { data: existing } = await supabase
      .from('bank_transactions')
      .select('id')
      .eq('plaid_transaction_id', tx.transaction_id)
      .single()

    if (existing) continue

    // Insert transaction
    const { data: newTx } = await supabase
      .from('bank_transactions')
      .insert({
        organization_id: organizationId,
        bank_account_id: bankAccount.id,
        plaid_transaction_id: tx.transaction_id,
        transaction_date: tx.date,
        posted_date: tx.authorized_date,
        amount_cents: Math.round(tx.amount * -100), // Plaid uses opposite sign convention
        name: tx.name,
        merchant_name: tx.merchant_name,
        original_description: tx.original_description,
        plaid_category: tx.category,
        plaid_category_id: tx.category_id,
        location: tx.location,
        payment_channel: tx.payment_channel,
        status: 'pending',
      })
      .select()
      .single()

    synced++

    // Auto-categorize if enabled
    if (bankAccount.auto_categorize && newTx) {
      try {
        const catResult = await categorizeTransaction(organizationId, {
          id: newTx.id,
          name: tx.name,
          merchant_name: tx.merchant_name,
          amount_cents: newTx.amount_cents,
          transaction_date: tx.date,
          plaid_category: tx.category,
        })

        if (catResult.confidence > 0.7) {
          await supabase
            .from('bank_transactions')
            .update({
              ai_account_id: catResult.accountId,
              ai_confidence: catResult.confidence,
              ai_memo: catResult.memo,
              ai_categorized_at: new Date().toISOString(),
              final_account_id: catResult.accountId,
              status: catResult.confidence > 0.85 ? 'categorized' : 'pending',
            })
            .eq('id', newTx.id)

          categorized++
        }
      } catch (err) {
        // Categorization failed, leave as pending
      }
    }
  }

  // Handle modified transactions
  for (const tx of data.modified || []) {
    await supabase
      .from('bank_transactions')
      .update({
        transaction_date: tx.date,
        amount_cents: Math.round(tx.amount * -100),
        name: tx.name,
        merchant_name: tx.merchant_name,
      })
      .eq('plaid_transaction_id', tx.transaction_id)
  }

  // Handle removed transactions
  for (const tx of data.removed || []) {
    await supabase
      .from('bank_transactions')
      .update({ status: 'excluded' })
      .eq('plaid_transaction_id', tx.transaction_id)
  }

  // Update cursor
  await supabase
    .from('bank_connections')
    .update({ last_cursor: data.next_cursor, last_sync_at: new Date().toISOString() })
    .eq('id', connection.id)

  // Update account balances
  const balancesResponse = await fetch(`${PLAID_BASE_URL}/accounts/balance/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      access_token: connection.plaid_access_token,
    }),
  })
  const balancesData = await balancesResponse.json()

  for (const account of balancesData.accounts || []) {
    await supabase
      .from('bank_accounts')
      .update({
        current_balance_cents: Math.round(account.balances.current * 100),
        available_balance_cents: Math.round((account.balances.available || 0) * 100),
        balance_updated_at: new Date().toISOString(),
      })
      .eq('plaid_account_id', account.account_id)
  }

  return { synced, categorized }
}

/**
 * Handle Plaid webhook events
 */
export async function handlePlaidWebhook(payload: any): Promise<void> {
  const supabase = createAdminClient()
  const { webhook_type, webhook_code, item_id } = payload

  // Find connection
  const { data: connection } = await supabase
    .from('bank_connections')
    .select('organization_id')
    .eq('plaid_item_id', item_id)
    .single()

  if (!connection) return

  switch (webhook_type) {
    case 'TRANSACTIONS':
      if (['SYNC_UPDATES_AVAILABLE', 'DEFAULT_UPDATE'].includes(webhook_code)) {
        // Trigger sync
        await syncAllBankTransactions(connection.organization_id)
      }
      break

    case 'ITEM':
      if (webhook_code === 'ERROR') {
        await supabase
          .from('bank_connections')
          .update({ status: 'error', error_code: payload.error?.error_code })
          .eq('plaid_item_id', item_id)
      }
      break
  }
}
