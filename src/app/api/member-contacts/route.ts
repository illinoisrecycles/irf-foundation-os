import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext } from '@/lib/auth/org-context'

export async function GET(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)

    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get('member_id')
    const contactType = searchParams.get('type')

    let query = supabase
      .from('member_contacts')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .order('is_primary', { ascending: false })

    if (memberId) query = query.eq('member_id', memberId)
    if (contactType) query = query.eq('contact_type', contactType)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ contacts: data || [] })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)

    const body = await req.json()
    
    const { data, error } = await supabase
      .from('member_contacts')
      .insert({
        organization_id: ctx.organizationId,
        member_id: body.member_id,
        contact_type: body.contact_type,
        value: body.value,
        label: body.label,
        is_primary: body.is_primary || false,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ contact: data })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
