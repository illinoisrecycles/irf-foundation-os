import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { requireOrgContext, requireFinanceRole, handleAuthError, logAudit } from '@/lib/auth/org-context'
import { emitEvents } from '@/lib/automation/event-emitter'

/**
 * Donations API - Secure Multi-Tenant Implementation
 * 
 * Security:
 * - Uses requireOrgContext() - never trusts orgId from params
 * - Finance role required for POST
 * - Full audit logging
 * - RLS as backup layer
 */

async function createSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseClient()
    const ctx = await requireOrgContext(supabase, req)

    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')
    const fundId = url.searchParams.get('fundId')
    const limit = parseInt(url.searchParams.get('limit') || '100')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    let query = supabase
      .from('donations')
      .select(`
        *,
        donor_profile:profiles!donor_profile_id(id, email, full_name, avatar_url),
        fund:funds(id, name)
      `, { count: 'exact' })
      .eq('organization_id', ctx.organizationId)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (startDate) query = query.gte('created_at', startDate)
    if (endDate) query = query.lte('created_at', endDate)
    if (fundId) query = query.eq('fund_id', fundId)

    const { data, error, count } = await query.range(offset, offset + limit - 1)

    if (error) {
      console.error('Donations fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calculate summary stats
    const summary = {
      total_count: count || 0,
      total_amount_cents: data?.reduce((sum, d) => sum + (d.amount_cents || 0), 0) || 0,
      average_amount_cents: data?.length 
        ? Math.round(data.reduce((sum, d) => sum + (d.amount_cents || 0), 0) / data.length)
        : 0,
    }

    return NextResponse.json({ 
      donations: data || [],
      summary,
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit,
      }
    })

  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseClient()
    const ctx = await requireOrgContext(supabase, req)
    
    // Require finance role for creating donations
    requireFinanceRole(ctx)

    const body = await req.json()

    // Validate required fields
    if (!body.amount_cents || body.amount_cents <= 0) {
      return NextResponse.json({ error: 'Valid amount_cents is required' }, { status: 400 })
    }

    if (!body.donor_email && !body.donor_profile_id) {
      return NextResponse.json({ error: 'Either donor_email or donor_profile_id is required' }, { status: 400 })
    }

    // Check if this is first donation from this donor
    let isFirstDonation = false
    if (body.donor_email) {
      const { count } = await supabase
        .from('donations')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', ctx.organizationId)
        .eq('donor_email', body.donor_email)

      isFirstDonation = count === 0
    }

    // Create donation
    const { data: donation, error } = await supabase
      .from('donations')
      .insert({
        organization_id: ctx.organizationId,
        donor_profile_id: body.donor_profile_id || null,
        donor_email: body.donor_email,
        donor_name: body.donor_name || null,
        amount_cents: body.amount_cents,
        currency: body.currency || 'USD',
        status: body.status || 'succeeded',
        payment_method: body.payment_method || 'manual',
        fund_id: body.fund_id || null,
        campaign_id: body.campaign_id || null,
        is_recurring: body.is_recurring || false,
        is_anonymous: body.is_anonymous || false,
        notes: body.notes || null,
        tribute_type: body.tribute_type || null,
        tribute_name: body.tribute_name || null,
        source: body.source || 'admin',
      })
      .select(`
        *,
        donor_profile:profiles!donor_profile_id(id, email, full_name),
        fund:funds(id, name)
      `)
      .single()

    if (error) {
      console.error('Donation creation error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Audit log
    await logAudit(supabase, {
      organization_id: ctx.organizationId,
      actor_profile_id: ctx.userId,
      action: 'donation.create',
      entity_type: 'donations',
      entity_id: donation.id,
      metadata: {
        amount_cents: donation.amount_cents,
        donor_email: donation.donor_email,
        source: 'admin_manual',
      },
    })

    // Emit automation event
    try {
      await emitEvents.donationCreated(ctx.organizationId, {
        donation_id: donation.id,
        donor_email: donation.donor_email,
        donor_name: donation.donor_name,
        amount_cents: donation.amount_cents,
        is_first_donation: isFirstDonation,
        is_recurring: donation.is_recurring,
      })
    } catch (e) {
      console.error('Failed to emit donation event:', e)
    }

    return NextResponse.json({ donation })

  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createSupabaseClient()
    const ctx = await requireOrgContext(supabase, req)
    requireFinanceRole(ctx)

    const body = await req.json()

    if (!body.id) {
      return NextResponse.json({ error: 'Donation ID required' }, { status: 400 })
    }

    // Verify donation belongs to this org
    const { data: existing } = await supabase
      .from('donations')
      .select('id, organization_id')
      .eq('id', body.id)
      .eq('organization_id', ctx.organizationId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Donation not found' }, { status: 404 })
    }

    // Update allowed fields only
    const updateData: Record<string, any> = {}
    const allowedFields = ['donor_name', 'notes', 'fund_id', 'campaign_id', 'tribute_type', 'tribute_name', 'is_anonymous']
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const { data: donation, error } = await supabase
      .from('donations')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAudit(supabase, {
      organization_id: ctx.organizationId,
      actor_profile_id: ctx.userId,
      action: 'donation.update',
      entity_type: 'donations',
      entity_id: donation.id,
      metadata: { changes: updateData },
    })

    return NextResponse.json({ donation })

  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
