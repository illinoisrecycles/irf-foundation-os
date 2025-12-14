import { NextResponse } from 'next/server'
import { requireContext, handleAuthError } from '@/lib/auth/context'

export async function GET(req: Request) {
  try {
    const ctx = await requireContext(req)
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')

    let query = ctx.supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .eq('is_active', true)
      .order('account_number')

    if (type) query = query.eq('account_type', type)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return handleAuthError(err)
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireContext(req)
    const body = await req.json()

    const { data, error } = await ctx.supabase
      .from('chart_of_accounts')
      .insert({
        ...body,
        organization_id: ctx.organizationId,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return handleAuthError(err)
  }
}
