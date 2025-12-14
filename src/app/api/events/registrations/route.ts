import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('event_id')

  if (!eventId) {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('event_registrations')
    .select(`
      id,
      attendee_name,
      attendee_email,
      registration_type,
      checked_in,
      checked_in_at,
      member_organizations(name)
    `)
    .eq('event_id', eventId)
    .eq('status', 'confirmed')
    .order('attendee_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
