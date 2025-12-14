import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireOrgContext } from '@/lib/auth/org-context'

// GET /api/funds - List all funds
export async function GET(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)

  const { data: funds, error } = await supabase
    .from('funds')
    .select('*')
    .eq('organization_id', org.id)
    .order('is_default', { ascending: false })
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ funds })
}

// POST /api/funds - Create new fund
export async function POST(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const body = await req.json()

  const { name, description, fund_type, is_default } = body

  if (!name || !fund_type) {
    return NextResponse.json({ error: 'Name and fund_type required' }, { status: 400 })
  }

  // If this is set as default, unset other defaults
  if (is_default) {
    await supabase
      .from('funds')
      .update({ is_default: false })
      .eq('organization_id', org.id)
  }

  const { data: fund, error } = await supabase
    .from('funds')
    .insert({
      organization_id: org.id,
      name,
      description,
      fund_type,
      is_default: is_default || false
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ fund })
}

// PATCH /api/funds - Update fund
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const body = await req.json()
  const { id, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: 'Fund ID required' }, { status: 400 })
  }

  // If setting as default, unset others
  if (updates.is_default) {
    await supabase
      .from('funds')
      .update({ is_default: false })
      .eq('organization_id', org.id)
  }

  const { data: fund, error } = await supabase
    .from('funds')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', org.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ fund })
}

// DELETE /api/funds - Delete fund (soft delete by setting inactive)
export async function DELETE(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Fund ID required' }, { status: 400 })
  }

  // Check if fund has transactions
  const { count } = await supabase
    .from('ledger_entries')
    .select('*', { count: 'exact', head: true })
    .eq('fund_id', id)

  if (count && count > 0) {
    // Soft delete - just deactivate
    const { error } = await supabase
      .from('funds')
      .update({ is_active: false })
      .eq('id', id)
      .eq('organization_id', org.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, deactivated: true })
  }

  // Hard delete if no transactions
  const { error } = await supabase
    .from('funds')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
