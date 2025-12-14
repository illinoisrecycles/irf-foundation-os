import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const orgId = url.searchParams.get('orgId') || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || ''

  if (!orgId) return NextResponse.json({ forums: [] })

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('forums')
    .select(`
      *,
      topics:forum_topics(count)
    `)
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('display_order')

  if (error) {
    return NextResponse.json({ forums: [], error: error.message }, { status: 500 })
  }

  return NextResponse.json({ forums: data || [] })
}

export async function POST(req: Request) {
  const body = await req.json()
  const supabase = createAdminClient()

  const slug = body.slug || body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  const { data, error } = await supabase
    .from('forums')
    .insert({
      organization_id: body.organization_id || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID,
      name: body.name,
      slug: slug,
      description: body.description || null,
      icon: body.icon || null,
      display_order: body.display_order || 0,
      is_members_only: body.is_members_only ?? true,
      is_active: body.is_active ?? true,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ forum: data })
}
