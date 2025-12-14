import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================================
// BOARD MEETINGS API
// Manage board meetings, agendas, and minutes
// ============================================================================

export async function GET(req: Request) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  
  const orgId = searchParams.get('organization_id')
  const status = searchParams.get('status')
  const upcoming = searchParams.get('upcoming') === 'true'

  if (!orgId) {
    return NextResponse.json({ error: 'organization_id required' }, { status: 400 })
  }

  let query = supabase
    .from('board_meetings')
    .select(`
      *,
      agenda_items:board_agenda_items (
        id, item_order, title, item_type, requires_vote, vote_result
      )
    `)
    .eq('organization_id', orgId)
    .order('meeting_date', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  if (upcoming) {
    query = query.gte('meeting_date', new Date().toISOString())
  }

  const { data, error } = await query.limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ meetings: data })
}

export async function POST(req: Request) {
  const supabase = createAdminClient()
  const body = await req.json()

  const {
    organization_id,
    title,
    meeting_date,
    location,
    is_virtual = false,
    virtual_link,
    quorum_required,
    agenda_items = [],
  } = body

  if (!organization_id || !title || !meeting_date) {
    return NextResponse.json({ 
      error: 'organization_id, title, and meeting_date required' 
    }, { status: 400 })
  }

  // Create meeting
  const { data: meeting, error: meetingError } = await supabase
    .from('board_meetings')
    .insert({
      organization_id,
      title,
      meeting_date,
      location,
      is_virtual,
      virtual_link,
      quorum_required,
      status: 'scheduled',
    })
    .select()
    .single()

  if (meetingError) {
    return NextResponse.json({ error: meetingError.message }, { status: 500 })
  }

  // Create agenda items if provided
  if (agenda_items.length > 0) {
    const items = agenda_items.map((item: any, idx: number) => ({
      organization_id,
      meeting_id: meeting.id,
      item_order: item.item_order || idx + 1,
      title: item.title,
      description: item.description,
      item_type: item.item_type || 'discussion',
      requires_vote: item.requires_vote || false,
      presenter_id: item.presenter_id,
      time_allocated_minutes: item.time_allocated_minutes,
    }))

    await supabase.from('board_agenda_items').insert(items)
  }

  // Create work items for packet preparation
  const packetDueDate = new Date(meeting_date)
  packetDueDate.setDate(packetDueDate.getDate() - 7)

  await supabase.from('work_items').insert({
    organization_id,
    item_type: 'board_prep',
    title: `Prepare board packet for ${title}`,
    description: 'Compile financial reports, committee updates, and action items',
    reference_type: 'board_meeting',
    reference_id: meeting.id,
    priority: 'high',
    due_date: packetDueDate.toISOString(),
  })

  return NextResponse.json({ meeting })
}
