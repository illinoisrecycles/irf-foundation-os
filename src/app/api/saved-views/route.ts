import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext } from '@/lib/auth/org-context'

export async function GET(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)

    const { searchParams } = new URL(req.url)
    const viewType = searchParams.get('view_type')

    let query = supabase
      .from('saved_views')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .or(`profile_id.eq.${ctx.userId},is_shared.eq.true`)
      .order('is_default', { ascending: false })
      .order('name')

    if (viewType) query = query.eq('view_type', viewType)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ views: data || [] })
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
      .from('saved_views')
      .insert({
        organization_id: ctx.organizationId,
        profile_id: ctx.userId,
        name: body.name,
        view_type: body.view_type,
        filters: body.filters || {},
        columns: body.columns,
        sort: body.sort,
        is_default: body.is_default || false,
        is_shared: body.is_shared || false,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ view: data })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
