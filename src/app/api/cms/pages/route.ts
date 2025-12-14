import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const orgId = url.searchParams.get('orgId') || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || ''
  const status = url.searchParams.get('status')
  const slug = url.searchParams.get('slug')

  const supabase = createAdminClient()

  let query = supabase
    .from('cms_pages')
    .select('*')
    .order('menu_order')

  if (orgId) {
    query = query.eq('organization_id', orgId)
  }

  if (status) {
    query = query.eq('status', status)
  }

  if (slug) {
    query = query.eq('slug', slug)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ pages: [], error: error.message }, { status: 500 })
  }

  return NextResponse.json({ pages: data || [] })
}

export async function POST(req: Request) {
  const body = await req.json()
  const supabase = createAdminClient()

  const slug = body.slug || body.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  const { data, error } = await supabase
    .from('cms_pages')
    .insert({
      organization_id: body.organization_id || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID,
      title: body.title,
      slug: slug,
      content: body.content || null,
      excerpt: body.excerpt || null,
      featured_image_url: body.featured_image_url || null,
      meta_title: body.meta_title || null,
      meta_description: body.meta_description || null,
      status: body.status || 'draft',
      parent_id: body.parent_id || null,
      menu_order: body.menu_order || 0,
      show_in_menu: body.show_in_menu ?? false,
      is_members_only: body.is_members_only ?? false,
      created_by_profile_id: body.created_by_profile_id || null,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ page: data })
}
