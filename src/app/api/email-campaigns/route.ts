import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const orgId = url.searchParams.get('orgId') || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || ''
  const status = url.searchParams.get('status')

  if (!orgId) return NextResponse.json({ campaigns: [] })

  const supabase = createAdminClient()

  let query = supabase
    .from('email_campaigns')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ campaigns: [], error: error.message }, { status: 500 })
  }

  return NextResponse.json({ campaigns: data || [] })
}

export async function POST(req: Request) {
  const body = await req.json()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('email_campaigns')
    .insert({
      organization_id: body.organization_id || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID,
      name: body.name,
      subject: body.subject,
      from_name: body.from_name || null,
      from_email: body.from_email || null,
      reply_to: body.reply_to || null,
      html_content: body.html_content || null,
      text_content: body.text_content || null,
      template_id: body.template_id || null,
      email_list_id: body.email_list_id || null,
      status: body.status || 'draft',
      scheduled_at: body.scheduled_at || null,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ campaign: data })
}
