import { Resend } from 'resend'

// Lazy-load Resend to avoid build errors when API key is not set
let resend: Resend | null = null

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@foundation-os.app'
const ORG_NAME = process.env.NEXT_PUBLIC_ORG_NAME || 'FoundationOS'

export type EmailTemplate = 
  | 'membership-renewal-reminder'
  | 'membership-renewed'
  | 'membership-expired'
  | 'donation-receipt'
  | 'donation-thankyou'
  | 'event-confirmation'
  | 'event-reminder'
  | 'payment-failed'
  | 'welcome'

type SendEmailParams = {
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
}

export async function sendEmail({ to, subject, html, text, replyTo }: SendEmailParams) {
  const client = getResend()
  
  if (!client) {
    console.log('[Email] Resend not configured, skipping email to:', to)
    console.log('[Email] Subject:', subject)
    return { success: true, mock: true }
  }

  try {
    const { data, error } = await client.emails.send({
      from: `${ORG_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      html,
      text,
      replyTo,
    })

    if (error) {
      console.error('[Email] Failed to send:', error)
      return { success: false, error }
    }

    return { success: true, id: data?.id }
  } catch (err) {
    console.error('[Email] Exception:', err)
    return { success: false, error: err }
  }
}

// Membership Emails
export async function sendMembershipRenewalReminder({
  to, memberName, planName, expiresAt, renewalLink, daysUntilExpiry,
}: {
  to: string; memberName: string; planName: string; expiresAt: string; renewalLink: string; daysUntilExpiry: number
}) {
  const urgency = daysUntilExpiry <= 7 ? 'urgent' : daysUntilExpiry <= 14 ? 'soon' : 'upcoming'
  const urgencyText = { urgent: '⚠️ Expires in less than a week!', soon: 'Expires in 2 weeks', upcoming: 'Renewal coming up' }[urgency]

  return sendEmail({
    to,
    subject: `${urgencyText} - Renew your ${ORG_NAME} membership`,
    html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Membership Renewal Reminder</h2>
      <p>Hi ${memberName},</p>
      <p>Your <strong>${planName}</strong> membership expires on <strong>${new Date(expiresAt).toLocaleDateString()}</strong>.</p>
      <a href="${renewalLink}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Renew Membership</a>
      <p style="color: #666; font-size: 14px;">${ORG_NAME}</p>
    </div>`,
  })
}

export async function sendMembershipRenewedConfirmation({
  to, memberName, planName, newExpiresAt, amountPaid,
}: {
  to: string; memberName: string; planName: string; newExpiresAt: string; amountPaid: string
}) {
  return sendEmail({
    to,
    subject: `✅ Membership Renewed - ${ORG_NAME}`,
    html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">🎉 Thank You for Renewing!</h2>
      <p>Hi ${memberName},</p>
      <p>Your <strong>${planName}</strong> membership has been renewed.</p>
      <p><strong>Amount paid:</strong> ${amountPaid}</p>
      <p><strong>New expiration:</strong> ${new Date(newExpiresAt).toLocaleDateString()}</p>
      <p>${ORG_NAME}</p>
    </div>`,
  })
}

// Donation Emails
export async function sendDonationReceipt({
  to, donorName, amount, donationDate, transactionId, taxDeductible = true, organizationEIN,
}: {
  to: string; donorName: string; amount: string; donationDate: string; transactionId: string; taxDeductible?: boolean; organizationEIN?: string
}) {
  return sendEmail({
    to,
    subject: `Donation Receipt - ${ORG_NAME}`,
    html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Donation Receipt</h2>
      <p>Dear ${donorName},</p>
      <p>Thank you for your donation to ${ORG_NAME}!</p>
      <p><strong>Amount:</strong> ${amount}</p>
      <p><strong>Date:</strong> ${new Date(donationDate).toLocaleDateString()}</p>
      <p><strong>Transaction ID:</strong> ${transactionId}</p>
      ${taxDeductible ? `<p style="font-size: 12px; color: #666;">This donation may be tax-deductible. ${organizationEIN ? `EIN: ${organizationEIN}` : ''}</p>` : ''}
      <p>${ORG_NAME}</p>
    </div>`,
  })
}

export async function sendDonationThankYou({
  to, donorName, amount, impactMessage,
}: {
  to: string; donorName: string; amount: string; impactMessage?: string
}) {
  return sendEmail({
    to,
    subject: `Thank You for Your Gift! - ${ORG_NAME}`,
    html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">💚 Thank You!</h2>
      <p>Dear ${donorName},</p>
      <p>We are grateful for your donation of <strong>${amount}</strong>.</p>
      <p>${impactMessage || 'Your contribution supports our mission.'}</p>
      <p>The ${ORG_NAME} Team</p>
    </div>`,
  })
}

// Event Emails
export async function sendEventConfirmation({
  to, attendeeName, eventTitle, eventDate, eventLocation, virtualUrl, ticketType, confirmationCode,
}: {
  to: string; attendeeName: string; eventTitle: string; eventDate: string; eventLocation?: string; virtualUrl?: string; ticketType: string; confirmationCode: string
}) {
  return sendEmail({
    to,
    subject: `Registration Confirmed: ${eventTitle}`,
    html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">✅ You're Registered!</h2>
      <p>Hi ${attendeeName},</p>
      <p>Your registration for <strong>${eventTitle}</strong> is confirmed!</p>
      <p><strong>Date:</strong> ${new Date(eventDate).toLocaleDateString()}</p>
      ${eventLocation ? `<p><strong>Location:</strong> ${eventLocation}</p>` : ''}
      ${virtualUrl ? `<p><strong>Join:</strong> <a href="${virtualUrl}">${virtualUrl}</a></p>` : ''}
      <p><strong>Ticket:</strong> ${ticketType}</p>
      <p><strong>Confirmation:</strong> ${confirmationCode}</p>
      <p>${ORG_NAME}</p>
    </div>`,
  })
}

export async function sendEventReminder({
  to, attendeeName, eventTitle, eventDate, eventLocation, virtualUrl, daysUntilEvent,
}: {
  to: string; attendeeName: string; eventTitle: string; eventDate: string; eventLocation?: string; virtualUrl?: string; daysUntilEvent: number
}) {
  const timeText = daysUntilEvent === 0 ? 'Today!' : daysUntilEvent === 1 ? 'Tomorrow!' : `In ${daysUntilEvent} days`
  return sendEmail({
    to,
    subject: `Reminder: ${eventTitle} - ${timeText}`,
    html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">📅 Event Reminder</h2>
      <p>Hi ${attendeeName},</p>
      <p><strong>${eventTitle}</strong> is ${timeText.toLowerCase()}!</p>
      <p><strong>Date:</strong> ${new Date(eventDate).toLocaleDateString()}</p>
      ${eventLocation ? `<p><strong>Location:</strong> ${eventLocation}</p>` : ''}
      ${virtualUrl ? `<p><strong>Join:</strong> <a href="${virtualUrl}">${virtualUrl}</a></p>` : ''}
      <p>${ORG_NAME}</p>
    </div>`,
  })
}

// Payment Emails
export async function sendPaymentFailedNotice({
  to, memberName, amount, failureReason, updatePaymentLink,
}: {
  to: string; memberName: string; amount: string; failureReason?: string; updatePaymentLink: string
}) {
  return sendEmail({
    to,
    subject: `⚠️ Payment Failed - Action Required`,
    html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Payment Failed</h2>
      <p>Hi ${memberName},</p>
      <p>We couldn't process your payment of <strong>${amount}</strong>.</p>
      ${failureReason ? `<p style="color: #666;">Reason: ${failureReason}</p>` : ''}
      <a href="${updatePaymentLink}" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Update Payment Method</a>
      <p>${ORG_NAME}</p>
    </div>`,
  })
}
