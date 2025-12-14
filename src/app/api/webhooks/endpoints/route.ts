import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireOrgContext } from '@/lib/auth/org-context'

// Available webhook events
export const WEBHOOK_EVENTS = [
  'member.created',
  'member.updated',
  'member.renewed',
  'member.expired',
  'donation.received',
  'event.registration',
  'event.checkin',
  'volunteer.signup',
  'volunteer.hours_logged',
  'invoice.created',
  'invoice.paid',
  'grant.application_submitted',
  'grant.application_approved',
  'grant.disbursement'
]

// GET /api/webhooks/endpoints
export async function GET(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)

  const { data: endpoints, error } = await supabase
    .from('webhook_endpoints')
    .select('*')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ 
    endpoints,
    available_events: WEBHOOK_EVENTS
  })
}

// POST /api/webhooks/endpoints - Create new endpoint
export async function POST(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const body = await req.json()

  const { url, description, events } = body

  if (!url || !events || events.length === 0) {
    return NextResponse.json({ error: 'URL and events required' }, { status: 400 })
  }

  // Validate events
  const invalidEvents = events.filter((e: string) => !WEBHOOK_EVENTS.includes(e))
  if (invalidEvents.length > 0) {
    return NextResponse.json({ 
      error: `Invalid events: ${invalidEvents.join(', ')}` 
    }, { status: 400 })
  }

  const { data: endpoint, error } = await supabase
    .from('webhook_endpoints')
    .insert({
      organization_id: org.id,
      url,
      description,
      events,
      is_active: true
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ endpoint })
}

// PATCH /api/webhooks/endpoints - Update endpoint
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const body = await req.json()
  const { id, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: 'Endpoint ID required' }, { status: 400 })
  }

  // Validate events if being updated
  if (updates.events) {
    const invalidEvents = updates.events.filter((e: string) => !WEBHOOK_EVENTS.includes(e))
    if (invalidEvents.length > 0) {
      return NextResponse.json({ 
        error: `Invalid events: ${invalidEvents.join(', ')}` 
      }, { status: 400 })
    }
  }

  const { data: endpoint, error } = await supabase
    .from('webhook_endpoints')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', org.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ endpoint })
}

// DELETE /api/webhooks/endpoints
export async function DELETE(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Endpoint ID required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('webhook_endpoints')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
