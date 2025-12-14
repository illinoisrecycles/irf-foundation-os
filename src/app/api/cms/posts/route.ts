import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const orgId = url.searchParams.get('orgId') || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || ''
  const status = url.searchParams.get('status')
  const category = url.searchParams.get('category')
  const isPublic = url.searchParams.get('public') === 'true'

  const supabase = createAdminClient()

  let query = supabase
    .from('cms_posts')
    .select('*')
    .order('published_at', { ascending: false, nullsFirst: false })

  if (orgId) {
    query = query.eq('organization_id', orgId)
  }

  if (status) {
    query = query.eq('status', status)
  } else if (isPublic) {
    query = query.eq('status', 'published')
  }

  if (category) {
    query = query.eq('category', category)
  }

  if (isPublic) {
    query = query.eq('is_members_only', false)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ posts: [], error: error.message }, { status: 500 })
  }

  return NextResponse.json({ posts: data || [] })
}

export async function POST(req: Request) {
  const body = await req.json()
  const supabase = createAdminClient()

  const slug = body.slug || body.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  const { data, error } = await supabase
    .from('cms_posts')
    .insert({
      organization_id: body.organization_id || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID,
      title: body.title,
      slug: slug,
      content: body.content || null,
      excerpt: body.excerpt || null,
      featured_image_url: body.featured_image_url || null,
      category: body.category || null,
      tags: body.tags || [],
      meta_title: body.meta_title || null,
      meta_description: body.meta_description || null,
      status: body.status || 'draft',
      published_at: body.status === 'published' ? new Date().toISOString() : null,
      author_profile_id: body.author_profile_id || null,
      author_name: body.author_name || null,
      is_members_only: body.is_members_only ?? false,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ post: data })
}
