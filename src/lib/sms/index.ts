import { createAdminClient } from '@/lib/supabase/admin'

// SMS provider abstraction (Twilio-compatible)
export async function sendSMS(params: {
  organizationId: string
  to: string
  message: string
  from?: string
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const supabase = createAdminClient()

  // Get org's Twilio credentials
  const { data: org } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', params.organizationId)
    .single()

  const twilioAccountSid = org?.settings?.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID
  const twilioAuthToken = org?.settings?.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN
  const twilioFromNumber = params.from || org?.settings?.twilio_phone || process.env.TWILIO_PHONE_NUMBER

  if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
    // Queue for manual sending if no Twilio configured
    await supabase.from('work_items').insert({
      organization_id: params.organizationId,
      item_type: 'task',
      title: `Send SMS to ${params.to}`,
      description: params.message,
      priority: 'high',
      metadata: { sms_to: params.to, sms_message: params.message },
    })
    return { success: true, error: 'SMS queued for manual sending (Twilio not configured)' }
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: params.to,
          From: twilioFromNumber,
          Body: params.message,
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Twilio error')
    }

    // Log the SMS
    await supabase.from('communication_log').insert({
      organization_id: params.organizationId,
      type: 'sms',
      to: params.to,
      content: params.message,
      external_id: data.sid,
      status: 'sent',
    })

    return { success: true, messageId: data.sid }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// Queue SMS for automation
export async function queueSMS(params: {
  organizationId: string
  to: string
  message: string
  scheduledFor?: Date
}): Promise<void> {
  const supabase = createAdminClient()

  await supabase.from('sms_queue').insert({
    organization_id: params.organizationId,
    to_phone: params.to,
    message: params.message,
    scheduled_for: params.scheduledFor?.toISOString() || new Date().toISOString(),
    status: 'pending',
  })
}
