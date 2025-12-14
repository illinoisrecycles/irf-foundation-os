import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateYearEndReceipts } from '@/lib/automation/foundation-recipes'

// ============================================================================
// TAX RECEIPTS API
// Generate and send year-end tax receipts to donors
// ============================================================================

export async function GET(req: Request) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  
  const orgId = searchParams.get('organization_id')
  const year = searchParams.get('year')
  const donorId = searchParams.get('donor_id')

  if (!orgId) {
    return NextResponse.json({ error: 'organization_id required' }, { status: 400 })
  }

  // Get generated receipts
  let query = supabase
    .from('generated_documents')
    .select(`
      *,
      donor:member_organizations!generated_documents_entity_id_fkey (id, name, primary_contact_email)
    `)
    .eq('organization_id', orgId)
    .eq('document_type', 'tax_receipt')
    .order('created_at', { ascending: false })

  if (donorId) {
    query = query.eq('entity_id', donorId)
  }

  const { data, error } = await query.limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ receipts: data })
}

export async function POST(req: Request) {
  const body = await req.json()

  const {
    organization_id,
    year,
    preview = false,
    donor_ids, // Optional: specific donors only
  } = body

  if (!organization_id || !year) {
    return NextResponse.json({ 
      error: 'organization_id and year required' 
    }, { status: 400 })
  }

  // Validate year
  const yearNum = parseInt(year)
  const currentYear = new Date().getFullYear()
  
  if (yearNum < 2020 || yearNum > currentYear) {
    return NextResponse.json({ 
      error: `Invalid year. Must be between 2020 and ${currentYear}` 
    }, { status: 400 })
  }

  if (preview) {
    // Preview mode: just count donors and amounts
    const supabase = createAdminClient()
    
    const startOfYear = `${year}-01-01T00:00:00Z`
    const endOfYear = `${year}-12-31T23:59:59Z`

    const { data: donations } = await supabase
      .from('donations')
      .select('donor_member_id, amount_cents')
      .eq('organization_id', organization_id)
      .gte('created_at', startOfYear)
      .lte('created_at', endOfYear)

    if (!donations?.length) {
      return NextResponse.json({
        preview: true,
        donor_count: 0,
        total_amount: 0,
        message: 'No donations found for this year',
      })
    }

    const donorTotals = new Map<string, number>()
    for (const d of donations) {
      if (!d.donor_member_id) continue
      const current = donorTotals.get(d.donor_member_id) || 0
      donorTotals.set(d.donor_member_id, current + d.amount_cents)
    }

    const totalAmount = Array.from(donorTotals.values()).reduce((a, b) => a + b, 0)

    return NextResponse.json({
      preview: true,
      donor_count: donorTotals.size,
      total_amount: totalAmount,
      total_formatted: `$${(totalAmount / 100).toFixed(2)}`,
    })
  }

  // Generate receipts
  const result = await generateYearEndReceipts(organization_id, yearNum)

  return NextResponse.json({
    success: true,
    year: yearNum,
    ...result,
  })
}

// Generate single receipt for a specific donor
export async function PUT(req: Request) {
  const supabase = createAdminClient()
  const body = await req.json()

  const {
    organization_id,
    donor_id,
    year,
    send_email = false,
  } = body

  if (!organization_id || !donor_id || !year) {
    return NextResponse.json({ 
      error: 'organization_id, donor_id, and year required' 
    }, { status: 400 })
  }

  const startOfYear = `${year}-01-01T00:00:00Z`
  const endOfYear = `${year}-12-31T23:59:59Z`

  // Get donor
  const { data: donor } = await supabase
    .from('member_organizations')
    .select('id, name, primary_contact_email, address_line_1, address_city, address_state, address_zip')
    .eq('id', donor_id)
    .single()

  if (!donor) {
    return NextResponse.json({ error: 'Donor not found' }, { status: 404 })
  }

  // Get donations
  const { data: donations } = await supabase
    .from('donations')
    .select('id, amount_cents, created_at, purpose')
    .eq('donor_member_id', donor_id)
    .eq('organization_id', organization_id)
    .gte('created_at', startOfYear)
    .lte('created_at', endOfYear)

  if (!donations?.length) {
    return NextResponse.json({ 
      error: 'No donations found for this donor in the specified year' 
    }, { status: 400 })
  }

  const totalCents = donations.reduce((sum, d) => sum + d.amount_cents, 0)

  // Create document record
  const { data: doc, error: docError } = await supabase
    .from('generated_documents')
    .insert({
      organization_id,
      document_type: 'tax_receipt',
      entity_table: 'member_organizations',
      entity_id: donor_id,
      title: `${year} Tax Receipt - ${donor.name}`,
      merge_data: {
        year,
        donor_name: donor.name,
        donor_address: [
          donor.address_line_1,
          `${donor.address_city}, ${donor.address_state} ${donor.address_zip}`
        ].filter(Boolean).join('\n'),
        total_amount: `$${(totalCents / 100).toFixed(2)}`,
        donations: donations.map(d => ({
          date: new Date(d.created_at).toLocaleDateString(),
          amount: `$${(d.amount_cents / 100).toFixed(2)}`,
          purpose: d.purpose || 'General Support',
        })),
      },
      sent_to_email: send_email ? donor.primary_contact_email : null,
      sent_at: send_email ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (docError) {
    return NextResponse.json({ error: docError.message }, { status: 500 })
  }

  // Send email if requested
  if (send_email && donor.primary_contact_email) {
    await supabase.from('email_outbox').insert({
      organization_id,
      to_email: donor.primary_contact_email,
      subject: `Your ${year} Donation Receipt`,
      template_type: 'tax_receipt',
      merge_data: {
        donor_name: donor.name,
        year,
        total_amount: `$${(totalCents / 100).toFixed(2)}`,
        document_id: doc.id,
      },
      status: 'pending',
    })
  }

  return NextResponse.json({
    success: true,
    document: doc,
    total_cents: totalCents,
    donation_count: donations.length,
    email_sent: send_email && !!donor.primary_contact_email,
  })
}
