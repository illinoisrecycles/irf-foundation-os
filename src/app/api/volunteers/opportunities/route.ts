import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireOrgContext } from '@/lib/auth/org-context'

// GET /api/volunteers/opportunities
export async function GET(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const { searchParams } = new URL(req.url)
  
  const upcoming = searchParams.get('upcoming') === 'true'
  const eventId = searchParams.get('event_id')

  let query = supabase
    .from('volunteer_opportunities')
    .select(`
      *,
      event:events(id, title, start_date),
      signups:volunteer_signups(count)
    `)
    .eq('organization_id', org.id)
    .order('date_start', { ascending: true })

  if (upcoming) {
    query = query.gte('date_start', new Date().toISOString())
  }
  if (eventId) {
    query = query.eq('event_id', eventId)
  }

  const { data: opportunities, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ opportunities })
}

// POST /api/volunteers/opportunities
export async function POST(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const body = await req.json()

  const {
    title, description, event_id, date_start, date_end,
    location, is_virtual, virtual_link, required_volunteers,
    skills_needed, min_age, requirements, status
  } = body

  if (!title || !date_start) {
    return NextResponse.json({ error: 'Title and date_start required' }, { status: 400 })
  }

  const { data: opportunity, error } = await supabase
    .from('volunteer_opportunities')
    .insert({
      organization_id: org.id,
      title,
      description,
      event_id,
      date_start,
      date_end,
      location,
      is_virtual,
      virtual_link,
      required_volunteers: required_volunteers || 1,
      skills_needed: skills_needed || [],
      min_age,
      requirements,
      status: status || 'published'
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ opportunity })
}

// PATCH /api/volunteers/opportunities
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const body = await req.json()
  const { id, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: 'Opportunity ID required' }, { status: 400 })
  }

  const { data: opportunity, error } = await supabase
    .from('volunteer_opportunities')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', org.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ opportunity })
}

// DELETE /api/volunteers/opportunities
export async function DELETE(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Opportunity ID required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('volunteer_opportunities')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
