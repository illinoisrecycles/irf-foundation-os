import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'

const BodySchema = z.object({
  organizationId: z.string().uuid(),
})

export async function POST(req: Request) {
  const supabase = createAuthedServerClient()

  const { data: userRes, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = BodySchema.safeParse(await req.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { organizationId } = body.data

  // Membership check via RLS-enforced query
  const { data: membership, error: mErr } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('organization_id', organizationId)
    .eq('profile_id', userRes.user.id)
    .maybeSingle()

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Persist the active org on the profile
  const { error: pErr } = await supabase
    .from('profiles')
    .update({ active_organization_id: organizationId })
    .eq('id', userRes.user.id)

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  const res = NextResponse.json({ ok: true })
  res.cookies.set('active_org_id', organizationId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })
  return res
}

export async function GET(req: Request) {
  const supabase = createAuthedServerClient()

  const { data: userRes, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's organizations
  const { data: memberships, error: mErr } = await supabase
    .from('organization_members')
    .select('organization_id, role, organizations(id, name, slug)')
    .eq('profile_id', userRes.user.id)

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

  // Get active org from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('active_organization_id')
    .eq('id', userRes.user.id)
    .single()

  return NextResponse.json({
    organizations: memberships || [],
    activeOrganizationId: profile?.active_organization_id || memberships?.[0]?.organization_id || null,
  })
}
