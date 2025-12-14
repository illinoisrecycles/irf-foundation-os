import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const orgId = url.searchParams.get('orgId') || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || ''
  const status = url.searchParams.get('status')
  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')

  if (!orgId) {
    return NextResponse.json({ donations: [] })
  }

  const supabase = createAdminClient()

  let query = supabase
    .from('donations')
    .select(`
      *,
      profile:profiles(id, email, first_name, last_name, display_name)
    `)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  if (startDate) {
    query = query.gte('created_at', startDate)
  }

  if (endDate) {
    query = query.lte('created_at', endDate)
  }

  const { data, error } = await query.limit(500)

  if (error) {
    return NextResponse.json({ donations: [], error: error.message }, { status: 500 })
  }

  return NextResponse.json({ donations: data || [] })
}

export async function POST(req: Request) {
  const body = await req.json()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('donations')
    .insert({
      organization_id: body.organization_id || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID,
      profile_id: body.profile_id || null,
      campaign_id: body.campaign_id || null,
      donor_email: body.donor_email,
      donor_name: body.donor_name || null,
      amount_cents: body.amount_cents,
      currency: body.currency || 'USD',
      status: body.status || 'succeeded',
      is_recurring: body.is_recurring || false,
      recurring_interval: body.recurring_interval || null,
      is_anonymous: body.is_anonymous || false,
      fund_designation: body.fund_designation || null,
      tribute_type: body.tribute_type || null,
      tribute_name: body.tribute_name || null,
      notes: body.notes || null,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ donation: data })
}
