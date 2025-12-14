import { createAdminClient } from '@/lib/supabase/admin'
import { queueBulkEmails } from './outbox'

export type EmailCampaign = {
  id: string
  name: string
  subject: string
  html_body: string
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'
  scheduled_at?: string
  sent_at?: string
  stats: {
    total: number
    sent: number
    opened: number
    clicked: number
    bounced: number
    unsubscribed: number
  }
}

/**
 * Create and send an email campaign
 */
export async function sendCampaign(params: {
  organizationId: string
  campaignId: string
  listId?: string
  segmentQuery?: Record<string, any>
}): Promise<{ queued: number }> {
  const supabase = createAdminClient()

  // Get campaign
  const { data: campaign } = await supabase
    .from('email_campaigns')
    .select('*')
    .eq('id', params.campaignId)
    .single()

  if (!campaign) throw new Error('Campaign not found')

  // Get recipients
  let recipientsQuery = supabase
    .from('member_organizations')
    .select('id, name, primary_email')
    .eq('organization_id', params.organizationId)
    .eq('email_opt_in', true) // Respect unsubscribes!
    .not('primary_email', 'is', null)

  if (params.listId) {
    // Get list members
    const { data: listMembers } = await supabase
      .from('email_list_members')
      .select('member_organization_id')
      .eq('list_id', params.listId)

    const memberIds = listMembers?.map(m => m.member_organization_id) || []
    recipientsQuery = recipientsQuery.in('id', memberIds)
  }

  if (params.segmentQuery) {
    // Apply segment filters
    for (const [key, value] of Object.entries(params.segmentQuery)) {
      recipientsQuery = recipientsQuery.eq(key, value)
    }
  }

  const { data: recipients } = await recipientsQuery

  if (!recipients?.length) {
    throw new Error('No valid recipients')
  }

  // Add unsubscribe link to body
  const htmlWithUnsubscribe = addUnsubscribeLink(
    campaign.html_body,
    params.organizationId,
    params.campaignId
  )

  // Queue emails
  const result = await queueBulkEmails({
    organizationId: params.organizationId,
    recipients: recipients.map(r => ({
      email: r.primary_email,
      name: r.name,
      data: { member_id: r.id, name: r.name },
    })),
    subject: campaign.subject,
    htmlTemplate: htmlWithUnsubscribe,
    campaignId: params.campaignId,
  })

  // Update campaign status
  await supabase
    .from('email_campaigns')
    .update({
      status: 'sending',
      sent_at: new Date().toISOString(),
      stats: { ...campaign.stats, total: result.queued },
    })
    .eq('id', params.campaignId)

  return result
}

/**
 * Add unsubscribe link to email
 */
function addUnsubscribeLink(html: string, orgId: string, campaignId: string): string {
  const unsubscribeUrl = `${process.env.NEXT_PUBLIC_URL}/unsubscribe?org=${orgId}&campaign=${campaignId}&email={{email}}`
  
  const unsubscribeHtml = `
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="color: #9ca3af; font-size: 12px;">
        You received this email because you're subscribed to updates.
        <br>
        <a href="${unsubscribeUrl}" style="color: #6b7280;">Unsubscribe</a> | 
        <a href="${process.env.NEXT_PUBLIC_URL}/preferences?email={{email}}" style="color: #6b7280;">Email Preferences</a>
      </p>
    </div>
  `

  // Insert before closing body tag or at end
  if (html.includes('</body>')) {
    return html.replace('</body>', `${unsubscribeHtml}</body>`)
  }
  return html + unsubscribeHtml
}

/**
 * Handle unsubscribe
 */
export async function handleUnsubscribe(params: {
  organizationId: string
  email: string
  campaignId?: string
  reason?: string
}): Promise<void> {
  const supabase = createAdminClient()

  // Update member opt-in status
  await supabase
    .from('member_organizations')
    .update({ email_opt_in: false })
    .eq('organization_id', params.organizationId)
    .eq('primary_email', params.email)

  // Log the unsubscribe
  await supabase.from('email_unsubscribes').insert({
    organization_id: params.organizationId,
    email: params.email,
    campaign_id: params.campaignId,
    reason: params.reason,
  })

  // Update campaign stats
  if (params.campaignId) {
    await supabase.rpc('increment_campaign_stat', {
      campaign_id: params.campaignId,
      stat_name: 'unsubscribed',
    })
  }
}

/**
 * Track email opens (via pixel)
 */
export async function trackOpen(params: {
  campaignId: string
  recipientEmail: string
}): Promise<void> {
  const supabase = createAdminClient()

  await supabase.from('email_opens').insert({
    campaign_id: params.campaignId,
    email: params.recipientEmail,
  })

  await supabase.rpc('increment_campaign_stat', {
    campaign_id: params.campaignId,
    stat_name: 'opened',
  })
}

/**
 * Track link clicks
 */
export async function trackClick(params: {
  campaignId: string
  recipientEmail: string
  url: string
}): Promise<void> {
  const supabase = createAdminClient()

  await supabase.from('email_clicks').insert({
    campaign_id: params.campaignId,
    email: params.recipientEmail,
    url: params.url,
  })

  await supabase.rpc('increment_campaign_stat', {
    campaign_id: params.campaignId,
    stat_name: 'clicked',
  })
}
