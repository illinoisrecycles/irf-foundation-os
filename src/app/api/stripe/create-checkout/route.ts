import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

// ============================================================================
// STRIPE CREATE CHECKOUT SESSION
// Creates a checkout session for membership purchases
// ============================================================================

export async function POST(req: Request) {
  const supabase = createAdminClient()
  
  try {
    const body = await req.json()
    
    const {
      organization_id,
      membership_plan_id,
      member_name,
      member_email,
      member_organization_id, // Existing member org if renewing
      success_url,
      cancel_url,
    } = body

    if (!organization_id || !membership_plan_id || !member_email) {
      return NextResponse.json({ 
        error: 'organization_id, membership_plan_id, and member_email required' 
      }, { status: 400 })
    }

    // Get membership plan details
    const { data: plan, error: planError } = await supabase
      .from('membership_plans')
      .select('*')
      .eq('id', membership_plan_id)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Membership plan not found' }, { status: 404 })
    }

    // Get organization details for Stripe account
    const { data: org } = await supabase
      .from('organizations')
      .select('name, stripe_account_id')
      .eq('id', organization_id)
      .single()

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    
    // Create line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: plan.name,
            description: plan.description || `${org?.name || 'Organization'} Membership`,
          },
          unit_amount: plan.price_cents,
          ...(plan.billing_interval && plan.billing_interval !== 'one_time' && {
            recurring: {
              interval: plan.billing_interval as 'month' | 'year',
            },
          }),
        },
        quantity: 1,
      },
    ]

    // Create checkout session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: plan.billing_interval && plan.billing_interval !== 'one_time' 
        ? 'subscription' 
        : 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      customer_email: member_email,
      success_url: success_url || `${baseUrl}/portal/membership?success=true`,
      cancel_url: cancel_url || `${baseUrl}/portal/membership?canceled=true`,
      metadata: {
        organization_id,
        membership_plan_id,
        member_name: member_name || '',
        member_email,
        member_organization_id: member_organization_id || '',
        type: 'membership',
      },
      // If org has connected Stripe account, use it
      ...(org?.stripe_account_id && {
        payment_intent_data: {
          application_fee_amount: Math.round(plan.price_cents * 0.02), // 2% platform fee
          transfer_data: {
            destination: org.stripe_account_id,
          },
        },
      }),
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return NextResponse.json({ 
      url: session.url,
      session_id: session.id,
    })

  } catch (error: any) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to create checkout session' 
    }, { status: 500 })
  }
}
