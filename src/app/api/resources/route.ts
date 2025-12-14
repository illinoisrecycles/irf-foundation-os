import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const orgId = url.searchParams.get('orgId') || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || ''
  const folderId = url.searchParams.get('folderId')
  const isPublic = url.searchParams.get('public') === 'true'

  const supabase = createAdminClient()

  let query = supabase
    .from('resources')
    .select('*, folder:resource_folders(id, name)')
    .order('created_at', { ascending: false })

  if (orgId) {
    query = query.eq('organization_id', orgId)
  }

  if (folderId) {
    query = query.eq('folder_id', folderId)
  }

  if (isPublic) {
    query = query.eq('is_members_only', false)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ resources: [], error: error.message }, { status: 500 })
  }

  return NextResponse.json({ resources: data || [] })
}

export async function POST(req: Request) {
  const body = await req.json()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('resources')
    .insert({
      organization_id: body.organization_id || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID,
      folder_id: body.folder_id || null,
      title: body.title,
      description: body.description || null,
      resource_type: body.resource_type || 'file',
      file_url: body.file_url || null,
      file_name: body.file_name || null,
      file_size: body.file_size || null,
      file_type: body.file_type || null,
      external_url: body.external_url || null,
      category: body.category || null,
      tags: body.tags || [],
      is_members_only: body.is_members_only ?? true,
      is_featured: body.is_featured ?? false,
      uploaded_by_profile_id: body.uploaded_by_profile_id || null,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ resource: data })
}
