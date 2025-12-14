import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext } from '@/lib/auth/org-context'

export async function GET(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)

    const { data, error } = await supabase
      .from('email_lists')
      .select(`
        *,
        subscribers:email_list_subscribers(count)
      `)
      .eq('organization_id', ctx.organizationId)
      .order('name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ lists: data || [] })
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
      .from('email_lists')
      .insert({
        organization_id: ctx.organizationId,
        name: body.name,
        description: body.description,
        type: body.type || 'manual',
        filter_criteria: body.filter_criteria,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ list: data })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
