import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

type EmailJob = {
  id: string
  organization_id: string
  to_email: string
  to_name?: string
  from_email?: string
  subject: string
  html_body?: string
  template_id?: string
  template_data?: Record<string, any>
  attempts: number
}

/**
 * Process pending emails from outbox with retry logic
 */
export async function processEmailOutbox(batchSize: number = 50): Promise<{
  processed: number
  sent: number
  failed: number
}> {
  const supabase = createAdminClient()

  // Get pending emails (max 3 attempts, at least 5 min since last attempt)
  const { data: emails, error } = await supabase
    .from('email_outbox')
    .select('*')
    .eq('status', 'pending')
    .lt('attempts', 3)
    .or(`last_attempt_at.is.null,last_attempt_at.lt.${new Date(Date.now() - 5 * 60 * 1000).toISOString()}`)
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (error || !emails?.length) {
    return { processed: 0, sent: 0, failed: 0 }
  }

  let sent = 0
  let failed = 0

  for (const email of emails as EmailJob[]) {
    try {
      // Get org settings for from email
      const { data: org } = await supabase
        .from('organizations')
        .select('name, settings')
        .eq('id', email.organization_id)
        .single()

      const fromEmail = email.from_email || org?.settings?.email_from || 'noreply@foundationos.app'
      const fromName = org?.name || 'FoundationOS'

      // Send via Resend
      const { data: result, error: sendError } = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: email.to_email,
        subject: email.subject,
        html: email.html_body || '',
        headers: {
          'X-Entity-Ref-ID': email.id, // For tracking
        },
      })

      if (sendError) throw sendError

      // Mark as sent
      await supabase
        .from('email_outbox')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          resend_id: result?.id,
          last_attempt_at: new Date().toISOString(),
          attempts: email.attempts + 1,
        })
        .eq('id', email.id)

      sent++
    } catch (err: any) {
      // Mark attempt, may retry
      const newAttempts = email.attempts + 1
      const status = newAttempts >= 3 ? 'failed' : 'pending'

      await supabase
        .from('email_outbox')
        .update({
          status,
          error_message: err.message,
          last_attempt_at: new Date().toISOString(),
          attempts: newAttempts,
        })
        .eq('id', email.id)

      if (status === 'failed') failed++
    }
  }

  return { processed: emails.length, sent, failed }
}

/**
 * Queue an email for sending (use this instead of direct send)
 */
export async function queueEmail(params: {
  organizationId: string
  to: string
  toName?: string
  subject: string
  html: string
  idempotencyKey?: string
}): Promise<string> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('email_outbox')
    .insert({
      organization_id: params.organizationId,
      to_email: params.to,
      to_name: params.toName,
      subject: params.subject,
      html_body: params.html,
      idempotency_key: params.idempotencyKey,
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

/**
 * Queue bulk emails (for campaigns)
 */
export async function queueBulkEmails(params: {
  organizationId: string
  recipients: { email: string; name?: string; data?: Record<string, any> }[]
  subject: string
  htmlTemplate: string
  campaignId?: string
}): Promise<{ queued: number }> {
  const supabase = createAdminClient()

  const emails = params.recipients.map((r, idx) => ({
    organization_id: params.organizationId,
    to_email: r.email,
    to_name: r.name,
    subject: interpolateTemplate(params.subject, r.data || {}),
    html_body: interpolateTemplate(params.htmlTemplate, r.data || {}),
    idempotency_key: params.campaignId ? `${params.campaignId}_${r.email}` : undefined,
  }))

  // Insert in batches of 100
  let queued = 0
  for (let i = 0; i < emails.length; i += 100) {
    const batch = emails.slice(i, i + 100)
    const { error } = await supabase.from('email_outbox').insert(batch)
    if (!error) queued += batch.length
  }

  return { queued }
}

function interpolateTemplate(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || '')
}
