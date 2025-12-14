import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireOrgContext } from '@/lib/auth/org-context'

// GET /api/invoices - List invoices
export async function GET(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const { searchParams } = new URL(req.url)
  
  const status = searchParams.get('status')
  const memberId = searchParams.get('member_id')
  const limit = parseInt(searchParams.get('limit') || '50')

  let query = supabase
    .from('invoices')
    .select(`
      *,
      member_organization:member_organizations(id, name, primary_contact_email)
    `)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) {
    query = query.eq('status', status)
  }
  if (memberId) {
    query = query.eq('member_organization_id', memberId)
  }

  const { data: invoices, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ invoices })
}

// POST /api/invoices - Create invoice
export async function POST(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const body = await req.json()

  const {
    member_organization_id,
    bill_to_name,
    bill_to_email,
    bill_to_address,
    line_items,
    tax_rate,
    due_date,
    notes
  } = body

  if (!line_items || line_items.length === 0) {
    return NextResponse.json({ error: 'Line items required' }, { status: 400 })
  }

  // Generate invoice number
  const { data: numberData } = await supabase
    .rpc('generate_invoice_number', { org_id: org.id })

  const invoice_number = numberData || `INV-${Date.now()}`

  // Calculate totals
  const subtotal_cents = line_items.reduce((sum: number, item: any) => {
    const itemTotal = (item.quantity || 1) * (item.unit_price_cents || 0)
    item.total_cents = itemTotal
    return sum + itemTotal
  }, 0)

  const tax_cents = Math.round(subtotal_cents * (tax_rate || 0))
  const total_cents = subtotal_cents + tax_cents

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      organization_id: org.id,
      member_organization_id,
      invoice_number,
      bill_to_name,
      bill_to_email,
      bill_to_address,
      line_items,
      subtotal_cents,
      tax_rate: tax_rate || 0,
      tax_cents,
      total_cents,
      due_date,
      notes
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ invoice })
}

// PATCH /api/invoices - Update invoice
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const body = await req.json()
  const { id, action, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 })
  }

  // Handle special actions
  if (action === 'send') {
    const { data: invoice, error } = await supabase
      .from('invoices')
      .update({ 
        status: 'sent', 
        sent_at: new Date().toISOString() 
      })
      .eq('id', id)
      .eq('organization_id', org.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // TODO: Send email with invoice PDF
    // await sendInvoiceEmail(invoice)

    return NextResponse.json({ invoice })
  }

  if (action === 'void') {
    const { data: invoice, error } = await supabase
      .from('invoices')
      .update({ status: 'void' })
      .eq('id', id)
      .eq('organization_id', org.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ invoice })
  }

  if (action === 'mark_paid') {
    const { data: invoice, error } = await supabase
      .from('invoices')
      .update({ 
        status: 'paid',
        paid_cents: updates.amount_cents,
        paid_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('organization_id', org.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ invoice })
  }

  // Regular update (only for draft invoices)
  if (updates.line_items) {
    updates.subtotal_cents = updates.line_items.reduce((sum: number, item: any) => {
      item.total_cents = (item.quantity || 1) * (item.unit_price_cents || 0)
      return sum + item.total_cents
    }, 0)
    updates.tax_cents = Math.round(updates.subtotal_cents * (updates.tax_rate || 0))
    updates.total_cents = updates.subtotal_cents + updates.tax_cents
  }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', org.id)
    .eq('status', 'draft') // Can only edit draft invoices
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ invoice })
}

// DELETE /api/invoices - Delete draft invoice
export async function DELETE(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)
    .eq('status', 'draft') // Can only delete drafts

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
