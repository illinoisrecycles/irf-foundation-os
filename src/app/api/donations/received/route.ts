import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkDonorTier } from '@/lib/automation/foundation-recipes'

// ============================================================================
// DONATION RECEIVED WEBHOOK / API
// Creates donation, triggers donor tier check, queues thank-you
// ============================================================================

export async function POST(req: Request) {
  const supabase = createAdminClient()
  const body = await req.json()

  const {
    organization_id,
    donor_member_id,
    donor_email,
    donor_name,
    amount_cents,
    currency = 'usd',
    purpose,
    campaign_id,
    is_recurring = false,
    payment_method,
    stripe_payment_intent_id,
    notes,
  } = body

  if (!organization_id || !amount_cents) {
    return NextResponse.json({ 
      error: 'organization_id and amount_cents required' 
    }, { status: 400 })
  }

  // Create the donation record
  const { data: donation, error: donationError } = await supabase
    .from('donations')
    .insert({
      organization_id,
      donor_member_id,
      donor_email,
      donor_name,
      amount_cents,
      currency,
      purpose,
      campaign_id,
      is_recurring,
      payment_method,
      stripe_payment_intent_id,
      notes,
      status: 'completed',
    })
    .select()
    .single()

  if (donationError) {
    return NextResponse.json({ error: donationError.message }, { status: 500 })
  }

  let tierUpgrade = null

  // Check donor tier if we have a member ID
  if (donor_member_id) {
    tierUpgrade = await checkDonorTier(organization_id, {
      id: donation.id,
      donor_member_id,
      amount_cents,
      donor_email,
    })

    // Update last activity
    await supabase
      .from('member_organizations')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', donor_member_id)
  }

  // Queue thank-you email
  const recipientEmail = donor_email || (donor_member_id ? 
    (await supabase.from('member_organizations').select('primary_contact_email').eq('id', donor_member_id).single()).data?.primary_contact_email 
    : null)

  if (recipientEmail) {
    await supabase.from('email_outbox').insert({
      organization_id,
      to_email: recipientEmail,
      subject: 'Thank you for your generous donation!',
      template_type: 'donation_thank_you',
      merge_data: {
        donor_name: donor_name || 'Valued Supporter',
        amount: `$${(amount_cents / 100).toFixed(2)}`,
        purpose: purpose || 'General Support',
        donation_id: donation.id,
        date: new Date().toLocaleDateString(),
      },
      status: 'pending',
    })
  }

  // Create work item if major gift
  if (amount_cents >= 100000) { // $1,000+
    await supabase.from('work_items').insert({
      organization_id,
      item_type: 'major_gift',
      title: `Major gift received: $${(amount_cents / 100).toFixed(2)} from ${donor_name || 'Anonymous'}`,
      description: 'Personal thank-you call recommended for major gift.',
      priority: 'high',
      due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days
      metadata: {
        donation_id: donation.id,
        amount_cents,
        donor_member_id,
      },
    })
  }

  // Queue automation event
  await supabase.from('automation_queue').insert({
    organization_id,
    event_type: 'donation.received',
    payload: {
      donation_id: donation.id,
      donor_member_id,
      donor_email: recipientEmail,
      donor_name,
      amount_cents,
      purpose,
      is_major_gift: amount_cents >= 100000,
    },
  })

  // Create ledger entry for the donation
  await supabase.from('ledger_entries').insert({
    organization_id,
    entry_type: 'credit',
    amount_cents,
    description: `Donation from ${donor_name || 'Anonymous'}${purpose ? ` - ${purpose}` : ''}`,
    account_code: '4100', // Donation revenue
    reference_type: 'donation',
    reference_id: donation.id,
    entry_date: new Date().toISOString(),
    posted: true,
    posted_at: new Date().toISOString(),
  })

  return NextResponse.json({
    success: true,
    donation,
    tier_upgrade: tierUpgrade,
    thank_you_queued: !!recipientEmail,
    major_gift_flagged: amount_cents >= 100000,
  })
}
