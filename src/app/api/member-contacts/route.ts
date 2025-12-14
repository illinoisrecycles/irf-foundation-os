import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const memberOrgId = url.searchParams.get('memberOrgId')
  const search = url.searchParams.get('search')

  if (!memberOrgId) return NextResponse.json({ contacts: [] })

  const supabase = createAdminClient()

  let query = supabase
    .from('member_contacts')
    .select('*')
    .eq('member_organization_id', memberOrgId)
    .order('is_primary_contact', { ascending: false })
    .order('last_name')

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ contacts: [], error: error.message }, { status: 500 })
  }

  return NextResponse.json({ contacts: data || [] })
}

export async function POST(req: Request) {
  const body = await req.json()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('member_contacts')
    .insert({
      member_organization_id: body.member_organization_id,
      profile_id: body.profile_id || null,
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email,
      phone: body.phone || null,
      mobile_phone: body.mobile_phone || null,
      job_title: body.job_title || null,
      department: body.department || null,
      is_primary_contact: body.is_primary_contact ?? false,
      is_billing_contact: body.is_billing_contact ?? false,
      can_manage_membership: body.can_manage_membership ?? false,
      can_register_events: body.can_register_events ?? true,
      can_view_directory: body.can_view_directory ?? true,
      email_opt_in: body.email_opt_in ?? true,
      newsletter_opt_in: body.newsletter_opt_in ?? true,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ contact: data })
}
