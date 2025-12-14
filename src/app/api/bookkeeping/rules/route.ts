import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext, requireFinanceRole } from '@/lib/auth/org-context'

export async function GET(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)

    const { searchParams } = new URL(req.url)
    const isActive = searchParams.get('is_active')

    let query = supabase
      .from('bank_rules')
      .select(`
        *,
        account:gl_accounts(id, code, name),
        class:classes(id, name),
        vendor:vendors(id, name)
      `)
      .eq('organization_id', ctx.organizationId)
      .order('priority', { ascending: false })

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ rules: data || [] })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)
    requireFinanceRole(ctx)

    const body = await req.json()

    const { data, error } = await supabase
      .from('bank_rules')
      .insert({
        organization_id: ctx.organizationId,
        name: body.name,
        priority: body.priority || 50,
        is_active: body.is_active ?? true,
        conditions: body.conditions || [],
        account_id: body.account_id,
        class_id: body.class_id,
        project_id: body.project_id,
        vendor_id: body.vendor_id,
        tags: body.tags,
        memo_template: body.memo_template,
        created_by_profile_id: ctx.userId,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ rule: data })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
