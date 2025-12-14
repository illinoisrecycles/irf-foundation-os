import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================================
// DOCUMENT TEMPLATES API
// Manage reusable document templates with merge fields
// ============================================================================

export async function GET(req: Request) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  
  const orgId = searchParams.get('organization_id')
  const type = searchParams.get('type')

  if (!orgId) {
    return NextResponse.json({ error: 'organization_id required' }, { status: 400 })
  }

  let query = supabase
    .from('document_templates')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('name')

  if (type) {
    query = query.eq('template_type', type)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ templates: data })
}

export async function POST(req: Request) {
  const supabase = createAdminClient()
  const body = await req.json()

  const {
    organization_id,
    name,
    description,
    template_type,
    content_html,
    content_markdown,
    merge_fields = [],
    paper_size = 'letter',
    orientation = 'portrait',
    header_html,
    footer_html,
    is_default = false,
  } = body

  if (!organization_id || !name || !template_type) {
    return NextResponse.json({ 
      error: 'organization_id, name, and template_type required' 
    }, { status: 400 })
  }

  // If setting as default, unset other defaults of same type
  if (is_default) {
    await supabase
      .from('document_templates')
      .update({ is_default: false })
      .eq('organization_id', organization_id)
      .eq('template_type', template_type)
  }

  const { data, error } = await supabase
    .from('document_templates')
    .insert({
      organization_id,
      name,
      description,
      template_type,
      content_html,
      content_markdown,
      merge_fields,
      paper_size,
      orientation,
      header_html,
      footer_html,
      is_default,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ template: data })
}

// ============================================================================
// DOCUMENT GENERATION ENDPOINT
// ============================================================================

export async function PUT(req: Request) {
  const supabase = createAdminClient()
  const body = await req.json()

  const {
    template_id,
    organization_id,
    entity_table,
    entity_id,
    merge_data = {},
    send_to_email,
    title,
  } = body

  if (!template_id || !organization_id) {
    return NextResponse.json({ 
      error: 'template_id and organization_id required' 
    }, { status: 400 })
  }

  // Get template
  const { data: template } = await supabase
    .from('document_templates')
    .select('*')
    .eq('id', template_id)
    .single()

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  // Merge content with data
  let finalContent = template.content_html || template.content_markdown || ''
  
  for (const [key, value] of Object.entries(merge_data)) {
    const regex = new RegExp(`{{${key}}}`, 'g')
    finalContent = finalContent.replace(regex, String(value))
  }

  // Create document record
  const { data: doc, error } = await supabase
    .from('generated_documents')
    .insert({
      organization_id,
      template_id,
      document_type: template.template_type,
      entity_table,
      entity_id,
      title: title || `${template.name} - ${new Date().toLocaleDateString()}`,
      merge_data,
      sent_to_email: send_to_email,
      sent_at: send_to_email ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If email requested, queue it
  if (send_to_email) {
    await supabase.from('email_outbox').insert({
      organization_id,
      to_email: send_to_email,
      subject: title || template.name,
      body_html: finalContent,
      status: 'pending',
      metadata: { document_id: doc.id },
    })
  }

  return NextResponse.json({ 
    document: doc,
    rendered_content: finalContent,
  })
}
