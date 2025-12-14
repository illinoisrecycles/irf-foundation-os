import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emitDomainEvent } from '@/lib/automation/processor'

export async function POST(req: Request) {
  const supabase = createAdminClient()
  const { registration_id, qr_code } = await req.json()

  // Support both direct ID and QR code lookup
  let regId = registration_id
  if (qr_code && !regId) {
    regId = qr_code // QR contains the registration ID
  }

  if (!regId) {
    return NextResponse.json({ error: 'registration_id or qr_code required' }, { status: 400 })
  }

  // Update registration
  const { data, error } = await supabase
    .from('event_registrations')
    .update({
      checked_in: true,
      checked_in_at: new Date().toISOString(),
      attended: true,
    })
    .eq('id', regId)
    .select(`
      *,
      events(id, organization_id, title)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Add engagement points
  if (data.member_organization_id) {
    await supabase.from('member_activities').insert({
      member_organization_id: data.member_organization_id,
      activity_type: 'event_checked_in',
      points: 15,
      reference_type: 'event',
      reference_id: data.event_id,
    })

    // Recalculate engagement
    await supabase.rpc('calculate_engagement_score', { 
      member_org_id: data.member_organization_id 
    })
  }

  // Emit event for automations
  await emitDomainEvent(
    data.events.organization_id,
    'event.checked_in',
    {
      registration_id: data.id,
      event_id: data.event_id,
      event_title: data.events.title,
      attendee_email: data.attendee_email,
      attendee_name: data.attendee_name,
      member_organization_id: data.member_organization_id,
    }
  )

  return NextResponse.json({ success: true, data })
}
