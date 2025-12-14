import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET - List sponsorships
export async function GET(req: Request) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('organization_id')
  const eventId = searchParams.get('event_id')
  const status = searchParams.get('status')

  if (!orgId) return NextResponse.json({ error: 'organization_id required' }, { status: 400 })

  let query = supabase
    .from('sponsorships')
    .select(`
      *,
      sponsor:member_organizations(id, name, primary_email, logo_url),
      event:events(id, title, start_date),
      tier:sponsorship_tiers(id, name, amount_cents, benefits)
    `)
    .eq('organization_id', orgId)

  if (eventId) query = query.eq('event_id', eventId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST - Create sponsorship
export async function POST(req: Request) {
  const supabase = createAdminClient()
  const body = await req.json()

  const { organization_id, sponsor_id, event_id, tier_id, amount_cents, benefits, notes } = body

  if (!organization_id || !sponsor_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sponsorships')
    .insert({
      organization_id,
      sponsor_id,
      event_id,
      tier_id,
      amount_cents: amount_cents || 0,
      benefits: benefits || [],
      notes,
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Create work item for follow-up
  await supabase.from('work_items').insert({
    organization_id,
    item_type: 'task',
    title: `Follow up on sponsorship from ${body.sponsor_name || 'sponsor'}`,
    description: `New sponsorship created. Amount: $${(amount_cents || 0) / 100}`,
    priority: 'high',
    reference_type: 'sponsorship',
    reference_id: data.id,
  })

  return NextResponse.json(data)
}

// PATCH - Update sponsorship status
export async function PATCH(req: Request) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { id, status, payment_status, notes } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('sponsorships')
    .update({ 
      status, 
      payment_status, 
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
