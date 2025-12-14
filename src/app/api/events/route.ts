import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const orgId = url.searchParams.get('orgId') || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || ''
  const status = url.searchParams.get('status') // draft, published, cancelled, completed
  const upcoming = url.searchParams.get('upcoming') === 'true'

  if (!orgId) {
    return NextResponse.json({ events: [] })
  }

  const supabase = createAdminClient()

  let query = supabase
    .from('events')
    .select(`
      *,
      ticket_types (
        id,
        name,
        price_cents,
        quantity_available,
        quantity_sold
      )
    `)
    .eq('organization_id', orgId)
    .order('start_date', { ascending: true })

  if (status) {
    query = query.eq('status', status)
  }

  if (upcoming) {
    query = query.gte('start_date', new Date().toISOString())
  }

  const { data, error } = await query.limit(100)

  if (error) {
    return NextResponse.json({ events: [], error: error.message }, { status: 500 })
  }

  // Get registration counts separately for each event
  const eventsWithCounts = await Promise.all(
    (data || []).map(async (event) => {
      const { count } = await supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)
      
      return { ...event, registrations_count: count || 0 }
    })
  )

  return NextResponse.json({ events: eventsWithCounts })
}

export async function POST(req: Request) {
  const body = await req.json()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('events')
    .insert({
      organization_id: body.organization_id || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID,
      title: body.title,
      slug: body.slug || body.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      description: body.description || null,
      short_description: body.short_description || null,
      event_type: body.event_type || 'conference',
      start_date: body.start_date,
      end_date: body.end_date || body.start_date,
      timezone: body.timezone || 'America/Chicago',
      venue_name: body.venue_name || body.location || null,
      venue_address: body.venue_address || body.address || null,
      venue_city: body.venue_city || null,
      venue_state: body.venue_state || null,
      venue_postal_code: body.venue_postal_code || null,
      virtual_url: body.virtual_url || null,
      is_virtual: !!body.is_virtual,
      max_attendees: body.max_attendees || body.capacity || null,
      is_free: body.is_free ?? false,
      status: body.status || 'draft',
      registration_opens_at: body.registration_opens_at || body.registration_start || null,
      registration_closes_at: body.registration_closes_at || body.registration_end || null,
      early_bird_deadline: body.early_bird_deadline || body.early_bird_end || null,
      early_bird_discount_percent: body.early_bird_discount_percent || 0,
      member_discount_percent: body.member_discount_percent || 0,
      cover_image_url: body.cover_image_url || body.featured_image_url || null,
      settings: body.settings || {},
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ event: data })
}
