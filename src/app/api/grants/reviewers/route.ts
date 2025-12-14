import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('organization_id')

  if (!orgId) {
    return NextResponse.json({ error: 'organization_id required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('grant_reviewers')
    .select('*, assignments:grant_review_assignments(count)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { organization_id, email, name, organization_name } = body

  if (!organization_id || !email || !name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Check for existing reviewer
  const { data: existing } = await supabase
    .from('grant_reviewers')
    .select('id')
    .eq('organization_id', organization_id)
    .eq('email', email)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Reviewer already exists' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('grant_reviewers')
    .insert({ organization_id, email, name, organization_name, is_active: true })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // TODO: Send invitation email

  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('grant_reviewers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
