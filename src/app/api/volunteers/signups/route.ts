import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireOrgContext } from '@/lib/auth/org-context'

// GET /api/volunteers/signups
export async function GET(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const { searchParams } = new URL(req.url)
  
  const opportunityId = searchParams.get('opportunity_id')
  const userId = searchParams.get('user_id')
  const status = searchParams.get('status')

  let query = supabase
    .from('volunteer_signups')
    .select(`
      *,
      opportunity:volunteer_opportunities!inner(
        id, title, date_start, location, organization_id
      )
    `)
    .eq('opportunity.organization_id', org.id)

  if (opportunityId) {
    query = query.eq('opportunity_id', opportunityId)
  }
  if (userId) {
    query = query.eq('user_id', userId)
  }
  if (status) {
    query = query.eq('status', status)
  }

  const { data: signups, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ signups })
}

// POST /api/volunteers/signups - Sign up for opportunity
export async function POST(req: Request) {
  const supabase = await createClient()
  const body = await req.json()

  const {
    opportunity_id,
    user_id,
    member_organization_id,
    volunteer_name,
    volunteer_email,
    volunteer_phone,
    notes
  } = body

  if (!opportunity_id) {
    return NextResponse.json({ error: 'Opportunity ID required' }, { status: 400 })
  }

  // Get opportunity to check capacity
  const { data: opportunity } = await supabase
    .from('volunteer_opportunities')
    .select('*')
    .eq('id', opportunity_id)
    .single()

  if (!opportunity) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  if (opportunity.required_volunteers && 
      opportunity.signed_up_count >= opportunity.required_volunteers) {
    return NextResponse.json({ error: 'This opportunity is full' }, { status: 400 })
  }

  // Check for duplicate signup
  const { data: existing } = await supabase
    .from('volunteer_signups')
    .select('id')
    .eq('opportunity_id', opportunity_id)
    .or(`user_id.eq.${user_id},volunteer_email.eq.${volunteer_email}`)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Already signed up for this opportunity' }, { status: 400 })
  }

  const { data: signup, error } = await supabase
    .from('volunteer_signups')
    .insert({
      opportunity_id,
      user_id,
      member_organization_id,
      volunteer_name,
      volunteer_email,
      volunteer_phone,
      notes,
      status: 'confirmed'
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Update signed_up_count
  await supabase
    .from('volunteer_opportunities')
    .update({ signed_up_count: opportunity.signed_up_count + 1 })
    .eq('id', opportunity_id)

  return NextResponse.json({ signup })
}

// PATCH /api/volunteers/signups - Update signup (status, hours)
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const body = await req.json()
  const { id, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: 'Signup ID required' }, { status: 400 })
  }

  // If approving hours, set approval info
  if (updates.hours_approved === true) {
    const { data: { user } } = await supabase.auth.getUser()
    updates.approved_by = user?.id
    updates.approved_at = new Date().toISOString()
  }

  const { data: signup, error } = await supabase
    .from('volunteer_signups')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      opportunity:volunteer_opportunities!inner(organization_id)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If hours were logged and approved, create hours record
  if (updates.hours_logged && updates.hours_approved && signup) {
    await supabase.from('volunteer_hours').insert({
      organization_id: signup.opportunity.organization_id,
      user_id: signup.user_id,
      opportunity_id: signup.opportunity_id,
      signup_id: signup.id,
      hours: updates.hours_logged,
      date: new Date().toISOString().split('T')[0],
      status: 'approved',
      approved_by: updates.approved_by,
      approved_at: updates.approved_at
    })

    // Check for badge awards
    if (signup.user_id) {
      await supabase.rpc('check_volunteer_badges', {
        p_user_id: signup.user_id,
        p_org_id: signup.opportunity.organization_id
      })
    }
  }

  return NextResponse.json({ signup })
}

// DELETE /api/volunteers/signups - Cancel signup
export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Signup ID required' }, { status: 400 })
  }

  // Get signup to update opportunity count
  const { data: signup } = await supabase
    .from('volunteer_signups')
    .select('opportunity_id')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('volunteer_signups')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Decrement count
  if (signup) {
    await supabase.rpc('decrement', { 
      table_name: 'volunteer_opportunities',
      column_name: 'signed_up_count',
      row_id: signup.opportunity_id
    })
  }

  return NextResponse.json({ success: true })
}
