import Stripe from 'stripe'

// Initialize Stripe - let SDK use its default API version
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
})

/**
 * Format cents to dollars for display
 */
export function formatCurrency(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

/**
 * Convert dollars to cents
 */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100)
}

/**
 * Create or retrieve a Stripe customer
 */
export async function getOrCreateCustomer(
  email: string,
  name?: string,
  metadata?: Stripe.MetadataParam
): Promise<Stripe.Customer> {
  // Check if customer already exists
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  })

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0]
  }

  // Create new customer
  return stripe.customers.create({
    email,
    name,
    metadata,
  })
}

/**
 * Create a checkout session for membership
 */
export async function createMembershipCheckout({
  customerId,
  priceId,
  successUrl,
  cancelUrl,
  metadata,
}: {
  customerId: string
  priceId: string
  successUrl: string
  cancelUrl: string
  metadata?: Stripe.MetadataParam
}): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    subscription_data: {
      metadata,
    },
  })
}

/**
 * Create a checkout session for one-time payment (donation, event ticket)
 */
export async function createPaymentCheckout({
  customerId,
  amountCents,
  description,
  successUrl,
  cancelUrl,
  metadata,
}: {
  customerId?: string
  amountCents: number
  description: string
  successUrl: string
  cancelUrl: string
  metadata?: Stripe.MetadataParam
}): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: {
            name: description,
          },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    payment_intent_data: {
      metadata,
    },
  })
}

/**
 * Create a recurring donation subscription
 */
export async function createRecurringDonation({
  customerId,
  amountCents,
  interval = 'month',
  metadata,
}: {
  customerId: string
  amountCents: number
  interval?: 'month' | 'year'
  metadata?: Stripe.MetadataParam
}): Promise<Stripe.Subscription> {
  // Create a price for this donation amount
  const price = await stripe.prices.create({
    currency: 'usd',
    unit_amount: amountCents,
    recurring: { interval },
    product_data: {
      name: `Monthly Donation - ${formatCurrency(amountCents)}`,
    },
  })

  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: price.id }],
    metadata,
  })
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  cancelAtPeriodEnd = true
): Promise<Stripe.Subscription> {
  if (cancelAtPeriodEnd) {
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    })
  }
  return stripe.subscriptions.cancel(subscriptionId)
}

/**
 * Create a billing portal session
 */
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })
}

/**
 * Verify a webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret)
}

/**
 * Create a product and price in Stripe (for membership plans)
 */
export async function createProductWithPrice({
  name,
  description,
  amountCents,
  interval = 'year',
  metadata,
}: {
  name: string
  description?: string
  amountCents: number
  interval?: 'month' | 'year'
  metadata?: Stripe.MetadataParam
}): Promise<{ product: Stripe.Product; price: Stripe.Price }> {
  const product = await stripe.products.create({
    name,
    description,
    metadata,
  })

  const price = await stripe.prices.create({
    product: product.id,
    currency: 'usd',
    unit_amount: amountCents,
    recurring: { interval },
    metadata,
  })

  return { product, price }
}

/**
 * Issue a refund
 */
export async function createRefund(
  paymentIntentId: string,
  amountCents?: number,
  reason?: Stripe.RefundCreateParams.Reason
): Promise<Stripe.Refund> {
  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: amountCents,
    reason,
  })
}
