import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const orgId = url.searchParams.get('orgId') || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || ''
  const status = url.searchParams.get('status')

  if (!orgId) return NextResponse.json({ posts: [] })

  const supabase = createAdminClient()

  let query = supabase
    .from('social_posts')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
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

  const { data, error } = await supabase
    .from('social_posts')
    .insert({
      organization_id: body.organization_id || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID,
      content: body.content,
      media_urls: body.media_urls || [],
      link_url: body.link_url || null,
      status: body.status || 'draft',
      scheduled_at: body.scheduled_at || null,
      post_to_facebook: body.post_to_facebook ?? false,
      post_to_twitter: body.post_to_twitter ?? false,
      post_to_linkedin: body.post_to_linkedin ?? false,
      post_to_instagram: body.post_to_instagram ?? false,
      created_by_profile_id: body.created_by_profile_id || null,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ post: data })
}
