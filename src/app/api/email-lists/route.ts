import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const orgId = url.searchParams.get('orgId') || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || ''

  if (!orgId) return NextResponse.json({ lists: [] })

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('email_lists')
    .select('*')
    .eq('organization_id', orgId)
    .order('name')

  if (error) {
    return NextResponse.json({ lists: [], error: error.message }, { status: 500 })
  }

  return NextResponse.json({ lists: data || [] })
}

export async function POST(req: Request) {
  const body = await req.json()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('email_lists')
    .insert({
      organization_id: body.organization_id || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID,
      name: body.name,
      description: body.description || null,
      type: body.type || 'manual',
      filter_criteria: body.filter_criteria || null,
      is_active: body.is_active ?? true,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ list: data })
}
