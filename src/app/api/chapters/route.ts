import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assignChapterByLocation } from '@/lib/automation/foundation-recipes'

// ============================================================================
// CHAPTERS API
// Regional chapters for member routing
// ============================================================================

export async function GET(req: Request) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  
  const orgId = searchParams.get('organization_id')

  if (!orgId) {
    return NextResponse.json({ error: 'organization_id required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('chapters')
    .select(`
      *,
      president:profiles!chapters_president_id_fkey (id, full_name, email)
    `)
    .eq('organization_id', orgId)
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ chapters: data })
}

export async function POST(req: Request) {
  const supabase = createAdminClient()
  const body = await req.json()

  const {
    organization_id,
    name,
    code,
    region,
    states = [],
    zip_prefixes = [],
    president_id,
    contact_email,
  } = body

  if (!organization_id || !name) {
    return NextResponse.json({ 
      error: 'organization_id and name required' 
    }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('chapters')
    .insert({
      organization_id,
      name,
      code,
      region,
      states,
      zip_prefixes,
      president_id,
      contact_email,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ chapter: data })
}

// ============================================================================
// AUTO-ASSIGN ENDPOINT
// Assign a member to a chapter based on location
// ============================================================================

export async function PUT(req: Request) {
  const body = await req.json()

  const {
    organization_id,
    member_id,
    state,
    zip_code,
  } = body

  if (!organization_id || !member_id) {
    return NextResponse.json({ 
      error: 'organization_id and member_id required' 
    }, { status: 400 })
  }

  const result = await assignChapterByLocation(
    organization_id,
    member_id,
    state,
    zip_code
  )

  return NextResponse.json(result)
}
