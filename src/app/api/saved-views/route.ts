import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/types/database'

type SavedViewInsert = Database['public']['Tables']['saved_views']['Insert']

export async function GET(req: Request) {
  const url = new URL(req.url)
  const orgId = url.searchParams.get('orgId') || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || ''
  const viewModule = url.searchParams.get('module') || ''

  if (!orgId || !viewModule) {
    return NextResponse.json({ views: [] })
  }

  const supabase = createAdminClient()
  
  const { data, error } = await supabase
    .from('saved_views')
    .select('*')
    .eq('organization_id', orgId)
    .eq('module', viewModule)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ views: [], error: error.message }, { status: 500 })
  }

  return NextResponse.json({ views: data || [] })
}

export async function POST(req: Request) {
  const body = await req.json()
  const supabase = createAdminClient()

  const savedView: SavedViewInsert = {
    organization_id: body.organization_id,
    module: body.module,
    name: body.name,
    is_shared: !!body.is_shared,
    is_default: !!body.is_default,
    created_by_profile_id: body.created_by_profile_id,
    state: body.state ?? {},
  }

  const { data, error } = await supabase
    .from('saved_views')
    .insert(savedView)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ view: data })
}
