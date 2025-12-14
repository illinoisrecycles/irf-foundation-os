import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('board_meetings')
    .select(`
      *,
      agenda_items:board_agenda_items (
        *,
        presenter:profiles!board_agenda_items_presenter_id_fkey (id, full_name),
        approval_request:approval_requests (id, status, title, amount_cents)
      )
    `)
    .eq('id', params.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json({ meeting: data })
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient()
  const body = await req.json()

  const { action, ...updates } = body

  // Special actions
  if (action === 'generate_packet') {
    return await generateBoardPacket(supabase, params.id)
  }

  if (action === 'approve_minutes') {
    const { approved_by } = body
    await supabase
      .from('board_meetings')
      .update({
        minutes_approved_at: new Date().toISOString(),
        minutes_approved_by: approved_by,
      })
      .eq('id', params.id)

    return NextResponse.json({ success: true, message: 'Minutes approved' })
  }

  if (action === 'record_attendance') {
    const { attendees } = body
    await supabase
      .from('board_meetings')
      .update({ attendees })
      .eq('id', params.id)

    return NextResponse.json({ success: true })
  }

  if (action === 'record_vote') {
    const { agenda_item_id, vote_result, votes_for, votes_against, votes_abstain } = body

    await supabase
      .from('board_agenda_items')
      .update({
        vote_result,
        votes_for,
        votes_against,
        votes_abstain,
      })
      .eq('id', agenda_item_id)

    // If this was an approval request, update it too
    const { data: item } = await supabase
      .from('board_agenda_items')
      .select('approval_request_id')
      .eq('id', agenda_item_id)
      .single()

    if (item?.approval_request_id) {
      const status = vote_result === 'approved' ? 'approved' : 
                     vote_result === 'rejected' ? 'rejected' : 'pending'

      await supabase
        .from('approval_requests')
        .update({ 
          status,
          completed_at: ['approved', 'rejected'].includes(status) ? new Date().toISOString() : null,
        })
        .eq('id', item.approval_request_id)
    }

    return NextResponse.json({ success: true })
  }

  // Regular update
  const { error } = await supabase
    .from('board_meetings')
    .update(updates)
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

async function generateBoardPacket(supabase: any, meetingId: string) {
  // Get meeting with all details
  const { data: meeting } = await supabase
    .from('board_meetings')
    .select(`
      *,
      organization:organizations (id, name),
      agenda_items:board_agenda_items (
        *,
        presenter:profiles!board_agenda_items_presenter_id_fkey (full_name),
        approval_request:approval_requests (*)
      )
    `)
    .eq('id', meetingId)
    .single()

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
  }

  const orgId = meeting.organization_id

  // Gather financial data for packet
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [
    { data: recentDonations },
    { data: recentExpenses },
    { data: memberStats },
    { data: pendingApprovals },
  ] = await Promise.all([
    supabase
      .from('donations')
      .select('amount_cents, created_at')
      .eq('organization_id', orgId)
      .gte('created_at', thirtyDaysAgo.toISOString()),
    supabase
      .from('ledger_entries')
      .select('amount_cents, description')
      .eq('organization_id', orgId)
      .eq('entry_type', 'debit')
      .gte('created_at', thirtyDaysAgo.toISOString()),
    supabase
      .from('member_organizations')
      .select('membership_status')
      .eq('organization_id', orgId),
    supabase
      .from('approval_requests')
      .select('*')
      .eq('organization_id', orgId)
      .eq('status', 'pending'),
  ])

  // Build packet content
  const packetData = {
    meeting,
    generated_at: new Date().toISOString(),
    financial_summary: {
      donations_30d: recentDonations?.reduce((sum: number, d: any) => sum + d.amount_cents, 0) || 0,
      expenses_30d: recentExpenses?.reduce((sum: number, e: any) => sum + Math.abs(e.amount_cents), 0) || 0,
    },
    membership_summary: {
      total: memberStats?.length || 0,
      active: memberStats?.filter((m: any) => m.membership_status === 'active').length || 0,
      pending: memberStats?.filter((m: any) => m.membership_status === 'pending').length || 0,
    },
    pending_approvals: pendingApprovals || [],
    agenda_items: meeting.agenda_items?.sort((a: any, b: any) => a.item_order - b.item_order) || [],
  }

  // Store packet reference
  await supabase
    .from('board_meetings')
    .update({
      packet_generated_at: new Date().toISOString(),
      // In production, you'd generate a PDF and store the URL
    })
    .eq('id', meetingId)

  // Create generated document record
  await supabase.from('generated_documents').insert({
    organization_id: orgId,
    document_type: 'board_packet',
    entity_table: 'board_meetings',
    entity_id: meetingId,
    title: `Board Packet - ${meeting.title}`,
    merge_data: packetData,
  })

  return NextResponse.json({ 
    success: true,
    packet: packetData,
  })
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('board_meetings')
    .delete()
    .eq('id', params.id)
    .eq('status', 'scheduled') // Can only delete scheduled meetings

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
