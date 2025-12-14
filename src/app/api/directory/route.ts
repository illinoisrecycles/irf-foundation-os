import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const orgId = url.searchParams.get('orgId') || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || ''
  const category = url.searchParams.get('category')
  const search = url.searchParams.get('search')
  const state = url.searchParams.get('state')

  const supabase = createAdminClient()

  let query = supabase
    .from('member_organizations')
    .select(`
      id, name, directory_description, logo_url, website, phone, email,
      city, state, industry, org_type
    `)
    .eq('is_directory_visible', true)
    .eq('membership_status', 'active')
    .order('name')

  if (orgId) {
    query = query.eq('organization_id', orgId)
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%,directory_description.ilike.%${search}%`)
  }

  if (state) {
    query = query.eq('state', state)
  }

  if (category) {
    query = query.eq('industry', category)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ members: [], error: error.message }, { status: 500 })
  }

  return NextResponse.json({ members: data || [] })
}
