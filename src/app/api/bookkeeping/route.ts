import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext, requireFinanceRole } from '@/lib/auth/org-context'

// GET - Dashboard data
export async function GET(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)
    const { searchParams } = new URL(req.url)
    const section = searchParams.get('section')

    switch (section) {
      case 'accounts': {
        const { data, error } = await supabase
          .from('ledger_accounts')
          .select('*')
          .eq('organization_id', ctx.organizationId)
          .eq('is_active', true)
          .order('code')
        
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ accounts: data })
      }

      case 'pending': {
        const { data, error } = await supabase
          .from('bank_transactions')
          .select('*')
          .eq('organization_id', ctx.organizationId)
          .in('ai_status', ['new', 'needs_review'])
          .order('date', { ascending: false })
          .limit(50)
        
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ transactions: data, count: data?.length || 0 })
      }

      case 'settings': {
        const { data, error } = await supabase
          .from('org_bookkeeping_settings')
          .select('*')
          .eq('organization_id', ctx.organizationId)
          .single()
        
        if (error && error.code !== 'PGRST116') {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
        return NextResponse.json({ settings: data || {} })
      }

      default: {
        // Dashboard overview
        const [{ data: pending }, { data: accounts }, { data: settings }] = await Promise.all([
          supabase
            .from('bank_transactions')
            .select('id', { count: 'exact' })
            .eq('organization_id', ctx.organizationId)
            .in('ai_status', ['new', 'needs_review']),
          supabase
            .from('ledger_accounts')
            .select('id, code, name, type, current_balance_cents')
            .eq('organization_id', ctx.organizationId)
            .eq('is_active', true),
          supabase
            .from('org_bookkeeping_settings')
            .select('*')
            .eq('organization_id', ctx.organizationId)
            .maybeSingle(),
        ])

        // Calculate totals
        const totals = (accounts || []).reduce((acc, a) => {
          if (a.type === 'asset') acc.assets += a.current_balance_cents || 0
          if (a.type === 'liability') acc.liabilities += a.current_balance_cents || 0
          if (a.type === 'revenue') acc.revenue += a.current_balance_cents || 0
          if (a.type === 'expense') acc.expenses += a.current_balance_cents || 0
          return acc
        }, { assets: 0, liabilities: 0, revenue: 0, expenses: 0, equity: 0 })

        return NextResponse.json({
          pendingCount: pending?.length || 0,
          accounts: accounts || [],
          settings: settings || {},
          totals,
        })
      }
    }
  } catch (err: any) {
    const status = err.message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: err.message }, { status })
  }
}

// POST - Actions
export async function POST(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)
    requireFinanceRole(ctx)

    const { action, ...body } = await req.json()

    switch (action) {
      case 'initialize-accounts': {
        // Create default nonprofit chart of accounts
        const defaultAccounts = [
          { code: '1000', name: 'Cash', type: 'asset', subtype: 'cash', is_system: true },
          { code: '1100', name: 'Accounts Receivable', type: 'asset', subtype: 'accounts_receivable' },
          { code: '1200', name: 'Pledges Receivable', type: 'asset', subtype: 'pledges_receivable' },
          { code: '1500', name: 'Fixed Assets', type: 'asset', subtype: 'fixed_asset' },
          { code: '2000', name: 'Accounts Payable', type: 'liability', subtype: 'accounts_payable', is_system: true },
          { code: '2100', name: 'Accrued Expenses', type: 'liability', subtype: 'accrued_expenses' },
          { code: '2200', name: 'Deferred Revenue', type: 'liability', subtype: 'deferred_revenue' },
          { code: '3000', name: 'Unrestricted Net Assets', type: 'equity', fund_type: 'unrestricted', is_system: true },
          { code: '3100', name: 'Temporarily Restricted', type: 'equity', fund_type: 'temporarily_restricted' },
          { code: '4000', name: 'Membership Dues', type: 'revenue', tax_line: 'Part VIII, Line 1a', is_system: true },
          { code: '4100', name: 'Donations - Unrestricted', type: 'revenue', fund_type: 'unrestricted', is_system: true },
          { code: '4200', name: 'Grants Revenue', type: 'revenue', tax_line: 'Part VIII, Line 1e' },
          { code: '4300', name: 'Event Revenue', type: 'revenue', tax_line: 'Part VIII, Line 2' },
          { code: '4400', name: 'Sponsorship Revenue', type: 'revenue' },
          { code: '6000', name: 'Salaries & Wages', type: 'expense', tax_line: 'Part IX, Line 5', is_system: true },
          { code: '6100', name: 'Payroll Taxes', type: 'expense', tax_line: 'Part IX, Line 9' },
          { code: '6200', name: 'Employee Benefits', type: 'expense', tax_line: 'Part IX, Line 10' },
          { code: '6300', name: 'Rent & Facilities', type: 'expense', tax_line: 'Part IX, Line 16' },
          { code: '6400', name: 'Office Supplies', type: 'expense', tax_line: 'Part IX, Line 18' },
          { code: '6500', name: 'Professional Services', type: 'expense', tax_line: 'Part IX, Line 11' },
          { code: '6600', name: 'Technology & Software', type: 'expense' },
          { code: '6700', name: 'Insurance', type: 'expense', tax_line: 'Part IX, Line 15' },
          { code: '6800', name: 'Travel', type: 'expense', tax_line: 'Part IX, Line 17' },
          { code: '7000', name: 'Conference & Event Expenses', type: 'expense' },
          { code: '8000', name: 'Bank Fees', type: 'expense' },
          { code: '8100', name: 'Credit Card Processing', type: 'expense' },
        ]

        for (const acct of defaultAccounts) {
          await supabase.from('ledger_accounts').upsert({
            organization_id: ctx.organizationId,
            ...acct,
            created_by_profile_id: ctx.userId,
          }, { onConflict: 'organization_id,code' })
        }

        // Initialize settings
        await supabase.from('org_bookkeeping_settings').upsert({
          organization_id: ctx.organizationId,
        }, { onConflict: 'organization_id' })

        return NextResponse.json({ success: true, message: 'Chart of accounts initialized' })
      }

      case 'update-settings': {
        const { data, error } = await supabase
          .from('org_bookkeeping_settings')
          .upsert({
            organization_id: ctx.organizationId,
            ...body,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'organization_id' })
          .select()
          .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ settings: data })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err: any) {
    const status = err.message === 'Unauthorized' ? 401 : 
                   err.message.includes('Forbidden') ? 403 : 500
    return NextResponse.json({ error: err.message }, { status })
  }
}
