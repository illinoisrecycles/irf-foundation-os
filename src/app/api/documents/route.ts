import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireOrgContext } from '@/lib/auth/org-context'

// GET /api/documents
export async function GET(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const { searchParams } = new URL(req.url)
  
  const folderId = searchParams.get('folder_id')
  const documentType = searchParams.get('type')
  const visibility = searchParams.get('visibility')

  let query = supabase
    .from('documents')
    .select(`
      *,
      folder:document_folders(id, name),
      uploader:auth.users(email, raw_user_meta_data)
    `)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })

  if (folderId) {
    query = query.eq('folder_id', folderId)
  }
  if (documentType) {
    query = query.eq('document_type', documentType)
  }
  if (visibility) {
    query = query.eq('visibility', visibility)
  }

  const { data: documents, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Also fetch folders
  const { data: folders } = await supabase
    .from('document_folders')
    .select('*')
    .eq('organization_id', org.id)
    .order('sort_order')

  return NextResponse.json({ documents, folders })
}

// POST /api/documents - Create document record
export async function POST(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const body = await req.json()

  const { data: { user } } = await supabase.auth.getUser()

  const {
    title,
    description,
    file_name,
    file_url,
    file_size_bytes,
    mime_type,
    document_type,
    folder_id,
    visibility,
    tags
  } = body

  if (!title || !file_name || !file_url) {
    return NextResponse.json({ error: 'Title, file_name, and file_url required' }, { status: 400 })
  }

  const { data: document, error } = await supabase
    .from('documents')
    .insert({
      organization_id: org.id,
      title,
      description,
      file_name,
      file_url,
      file_size_bytes,
      mime_type,
      document_type,
      folder_id,
      visibility: visibility || 'members',
      tags: tags || [],
      uploaded_by: user?.id
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ document })
}

// PATCH /api/documents - Update document
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const body = await req.json()
  const { id, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: 'Document ID required' }, { status: 400 })
  }

  const { data: document, error } = await supabase
    .from('documents')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', org.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ document })
}

// DELETE /api/documents
export async function DELETE(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Document ID required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
