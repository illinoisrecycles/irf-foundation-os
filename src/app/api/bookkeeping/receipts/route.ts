import { NextResponse } from 'next/server'
import { requireContext, handleAuthError } from '@/lib/auth/context'
import { processReceiptUpload } from '@/lib/bookkeeping/receipt-scanner'

export async function POST(req: Request) {
  try {
    const ctx = await requireContext(req)
    const { file_url, file_name, file_type } = await req.json()

    const result = await processReceiptUpload(
      ctx.organizationId,
      ctx.userId,
      { url: file_url, name: file_name, type: file_type }
    )

    return NextResponse.json(result)
  } catch (err) {
    return handleAuthError(err)
  }
}

export async function GET(req: Request) {
  try {
    const ctx = await requireContext(req)

    const { data, error } = await ctx.supabase
      .from('receipt_scans')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return handleAuthError(err)
  }
}
