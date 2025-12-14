import { createAdminClient } from '@/lib/supabase/admin'
import { generateCertificatePDF } from './certificate/generator'
import { getTemplate } from './certificate/templates'
import { uploadCertificate } from './certificate/uploader'
import { sendCertificateEmail } from './certificate/emailer'
import { CertificateData } from './certificate/types'

const supabase = createAdminClient()

type GenerateResult = {
  success: boolean
  url?: string
  error?: string
}

export async function generateAndDeliverCertificate(
  attendeeCreditId: string
): Promise<GenerateResult> {
  try {
    // Fetch credit with relations
    const { data: credit, error: fetchError } = await supabase
      .from('attendee_credits')
      .select(`
        id,
        certificate_url,
        certificate_template_id,
        event_registration_id,
        event_credit_id
      `)
      .eq('id', attendeeCreditId)
      .single()

    if (fetchError || !credit) {
      return { success: false, error: 'Credit not found' }
    }

    // Skip if already generated
    if (credit.certificate_url) {
      return { success: true, url: credit.certificate_url }
    }

    // Get registration details
    const { data: registration } = await supabase
      .from('event_registrations')
      .select('attendee_name, attendee_email, event_id')
      .eq('id', credit.event_registration_id)
      .single()

    if (!registration) {
      return { success: false, error: 'Registration not found' }
    }

    // Get event credit details
    const { data: eventCredit } = await supabase
      .from('event_credits')
      .select('credit_type, credit_hours, accrediting_body, accreditation_number, event_id')
      .eq('id', credit.event_credit_id)
      .single()

    if (!eventCredit) {
      return { success: false, error: 'Event credit not found' }
    }

    // Get event details
    const { data: event } = await supabase
      .from('events')
      .select('title, start_date, organization_id')
      .eq('id', eventCredit.event_id)
      .single()

    if (!event) {
      return { success: false, error: 'Event not found' }
    }

    // Get organization name
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', event.organization_id)
      .single()

    const completionDate = new Date(event.start_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const certData: CertificateData = {
      attendeeName: registration.attendee_name || 'Valued Member',
      attendeeEmail: registration.attendee_email,
      eventTitle: event.title,
      creditHours: eventCredit.credit_hours,
      creditType: eventCredit.credit_type,
      completionDate,
      accreditingBody: eventCredit.accrediting_body,
      accreditationNumber: eventCredit.accreditation_number,
      organizationName: org?.name || 'Organization',
      certificateId: credit.id,
    }

    // Generate PDF
    const template = getTemplate(credit.certificate_template_id || 'default')
    const pdfBytes = await generateCertificatePDF(certData, template)

    // Upload to storage
    const { publicUrl } = await uploadCertificate(
      pdfBytes,
      event.organization_id,
      credit.id
    )

    // Update record
    await supabase
      .from('attendee_credits')
      .update({
        certificate_url: publicUrl,
        certificate_generated_at: new Date().toISOString(),
      })
      .eq('id', attendeeCreditId)

    // Send email
    await sendCertificateEmail({ ...certData, certificateUrl: publicUrl })

    return { success: true, url: publicUrl }
  } catch (err: any) {
    console.error('[CEU] Certificate generation failed:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Auto-award CEUs based on attendance duration and requirements
 */
export async function autoAwardCEUs(registrationId: string): Promise<number> {
  // Get total attendance duration
  const { data: logs } = await supabase
    .from('event_attendance_log')
    .select('duration_minutes')
    .eq('event_registration_id', registrationId)

  const totalDuration = logs?.reduce((sum, log) => sum + (log.duration_minutes || 0), 0) || 0

  // Get registration and event
  const { data: registration } = await supabase
    .from('event_registrations')
    .select('event_id, member_organization_id')
    .eq('id', registrationId)
    .single()

  if (!registration) return 0

  // Get event credits with auto-award enabled
  const { data: credits } = await supabase
    .from('event_credits')
    .select('*')
    .eq('event_id', registration.event_id)
    .eq('auto_award', true)

  let awarded = 0

  for (const credit of credits || []) {
    const requiredMinutes = credit.required_minutes || 30
    const meetsAttendance = totalDuration >= requiredMinutes * 0.8 // 80% threshold

    // Check additional requirements (quiz, survey) if configured
    // For now, just check attendance
    if (meetsAttendance) {
      const { error } = await supabase
        .from('attendee_credits')
        .upsert({
          event_registration_id: registrationId,
          event_credit_id: credit.id,
          credit_hours: credit.credit_hours,
          verified: true,
          verified_at: new Date().toISOString(),
          attended_duration_minutes: totalDuration,
          awarded_at: new Date().toISOString(),
        }, {
          onConflict: 'event_registration_id,event_credit_id',
        })

      if (!error) {
        awarded++

        // Generate certificate immediately
        const { data: awardedCredit } = await supabase
          .from('attendee_credits')
          .select('id')
          .eq('event_registration_id', registrationId)
          .eq('event_credit_id', credit.id)
          .single()

        if (awardedCredit) {
          await generateAndDeliverCertificate(awardedCredit.id)
        }
      }
    }
  }

  return awarded
}

/**
 * Get member's CEU transcript
 */
export async function getMemberTranscript(memberOrgId: string) {
  const { data, error } = await supabase
    .from('attendee_credits')
    .select(`
      id,
      credit_hours,
      verified,
      verified_at,
      certificate_url,
      attended_duration_minutes,
      event_registrations!inner(
        attendee_name,
        event_id,
        member_organization_id
      ),
      event_credits!inner(
        credit_type,
        accrediting_body,
        events!inner(title, start_date)
      )
    `)
    .eq('event_registrations.member_organization_id', memberOrgId)
    .eq('verified', true)
    .order('verified_at', { ascending: false })

  if (error) throw error

  // Group by credit type
  const byType: Record<string, { total: number; items: any[] }> = {}

  for (const credit of data || []) {
    const type = credit.event_credits?.credit_type || 'Other'
    if (!byType[type]) {
      byType[type] = { total: 0, items: [] }
    }
    byType[type].total += credit.credit_hours || 0
    byType[type].items.push(credit)
  }

  return {
    credits: data,
    summary: byType,
    totalCredits: Object.values(byType).reduce((sum, t) => sum + t.total, 0),
  }
}
