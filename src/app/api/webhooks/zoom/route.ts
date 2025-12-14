import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseZoomWebhook } from '@/lib/integrations/zoom'
import { triggerEvent } from '@/lib/automation'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const event = parseZoomWebhook(body)
    const supabase = createAdminClient()

    // Handle different Zoom events
    switch (event.event) {
      case 'meeting.participant_joined':
      case 'webinar.participant_joined': {
        const participant = event.payload.object.participant
        if (!participant?.email) break

        // Find matching event registration
        const { data: registration } = await supabase
          .from('event_registrations')
          .select('id, member_organization_id, event_id')
          .eq('attendee_email', participant.email)
          .single()

        if (registration) {
          // Mark as attended
          await supabase
            .from('event_registrations')
            .update({ attended: true })
            .eq('id', registration.id)

          // Log attendance
          await supabase.from('event_attendance_logs').insert({
            event_id: registration.event_id,
            registration_id: registration.id,
            participant_email: participant.email,
            participant_name: participant.user_name,
            join_time: participant.join_time || new Date().toISOString(),
            source: 'zoom',
          })

          // Add engagement points
          if (registration.member_organization_id) {
            await supabase.from('member_activities').insert({
              member_organization_id: registration.member_organization_id,
              activity_type: 'event_attended',
              points: 10,
              reference_type: 'event',
              reference_id: registration.event_id,
            })

            // Recalculate engagement
            await supabase.rpc('calculate_engagement_score', {
              member_org_id: registration.member_organization_id,
            })
          }
        }
        break
      }

      case 'meeting.participant_left':
      case 'webinar.participant_left': {
        const participant = event.payload.object.participant
        if (!participant?.email) break

        // Update attendance log with leave time
        await supabase
          .from('event_attendance_logs')
          .update({
            leave_time: participant.leave_time || new Date().toISOString(),
          })
          .eq('participant_email', participant.email)
          .is('leave_time', null)
        break
      }

      case 'meeting.ended':
      case 'webinar.ended': {
        // Calculate duration for all attendees
        const meetingId = String(event.payload.object.id)
        
        const { data: logs } = await supabase
          .from('event_attendance_logs')
          .select('id, join_time, leave_time')
          .eq('source', 'zoom')

        for (const log of logs || []) {
          if (log.join_time && log.leave_time) {
            const duration = Math.round(
              (new Date(log.leave_time).getTime() - new Date(log.join_time).getTime()) / 60000
            )
            await supabase
              .from('event_attendance_logs')
              .update({ duration_minutes: duration })
              .eq('id', log.id)
          }
        }
        break
      }

      case 'recording.completed': {
        // Store recording URL for the event
        const meetingId = String(event.payload.object.id)
        
        // Find event by Zoom meeting ID
        const { data: eventData } = await supabase
          .from('events')
          .select('id')
          .eq('zoom_meeting_id', meetingId)
          .single()

        if (eventData) {
          // Could store recording URLs in event metadata
          await supabase
            .from('events')
            .update({
              metadata: supabase.sql`coalesce(metadata, '{}'::jsonb) || '{"has_recording": true}'::jsonb`,
            })
            .eq('id', eventData.id)
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('[Zoom Webhook] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Zoom webhook verification
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const challenge = searchParams.get('challenge')
  
  if (challenge) {
    return NextResponse.json({ challenge })
  }
  
  return NextResponse.json({ status: 'ok' })
}
