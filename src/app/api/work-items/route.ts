import { NextResponse } from 'next/server'
import { requireContext, handleAuthError } from '@/lib/auth/context'

export async function GET(req: Request) {
  try {
    const ctx = await requireContext(req)
    const { searchParams } = new URL(req.url)
    
    const status = searchParams.get('status') || 'open'
    const cursor = searchParams.get('cursor')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

    let query = ctx.supabase
      .from('work_items')
      .select('*', { count: 'exact' })
      .eq('organization_id', ctx.organizationId)
      .order('priority', { ascending: false })
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status !== 'all') query = query.eq('status', status)
    if (cursor) query = query.lt('created_at', cursor)

    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const nextCursor = data?.length === limit ? data[data.length - 1].created_at : null
    return NextResponse.json({ data, total: count, nextCursor })
  } catch (err) {
    return handleAuthError(err)
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireContext(req)
    const body = await req.json()

    // Dedupe check
    if (body.dedupe_key) {
      const { data: existing } = await ctx.supabase
        .from('work_items')
        .select('id')
        .eq('organization_id', ctx.organizationId)
        .eq('dedupe_key', body.dedupe_key)
        .single()

      if (existing) return NextResponse.json({ data: existing, dedupe: true })
    }

    const { data, error } = await ctx.supabase
      .from('work_items')
      .insert({
        ...body,
        organization_id: ctx.organizationId,
        created_by: ctx.userId,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return handleAuthError(err)
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await requireContext(req)
    const body = await req.json()
    const { id, ...updates } = body

    const { data, error } = await ctx.supabase
      .from('work_items')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return handleAuthError(err)
  }
}
