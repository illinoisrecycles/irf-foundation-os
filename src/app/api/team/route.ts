import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgContext } from '@/lib/auth/org-context'

// GET /api/team - Get team members and invites
export async function GET(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)

  // Get current members
  const { data: members, error: membersError } = await supabase
    .from('organization_members')
    .select(`
      id, user_id, role, created_at,
      user:auth.users(id, email, raw_user_meta_data)
    `)
    .eq('organization_id', org.id)

  // Get pending invites
  const { data: invites, error: invitesError } = await supabase
    .from('team_invites')
    .select('*')
    .eq('organization_id', org.id)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 })
  }

  return NextResponse.json({ 
    members: members || [], 
    invites: invites || [] 
  })
}

// POST /api/team - Invite new team member
export async function POST(req: Request) {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const org = await requireOrgContext(req)
  const { email, role } = await req.json()

  if (!email || !role) {
    return NextResponse.json({ error: 'Email and role required' }, { status: 400 })
  }

  const validRoles = ['admin', 'editor', 'viewer', 'finance']
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Check if already a member
  const { data: existingMember } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', org.id)
    .eq('user_id', (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === email)?.id)
    .single()

  if (existingMember) {
    return NextResponse.json({ error: 'User is already a team member' }, { status: 400 })
  }

  // Check for existing pending invite
  const { data: existingInvite } = await supabase
    .from('team_invites')
    .select('id')
    .eq('organization_id', org.id)
    .eq('email', email)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (existingInvite) {
    return NextResponse.json({ error: 'Pending invite already exists for this email' }, { status: 400 })
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // Create invite
  const { data: invite, error } = await supabase
    .from('team_invites')
    .insert({
      organization_id: org.id,
      email,
      role,
      invited_by: user?.id
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // TODO: Send invitation email via Resend
  // await sendTeamInviteEmail({ to: email, inviteToken: invite.token, orgName: org.name })

  return NextResponse.json({ invite })
}

// DELETE /api/team - Remove member or cancel invite
export async function DELETE(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('member_id')
  const inviteId = searchParams.get('invite_id')

  if (memberId) {
    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', memberId)
      .eq('organization_id', org.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else if (inviteId) {
    const { error } = await supabase
      .from('team_invites')
      .delete()
      .eq('id', inviteId)
      .eq('organization_id', org.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else {
    return NextResponse.json({ error: 'member_id or invite_id required' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

// PATCH /api/team - Update member role
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const { member_id, role } = await req.json()

  if (!member_id || !role) {
    return NextResponse.json({ error: 'member_id and role required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('organization_members')
    .update({ role })
    .eq('id', member_id)
    .eq('organization_id', org.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ member: data })
}
