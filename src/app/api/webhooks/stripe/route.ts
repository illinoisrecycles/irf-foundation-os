import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { emitAutomationEvent } from '@/lib/automation/event-emitter'

/**
 * Stripe Webhook Handler with Idempotency
 * 
 * Features:
 * - Signature verification
 * - Idempotency (prevents duplicate processing)
 * - Dot-notation event taxonomy (donation.created, membership.renewed, etc.)
 * - Comprehensive logging
 */

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: Request) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event: Stripe.Event

  // 1. Verify signature
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // 2. Check idempotency - prevent duplicate processing
  const isProcessed = await checkIdempotency('stripe', event.id)
  if (isProcessed) {
    console.log(`Webhook ${event.id} already processed, skipping`)
    return NextResponse.json({ received: true, skipped: true })
  }

  // 3. Process event
  let result: string = 'unhandled'
  let metadata: Record<string, any> = {}

  try {
    switch (event.type) {
      // ===== CHECKOUT COMPLETIONS =====
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const sessionMetadata = session.metadata || {}

        if (sessionMetadata.type === 'donation') {
          result = await handleDonation(session)
        } else if (sessionMetadata.type === 'membership') {
          result = await handleMembershipPayment(session)
        } else if (sessionMetadata.type === 'event') {
          result = await handleEventPayment(session)
        }
        metadata = { session_id: session.id, type: sessionMetadata.type }
        break
      }

      // ===== SUBSCRIPTION EVENTS =====
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.subscription) {
          result = await handleSubscriptionRenewal(invoice)
          metadata = { invoice_id: invoice.id, subscription_id: invoice.subscription }
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        result = await handlePaymentFailed(invoice)
        metadata = { invoice_id: invoice.id }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        result = await handleSubscriptionCanceled(subscription)
        metadata = { subscription_id: subscription.id }
        break
      }

      // ===== PAYMENT INTENTS =====
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        // Record for ledger reconciliation
        await recordPayment(paymentIntent)
        result = 'success'
        metadata = { payment_intent_id: paymentIntent.id }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    // 4. Mark as processed
    await markProcessed('stripe', event.id, event.type, result, metadata)

    return NextResponse.json({ received: true, result })

  } catch (error: any) {
    console.error(`Webhook processing error for ${event.id}:`, error)
    await markProcessed('stripe', event.id, event.type, 'error', { error: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ===== IDEMPOTENCY HELPERS =====

async function checkIdempotency(provider: string, eventId: string): Promise<boolean> {
  const { data } = await supabase
    .from('processed_webhook_events')
    .select('event_id')
    .eq('provider', provider)
    .eq('event_id', eventId)
    .single()

  return !!data
}

async function markProcessed(
  provider: string,
  eventId: string,
  eventType: string,
  result: string,
  metadata: Record<string, any> = {}
) {
  await supabase.from('processed_webhook_events').insert({
    provider,
    event_id: eventId,
    event_type: eventType,
    result,
    metadata,
    processed_at: new Date().toISOString(),
  })
}

// ===== EVENT HANDLERS =====

async function handleDonation(session: Stripe.Checkout.Session): Promise<string> {
  const metadata = session.metadata || {}
  const orgId = metadata.organization_id
  const profileId = metadata.profile_id
  const amountCents = session.amount_total || 0

  // Create donation record
  const { data: donation, error } = await supabase
    .from('donations')
    .insert({
      organization_id: orgId,
      donor_profile_id: profileId,
      donor_email: session.customer_email,
      donor_name: session.customer_details?.name,
      amount_cents: amountCents,
      currency: session.currency?.toUpperCase() || 'USD',
      status: 'succeeded',
      payment_method: 'stripe',
      stripe_payment_intent_id: session.payment_intent as string,
      stripe_session_id: session.id,
      is_recurring: session.mode === 'subscription',
      fund_id: metadata.fund_id || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create donation:', error)
    return 'error'
  }

  // Check if first donation
  const { count } = await supabase
    .from('donations')
    .select('id', { count: 'exact', head: true })
    .eq('donor_email', session.customer_email)
    .eq('organization_id', orgId)

  // Emit automation event
  await emitAutomationEvent(orgId, 'donation.created', {
    donation_id: donation.id,
    donor_email: session.customer_email,
    donor_name: session.customer_details?.name,
    donor_profile_id: profileId,
    amount_cents: amountCents,
    amount_dollars: (amountCents / 100).toFixed(2),
    is_first_donation: count === 1,
    is_recurring: session.mode === 'subscription',
    fund_id: metadata.fund_id,
  })

  return 'success'
}

async function handleMembershipPayment(session: Stripe.Checkout.Session): Promise<string> {
  const metadata = session.metadata || {}
  const orgId = metadata.organization_id
  const memberOrgId = metadata.member_org_id
  const membershipTypeId = metadata.membership_type_id

  // Get membership type for renewal period
  const { data: membershipType } = await supabase
    .from('membership_types')
    .select('duration_months')
    .eq('id', membershipTypeId)
    .single()

  const durationMonths = membershipType?.duration_months || 12
  const newExpiryDate = new Date()
  newExpiryDate.setMonth(newExpiryDate.getMonth() + durationMonths)

  // Update membership
  const { data: member, error } = await supabase
    .from('member_organizations')
    .update({
      status: 'active',
      expires_at: newExpiryDate.toISOString(),
      stripe_subscription_id: session.subscription as string,
    })
    .eq('id', memberOrgId)
    .select('*, profile:profiles(email, full_name)')
    .single()

  if (error) {
    console.error('Failed to update membership:', error)
    return 'error'
  }

  // Emit automation event
  await emitAutomationEvent(orgId, 'membership.renewed', {
    member_org_id: memberOrgId,
    member_email: member.profile?.email || session.customer_email,
    member_name: member.profile?.full_name || member.organization_name,
    membership_type_id: membershipTypeId,
    expires_at: newExpiryDate.toISOString(),
    amount_cents: session.amount_total,
    stripe_subscription_id: session.subscription,
  })

  return 'success'
}

async function handleEventPayment(session: Stripe.Checkout.Session): Promise<string> {
  const metadata = session.metadata || {}
  const orgId = metadata.organization_id
  const eventId = metadata.event_id
  const registrationId = metadata.registration_id

  // Update registration to paid
  const { error } = await supabase
    .from('event_registrations')
    .update({
      status: 'confirmed',
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: session.payment_intent as string,
    })
    .eq('id', registrationId)

  if (error) {
    console.error('Failed to update registration:', error)
    return 'error'
  }

  // Increment event registered count
  await supabase.rpc('increment_event_count', { 
    event_id: eventId, 
    column_name: 'registered_count' 
  })

  // Emit automation event
  await emitAutomationEvent(orgId, 'event.registration.paid', {
    registration_id: registrationId,
    event_id: eventId,
    registrant_email: session.customer_email,
    registrant_name: session.customer_details?.name,
    amount_cents: session.amount_total,
  })

  return 'success'
}

async function handleSubscriptionRenewal(invoice: Stripe.Invoice): Promise<string> {
  // Get subscription metadata
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
  const metadata = subscription.metadata || {}
  const orgId = metadata.organization_id
  const memberOrgId = metadata.member_org_id

  if (!memberOrgId) return 'skipped'

  // Get membership type for renewal period
  const { data: membershipType } = await supabase
    .from('membership_types')
    .select('duration_months')
    .eq('id', metadata.membership_type_id)
    .single()

  const durationMonths = membershipType?.duration_months || 12
  const newExpiryDate = new Date()
  newExpiryDate.setMonth(newExpiryDate.getMonth() + durationMonths)

  // Update membership
  const { data: member, error } = await supabase
    .from('member_organizations')
    .update({
      status: 'active',
      expires_at: newExpiryDate.toISOString(),
    })
    .eq('id', memberOrgId)
    .select('*, profile:profiles(email, full_name)')
    .single()

  if (error) {
    console.error('Failed to update membership on renewal:', error)
    return 'error'
  }

  // Emit automation event
  await emitAutomationEvent(orgId, 'membership.renewed', {
    member_org_id: memberOrgId,
    member_email: member.profile?.email || invoice.customer_email,
    member_name: member.profile?.full_name || member.organization_name,
    expires_at: newExpiryDate.toISOString(),
    amount_cents: invoice.amount_paid,
    stripe_subscription_id: invoice.subscription,
    is_auto_renewal: true,
  })

  return 'success'
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<string> {
  const subscription = invoice.subscription 
    ? await stripe.subscriptions.retrieve(invoice.subscription as string)
    : null

  const metadata = subscription?.metadata || {}
  const orgId = metadata.organization_id
  const memberOrgId = metadata.member_org_id

  if (!orgId || !memberOrgId) return 'skipped'

  // Get member info
  const { data: member } = await supabase
    .from('member_organizations')
    .select('*, profile:profiles(email, full_name)')
    .eq('id', memberOrgId)
    .single()

  if (!member) return 'skipped'

  // Emit automation event
  await emitAutomationEvent(orgId, 'payment.failed', {
    member_org_id: memberOrgId,
    member_email: member.profile?.email || invoice.customer_email,
    member_name: member.profile?.full_name || member.organization_name,
    invoice_id: invoice.id,
    amount_cents: invoice.amount_due,
    attempt_count: invoice.attempt_count,
    billing_url: `${process.env.NEXT_PUBLIC_APP_URL}/portal/billing`,
  })

  return 'success'
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription): Promise<string> {
  const metadata = subscription.metadata || {}
  const orgId = metadata.organization_id
  const memberOrgId = metadata.member_org_id

  if (!memberOrgId) return 'skipped'

  // Update membership status
  const { data: member, error } = await supabase
    .from('member_organizations')
    .update({
      status: 'expired',
      stripe_subscription_id: null,
    })
    .eq('id', memberOrgId)
    .select('*, profile:profiles(email, full_name)')
    .single()

  if (error) {
    console.error('Failed to update membership on cancellation:', error)
    return 'error'
  }

  // Emit automation event
  await emitAutomationEvent(orgId, 'membership.expired', {
    member_org_id: memberOrgId,
    member_email: member.profile?.email,
    member_name: member.profile?.full_name || member.organization_name,
    reason: 'subscription_canceled',
  })

  return 'success'
}

async function recordPayment(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  // Record for ledger/reconciliation
  await supabase.from('payment_records').upsert({
    stripe_payment_intent_id: paymentIntent.id,
    amount_cents: paymentIntent.amount,
    currency: paymentIntent.currency.toUpperCase(),
    status: paymentIntent.status,
    created_at: new Date(paymentIntent.created * 1000).toISOString(),
    metadata: paymentIntent.metadata,
  }, { onConflict: 'stripe_payment_intent_id' })
}
