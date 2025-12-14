import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const supabase = createAdminClient()
  const body = await req.json()

  const { organization_id, code, name, account_type, parent_id } = body

  if (!organization_id || !code || !name || !account_type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const validTypes = ['asset', 'liability', 'equity', 'revenue', 'expense']
  if (!validTypes.includes(account_type)) {
    return NextResponse.json({ error: 'Invalid account_type' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('gl_accounts')
    .insert({ organization_id, code, name, account_type, parent_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: Request) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { organization_id } = body

  if (!organization_id) {
    return NextResponse.json({ error: 'organization_id required' }, { status: 400 })
  }

  const defaultAccounts = [
    { code: '1000', name: 'Cash', account_type: 'asset' },
    { code: '1100', name: 'Accounts Receivable', account_type: 'asset' },
    { code: '2000', name: 'Accounts Payable', account_type: 'liability' },
    { code: '2100', name: 'Deferred Revenue', account_type: 'liability' },
    { code: '3000', name: 'Net Assets - Unrestricted', account_type: 'equity' },
    { code: '4000', name: 'Membership Dues', account_type: 'revenue' },
    { code: '4100', name: 'Event Revenue', account_type: 'revenue' },
    { code: '4200', name: 'Donation Revenue', account_type: 'revenue' },
    { code: '4300', name: 'Sponsorship Revenue', account_type: 'revenue' },
    { code: '5000', name: 'Program Expenses', account_type: 'expense' },
    { code: '5100', name: 'Administrative Expenses', account_type: 'expense' },
  ]

  const rows = defaultAccounts.map(a => ({ ...a, organization_id }))
  const { data, error } = await supabase.from('gl_accounts').insert(rows).select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ accounts_created: data.length })
}
