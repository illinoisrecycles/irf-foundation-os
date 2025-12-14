import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext } from '@/lib/auth/org-context'

const QuerySchema = z.object({
  status: z.string().optional(),
  type: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export async function GET(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)

    const url = new URL(req.url)
    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query params' }, { status: 400 })
    }

    const { status, type, startDate, endDate } = parsed.data

    let query = supabase
      .from('payments')
      .select(`*, profile:profiles(id, email, first_name, last_name, display_name)`)
      .eq('organization_id', ctx.organizationId)
      .order('created_at', { ascending: false })
      .limit(500)

    if (status) query = query.eq('status', status)
    if (type) query = query.eq('payment_type', type)
    if (startDate) query = query.gte('created_at', startDate)
    if (endDate) query = query.lte('created_at', endDate)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ payments: data ?? [] })
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

    const body = await req.json()
    
    const { data, error } = await supabase
      .from('payments')
      .insert({
        organization_id: ctx.organizationId,
        profile_id: body.profile_id,
        amount_cents: body.amount_cents,
        currency: body.currency || 'usd',
        payment_type: body.payment_type || 'manual',
        status: body.status || 'pending',
        description: body.description,
        metadata: body.metadata,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ payment: data })
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
