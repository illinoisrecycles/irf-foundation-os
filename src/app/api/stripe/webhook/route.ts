import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMembershipRenewedConfirmation, sendDonationReceipt, sendPaymentFailedNotice } from '@/lib/email'
import { triggerWebhooks } from '@/lib/webhooks'
import { triggerEvent } from '@/lib/automation'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' })
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: Request) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    // ========================================================================
    // IDEMPOTENCY CHECK - Prevent duplicate processing
    // ========================================================================
    const { data: existingEvent } = await supabase
      .from('payments')
      .select('id')
      .eq('stripe_event_id', event.id)
      .single()

    if (existingEvent) {
      console.log('[Stripe Webhook] Already processed event:', event.id)
      return NextResponse.json({ received: true, duplicate: true })
    }

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // Idempotency: Check if payment intent already processed
        if (session.payment_intent) {
          const { data: existingPayment } = await supabase
            .from('payments')
            .select('id')
            .eq('stripe_payment_intent_id', session.payment_intent)
            .single()

          if (existingPayment) {
            console.log('[Stripe Webhook] Payment already recorded:', session.payment_intent)
            return NextResponse.json({ received: true, duplicate: true })
          }
        }

        const metadata = session.metadata || {}
        const paymentType = metadata.payment_type || 'other'
        const orgId = metadata.organization_id

        // Record payment with event ID for idempotency
        const { data: payment } = await supabase
          .from('payments')
          .insert({
            organization_id: orgId,
            member_organization_id: metadata.member_organization_id,
            amount_cents: session.amount_total || 0,
            currency: session.currency || 'usd',
            payment_type: paymentType,
            stripe_payment_intent_id: session.payment_intent as string,
            stripe_event_id: event.id, // For idempotency
            status: 'succeeded',
          })
          .select()
          .single()

        // Handle membership payments
        if (paymentType === 'membership' && metadata.member_organization_id) {
          const planDuration = parseInt(metadata.plan_duration_months || '12')
          const newExpiresAt = new Date()
          newExpiresAt.setMonth(newExpiresAt.getMonth() + planDuration)

          await supabase
            .from('member_organizations')
            .update({
              membership_status: 'active',
              expires_at: newExpiresAt.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', metadata.member_organization_id)

          // Send confirmation email
          if (session.customer_email) {
            await sendMembershipRenewedConfirmation({
              to: session.customer_email,
              memberName: metadata.member_name || 'Member',
              planName: metadata.plan_name || 'Membership',
              newExpiresAt: newExpiresAt.toISOString(),
              amountPaid: `$${((session.amount_total || 0) / 100).toFixed(2)}`,
            })
          }

          // Trigger automation
          if (orgId) {
            await triggerEvent(supabase, orgId, 'member_renewed', {
              member_organization_id: metadata.member_organization_id,
              amount_cents: session.amount_total,
              email: session.customer_email,
            })

            // Trigger external webhooks
            await triggerWebhooks(supabase, orgId, 'member.renewed', {
              member_id: metadata.member_organization_id,
              amount: session.amount_total,
              email: session.customer_email,
            })
          }
        }

        // Handle donations
        if (paymentType === 'donation' && orgId) {
          const { data: donation } = await supabase
            .from('donations')
            .insert({
              organization_id: orgId,
              donor_member_id: metadata.member_organization_id,
              donor_name: metadata.donor_name || session.customer_details?.name,
              donor_email: session.customer_email,
              amount_cents: session.amount_total || 0,
              campaign_id: metadata.campaign_id,
              is_recurring: false,
              payment_id: payment?.id,
            })
            .select()
            .single()

          // Send receipt
          if (session.customer_email && donation) {
            await sendDonationReceipt({
              to: session.customer_email,
              donorName: donation.donor_name || 'Donor',
              amount: `$${((session.amount_total || 0) / 100).toFixed(2)}`,
              donationDate: new Date().toISOString(),
              transactionId: donation.id,
            })
          }

          // Trigger automation
          await triggerEvent(supabase, orgId, 'donation_created', {
            donation_id: donation?.id,
            amount_cents: session.amount_total,
            donor_email: session.customer_email,
            is_first_donation: !metadata.member_organization_id,
          })

          // Trigger external webhooks
          await triggerWebhooks(supabase, orgId, 'donation.created', {
            donation_id: donation?.id,
            amount: session.amount_total,
            donor_name: donation?.donor_name,
            donor_email: session.customer_email,
          })
        }

        // Handle event registrations
        if (paymentType === 'event' && metadata.event_id) {
          await supabase
            .from('event_registrations')
            .update({ payment_status: 'paid' })
            .eq('event_id', metadata.event_id)
            .eq('attendee_email', session.customer_email)

          // Trigger automation
          if (orgId) {
            await triggerEvent(supabase, orgId, 'event_registration_paid', {
              event_id: metadata.event_id,
              email: session.customer_email,
              amount_cents: session.amount_total,
            })
          }
        }

        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.subscription) {
          // Handle subscription renewal
          const metadata = invoice.metadata || {}
          const orgId = metadata.organization_id

          if (metadata.member_organization_id) {
            const planDuration = parseInt(metadata.plan_duration_months || '12')
            const newExpiresAt = new Date()
            newExpiresAt.setMonth(newExpiresAt.getMonth() + planDuration)

            await supabase
              .from('member_organizations')
              .update({
                membership_status: 'active',
                expires_at: newExpiresAt.toISOString(),
              })
              .eq('id', metadata.member_organization_id)
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const metadata = invoice.metadata || {}
        const orgId = metadata.organization_id

        // Record failed payment
        await supabase.from('payments').insert({
          organization_id: orgId,
          member_organization_id: metadata.member_organization_id,
          amount_cents: invoice.amount_due || 0,
          currency: invoice.currency || 'usd',
          payment_type: 'membership',
          stripe_event_id: event.id,
          status: 'failed',
        })

        // Create work item for staff follow-up
        if (orgId) {
          await supabase.from('work_items').insert({
            organization_id: orgId,
            item_type: 'alert',
            title: `Payment failed for ${metadata.member_name || 'member'}`,
            description: `Invoice payment of $${(invoice.amount_due / 100).toFixed(2)} failed. Please follow up.`,
            priority: 'high',
            reference_type: 'member',
            reference_id: metadata.member_organization_id,
            dedupe_key: `payment_failed_${invoice.id}`,
          })
        }

        // Send notification email
        if (invoice.customer_email) {
          await sendPaymentFailedNotice({
            to: invoice.customer_email,
            memberName: metadata.member_name || 'Member',
            amount: `$${(invoice.amount_due / 100).toFixed(2)}`,
            updatePaymentLink: `${process.env.NEXT_PUBLIC_URL}/portal/billing`,
          })
        }

        // Trigger automation
        if (orgId) {
          await triggerEvent(supabase, orgId, 'payment_failed', {
            member_organization_id: metadata.member_organization_id,
            amount_cents: invoice.amount_due,
            email: invoice.customer_email,
          })

          await triggerWebhooks(supabase, orgId, 'payment.failed', {
            member_id: metadata.member_organization_id,
            amount: invoice.amount_due,
            email: invoice.customer_email,
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const metadata = subscription.metadata || {}

        if (metadata.member_organization_id) {
          await supabase
            .from('member_organizations')
            .update({ membership_status: 'expired' })
            .eq('id', metadata.member_organization_id)

          // Trigger automation
          if (metadata.organization_id) {
            await triggerEvent(supabase, metadata.organization_id, 'member_expired', {
              member_organization_id: metadata.member_organization_id,
            })

            await triggerWebhooks(supabase, metadata.organization_id, 'member.expired', {
              member_id: metadata.member_organization_id,
            })
          }
        }
        break
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute
        // Create urgent work item for disputes
        const { data: payment } = await supabase
          .from('payments')
          .select('organization_id, member_organization_id')
          .eq('stripe_payment_intent_id', dispute.payment_intent)
          .single()

        if (payment?.organization_id) {
          await supabase.from('work_items').insert({
            organization_id: payment.organization_id,
            item_type: 'alert',
            title: `⚠️ Payment Dispute - $${(dispute.amount / 100).toFixed(2)}`,
            description: `A charge dispute has been opened. Respond by ${new Date((dispute as any).evidence_details?.due_by * 1000).toLocaleDateString()}.`,
            priority: 'urgent',
            reference_type: 'payment',
            dedupe_key: `dispute_${dispute.id}`,
          })
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('[Stripe Webhook] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
