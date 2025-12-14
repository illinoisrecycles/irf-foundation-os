import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireOrgContext } from '@/lib/auth/org-context'

// GET /api/budgets - List budgets
export async function GET(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const { searchParams } = new URL(req.url)
  
  const fiscalYear = searchParams.get('fiscal_year')

  let query = supabase
    .from('budgets')
    .select(`
      *,
      lines:budget_lines(
        id, category, description, amount_cents, period,
        account:ledger_accounts(id, name, code),
        fund:funds(id, name)
      )
    `)
    .eq('organization_id', org.id)
    .order('fiscal_year', { ascending: false })

  if (fiscalYear) {
    query = query.eq('fiscal_year', parseInt(fiscalYear))
  }

  const { data: budgets, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ budgets })
}

// POST /api/budgets - Create budget
export async function POST(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const body = await req.json()

  const { name, fiscal_year, lines } = body

  if (!name || !fiscal_year) {
    return NextResponse.json({ error: 'Name and fiscal year required' }, { status: 400 })
  }

  // Create budget
  const { data: budget, error: budgetError } = await supabase
    .from('budgets')
    .insert({
      organization_id: org.id,
      name,
      fiscal_year,
      status: 'draft'
    })
    .select()
    .single()

  if (budgetError) {
    return NextResponse.json({ error: budgetError.message }, { status: 500 })
  }

  // Create budget lines if provided
  if (lines && lines.length > 0) {
    const linesWithBudgetId = lines.map((line: any) => ({
      ...line,
      budget_id: budget.id
    }))

    const { error: linesError } = await supabase
      .from('budget_lines')
      .insert(linesWithBudgetId)

    if (linesError) {
      return NextResponse.json({ error: linesError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ budget })
}

// PATCH /api/budgets - Update budget
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const body = await req.json()
  const { id, action, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: 'Budget ID required' }, { status: 400 })
  }

  // Handle approval action
  if (action === 'approve') {
    const { data: { user } } = await supabase.auth.getUser()
    
    const { data: budget, error } = await supabase
      .from('budgets')
      .update({
        status: 'approved',
        approved_by: user?.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('organization_id', org.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ budget })
  }

  // Regular update
  const { data: budget, error } = await supabase
    .from('budgets')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', org.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ budget })
}

// DELETE /api/budgets
export async function DELETE(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Budget ID required' }, { status: 400 })
  }

  // Can only delete draft budgets
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)
    .eq('status', 'draft')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
