import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

// ============================================================================
// STRIPE CREATE EVENT CHECKOUT SESSION
// Creates a checkout session for event registration
// ============================================================================

export async function POST(req: Request) {
  const supabase = createAdminClient()
  
  try {
    const body = await req.json()
    
    const {
      event_id,
      attendee_name,
      attendee_email,
      organization,
      ticket_type = 'general',
      quantity = 1,
      metadata = {},
      success_url,
      cancel_url,
    } = body

    if (!event_id || !attendee_email) {
      return NextResponse.json({ 
        error: 'event_id and attendee_email required' 
      }, { status: 400 })
    }

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select(`
        *,
        organization:organizations (id, name, stripe_account_id)
      `)
      .eq('id', event_id)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Check capacity
    if (event.capacity) {
      const { count } = await supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event_id)
        .in('status', ['registered', 'checked_in'])

      if ((count || 0) + quantity > event.capacity) {
        return NextResponse.json({ 
          error: 'Event is at capacity' 
        }, { status: 400 })
      }
    }

    // Determine price
    let pricePerTicket = event.price_cents || 0

    // Check for early bird pricing
    if (event.early_bird_price_cents && event.early_bird_deadline) {
      if (new Date() < new Date(event.early_bird_deadline)) {
        pricePerTicket = event.early_bird_price_cents
      }
    }

    // Check for member pricing (would need to verify member status)
    // For now, use regular pricing

    if (pricePerTicket === 0) {
      // Free event - register directly without Stripe
      const { data: registration, error: regError } = await supabase
        .from('event_registrations')
        .insert({
          organization_id: event.organization_id,
          event_id,
          attendee_name,
          attendee_email,
          organization_name: organization,
          ticket_type,
          quantity,
          amount_cents: 0,
          status: event.requires_approval ? 'pending' : 'registered',
          metadata,
        })
        .select()
        .single()

      if (regError) {
        return NextResponse.json({ error: regError.message }, { status: 500 })
      }

      return NextResponse.json({ 
        registration,
        free: true,
        message: 'Registration complete (free event)',
      })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    
    // Create line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: event.title,
            description: `${new Date(event.start_date).toLocaleDateString()} - ${event.location || 'Virtual'}`,
            ...(event.image_url && { images: [event.image_url] }),
          },
          unit_amount: pricePerTicket,
        },
        quantity,
      },
    ]

    // Create checkout session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      customer_email: attendee_email,
      success_url: success_url || `${baseUrl}/portal/events/${event_id}?registered=true`,
      cancel_url: cancel_url || `${baseUrl}/portal/events/${event_id}?canceled=true`,
      metadata: {
        type: 'event_registration',
        event_id,
        organization_id: event.organization_id,
        attendee_name: attendee_name || '',
        attendee_email,
        attendee_organization: organization || '',
        ticket_type,
        quantity: String(quantity),
        ...metadata,
      },
      // If org has connected Stripe account, use it
      ...(event.organization?.stripe_account_id && {
        payment_intent_data: {
          application_fee_amount: Math.round(pricePerTicket * quantity * 0.02), // 2% platform fee
          transfer_data: {
            destination: event.organization.stripe_account_id,
          },
        },
      }),
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    // Create pending registration
    await supabase.from('event_registrations').insert({
      organization_id: event.organization_id,
      event_id,
      attendee_name,
      attendee_email,
      organization_name: organization,
      ticket_type,
      quantity,
      amount_cents: pricePerTicket * quantity,
      status: 'pending_payment',
      stripe_session_id: session.id,
      metadata,
    })

    return NextResponse.json({ 
      url: session.url,
      session_id: session.id,
    })

  } catch (error: any) {
    console.error('Stripe event checkout error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to create checkout session' 
    }, { status: 500 })
  }
}
