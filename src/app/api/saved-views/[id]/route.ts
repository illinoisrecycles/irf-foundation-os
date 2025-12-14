import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext } from '@/lib/auth/org-context'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)
    const { id } = await params

    const { data, error } = await supabase
      .from('saved_views')
      .select('*')
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .or(`profile_id.eq.${ctx.userId},is_shared.eq.true`)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ view: data })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)
    const { id } = await params

    const body = await req.json()
    
    // Only allow updating own views (unless admin)
    const { data: existing } = await supabase
      .from('saved_views')
      .select('profile_id')
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .single()

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.profile_id !== ctx.userId && !ctx.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('saved_views')
      .update({
        name: body.name,
        filters: body.filters,
        columns: body.columns,
        sort: body.sort,
        is_default: body.is_default,
        is_shared: body.is_shared,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ view: data })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)
    const { id } = await params

    // Only allow deleting own views (unless admin)
    const { data: existing } = await supabase
      .from('saved_views')
      .select('profile_id')
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .single()

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.profile_id !== ctx.userId && !ctx.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabase
      .from('saved_views')
      .delete()
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
