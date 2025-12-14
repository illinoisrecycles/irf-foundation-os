import { NextResponse } from 'next/server'
import { requireContext, handleAuthError } from '@/lib/auth/context'
import { logAudit } from '@/lib/auth/audit'

// GET - List members (SECURE: uses RLS-enforced client)
export async function GET(req: Request) {
  try {
    const ctx = await requireContext(req)
    const { searchParams } = new URL(req.url)
    
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = ctx.supabase
      .from('member_organizations')
      .select(`
        *,
        membership_plans(id, name, price_cents),
        member_engagement_scores(score, engagement_tier, churn_risk_score),
        member_contacts(id, name, email, is_primary)
      `, { count: 'exact' })
      .eq('organization_id', ctx.organizationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('membership_status', status)
    if (search) query = query.or(`name.ilike.%${search}%,primary_email.ilike.%${search}%`)

    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data, total: count })
  } catch (err) {
    return handleAuthError(err)
  }
}

// POST - Create member (SECURE)
export async function POST(req: Request) {
  try {
    const ctx = await requireContext(req)
    const body = await req.json()

    const { data, error } = await ctx.supabase
      .from('member_organizations')
      .insert({
        ...body,
        organization_id: ctx.organizationId, // Force org from session
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'create',
      entityType: 'member',
      entityId: data.id,
      changes: body,
    })

    return NextResponse.json(data)
  } catch (err) {
    return handleAuthError(err)
  }
}

// PATCH - Update member (SECURE)
export async function PATCH(req: Request) {
  try {
    const ctx = await requireContext(req)
    const body = await req.json()
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { data, error } = await ctx.supabase
      .from('member_organizations')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', ctx.organizationId) // Double-check org
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'update',
      entityType: 'member',
      entityId: id,
      changes: updates,
    })

    return NextResponse.json(data)
  } catch (err) {
    return handleAuthError(err)
  }
}
