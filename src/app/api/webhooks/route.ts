import { NextResponse } from 'next/server'
import * as crypto from 'crypto'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext, requireFinanceRole } from '@/lib/auth/org-context'

export async function GET(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)

    const { data, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ webhooks: data })
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)
    requireFinanceRole(ctx) // Webhooks require admin/finance role

    const body = await req.json()
    const { url, events, name } = body

    if (!url || !events?.length) {
      return NextResponse.json(
        { error: 'url and events required' },
        { status: 400 }
      )
    }

    const secret = crypto.randomBytes(32).toString('hex')

    const { data, error } = await supabase
      .from('webhooks')
      .insert({
        organization_id: ctx.organizationId,
        url,
        events,
        name: name || 'Webhook',
        secret,
        is_active: true,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ webhook: data })
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)
    requireFinanceRole(ctx)

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('webhooks')
      .delete()
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
