import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const orgId = url.searchParams.get('orgId') || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || ''
  const status = url.searchParams.get('status')
  const paymentType = url.searchParams.get('type')
  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')

  if (!orgId) {
    return NextResponse.json({ payments: [] })
  }

  const supabase = createAdminClient()

  let query = supabase
    .from('payments')
    .select(`
      *,
      profile:profiles(id, email, first_name, last_name, display_name)
    `)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  if (paymentType) {
    query = query.eq('payment_type', paymentType)
  }

  if (startDate) {
    query = query.gte('created_at', startDate)
  }

  if (endDate) {
    query = query.lte('created_at', endDate)
  }

  const { data, error } = await query.limit(500)

  if (error) {
    return NextResponse.json({ payments: [], error: error.message }, { status: 500 })
  }

  return NextResponse.json({ payments: data || [] })
}
