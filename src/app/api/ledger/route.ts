import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET - List ledger entries or accounts
export async function GET(req: Request) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  
  const orgId = searchParams.get('organization_id')
  const type = searchParams.get('type') || 'entries' // entries, accounts, summary
  const accountId = searchParams.get('account_id')
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')
  const fiscalYear = searchParams.get('fiscal_year')

  if (!orgId) {
    return NextResponse.json({ error: 'organization_id required' }, { status: 400 })
  }

  if (type === 'accounts') {
    const { data, error } = await supabase
      .from('gl_accounts')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('code')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (type === 'summary') {
    // Get account balances summary
    const { data, error } = await supabase
      .from('ledger_entries')
      .select(`
        gl_account_id,
        account:gl_accounts(id, code, name, account_type),
        debit_cents,
        credit_cents
      `)
      .eq('organization_id', orgId)
      .eq(fiscalYear ? 'fiscal_year' : 'id', fiscalYear || 'id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Aggregate by account
    const summary: Record<string, { account: any; debits: number; credits: number; balance: number }> = {}
    
    for (const entry of data || []) {
      const accountId = entry.gl_account_id
      if (!summary[accountId]) {
        summary[accountId] = {
          account: entry.account,
          debits: 0,
          credits: 0,
          balance: 0,
        }
      }
      summary[accountId].debits += entry.debit_cents || 0
      summary[accountId].credits += entry.credit_cents || 0
    }

    // Calculate balances based on account type
    for (const accountId of Object.keys(summary)) {
      const item = summary[accountId]
      const type = item.account?.account_type
      // Assets & Expenses: Debit - Credit
      // Liabilities, Equity, Revenue: Credit - Debit
      if (['asset', 'expense'].includes(type)) {
        item.balance = item.debits - item.credits
      } else {
        item.balance = item.credits - item.debits
      }
    }

    return NextResponse.json(Object.values(summary))
  }

  // Default: entries
  let query = supabase
    .from('ledger_entries')
    .select(`
      *,
      account:gl_accounts(id, code, name, account_type)
    `)
    .eq('organization_id', orgId)

  if (accountId) query = query.eq('gl_account_id', accountId)
  if (startDate) query = query.gte('posted_at', startDate)
  if (endDate) query = query.lte('posted_at', endDate)
  if (fiscalYear) query = query.eq('fiscal_year', parseInt(fiscalYear))

  const { data, error } = await query.order('posted_at', { ascending: false }).limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST - Create ledger entry (double-entry)
export async function POST(req: Request) {
  const supabase = createAdminClient()
  const body = await req.json()

  const { organization_id, entries, description, reference_type, reference_id } = body

  if (!organization_id || !entries?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Validate double-entry: debits must equal credits
  let totalDebits = 0
  let totalCredits = 0

  for (const entry of entries) {
    totalDebits += entry.debit_cents || 0
    totalCredits += entry.credit_cents || 0
  }

  if (totalDebits !== totalCredits) {
    return NextResponse.json({ 
      error: 'Unbalanced entry: debits must equal credits',
      debits: totalDebits,
      credits: totalCredits,
    }, { status: 400 })
  }

  // Generate transaction ID to group entries
  const transactionId = crypto.randomUUID()
  const fiscalYear = new Date().getFullYear()
  const fiscalPeriod = new Date().getMonth() + 1

  const entryRows = entries.map((entry: any) => ({
    organization_id,
    transaction_id: transactionId,
    gl_account_id: entry.gl_account_id,
    debit_cents: entry.debit_cents || 0,
    credit_cents: entry.credit_cents || 0,
    description: entry.description || description,
    reference_type,
    reference_id,
    fiscal_year: fiscalYear,
    fiscal_period: fiscalPeriod,
  }))

  const { data, error } = await supabase
    .from('ledger_entries')
    .insert(entryRows)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ transaction_id: transactionId, entries: data })
}
