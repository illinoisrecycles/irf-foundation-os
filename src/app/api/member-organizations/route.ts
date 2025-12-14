import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const orgId = url.searchParams.get('orgId') || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || ''
  const status = url.searchParams.get('status')
  const search = url.searchParams.get('search')
  const category = url.searchParams.get('category')
  const limit = parseInt(url.searchParams.get('limit') || '100')
  const offset = parseInt(url.searchParams.get('offset') || '0')

  if (!orgId) return NextResponse.json({ members: [] })

  const supabase = createAdminClient()

  let query = supabase
    .from('member_organizations')
    .select(`
      *,
      membership_plan:membership_plans(id, name, price_cents),
      contacts:member_contacts(id, first_name, last_name, email, is_primary_contact),
      categories:member_directory_categories(category_id)
    `)
    .eq('organization_id', orgId)
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq('membership_status', status)
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,city.ilike.%${search}%`)
  }

  if (category) {
    // Filter by category through junction table
    query = query.contains('categories', [{ category_id: category }])
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ members: [], error: error.message }, { status: 500 })
  }

  return NextResponse.json({ members: data || [], count })
}

export async function POST(req: Request) {
  const body = await req.json()
  const supabase = createAdminClient()

  const orgId = body.organization_id || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID

  const { data, error } = await supabase
    .from('member_organizations')
    .insert({
      organization_id: orgId,
      name: body.name,
      legal_name: body.legal_name || null,
      org_type: body.org_type || 'business',
      industry: body.industry || null,
      employee_count_range: body.employee_count_range || null,
      annual_revenue_range: body.annual_revenue_range || null,
      service_area: body.service_area || null,
      website: body.website || null,
      phone: body.phone || null,
      email: body.email || null,
      address_line1: body.address_line1 || null,
      address_line2: body.address_line2 || null,
      city: body.city || null,
      state: body.state || null,
      postal_code: body.postal_code || null,
      country: body.country || 'US',
      linkedin_url: body.linkedin_url || null,
      facebook_url: body.facebook_url || null,
      twitter_url: body.twitter_url || null,
      instagram_url: body.instagram_url || null,
      is_directory_visible: body.is_directory_visible ?? true,
      directory_description: body.directory_description || null,
      logo_url: body.logo_url || null,
      membership_plan_id: body.membership_plan_id || null,
      membership_status: body.membership_status || 'pending',
      member_since: body.member_since || null,
      membership_expires_at: body.membership_expires_at || null,
      notes: body.notes || null,
      tags: body.tags || [],
      custom_fields: body.custom_fields || {},
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If primary contact provided, create it
  if (body.primary_contact) {
    await supabase.from('member_contacts').insert({
      member_organization_id: data.id,
      first_name: body.primary_contact.first_name,
      last_name: body.primary_contact.last_name,
      email: body.primary_contact.email,
      phone: body.primary_contact.phone || null,
      job_title: body.primary_contact.job_title || null,
      is_primary_contact: true,
      is_billing_contact: true,
    })
  }

  return NextResponse.json({ member: data })
}
