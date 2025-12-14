import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext } from '@/lib/auth/org-context'
import { generateBoardPacket } from '@/lib/reports/board-packet'

export async function POST(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)

    const body = await req.json()
    const { period_start, period_end, sections } = body

    if (!period_start || !period_end) {
      return NextResponse.json(
        { error: 'period_start and period_end required' },
        { status: 400 }
      )
    }

    const packet = await generateBoardPacket({
      supabase,
      organizationId: ctx.organizationId,
      periodStart: period_start,
      periodEnd: period_end,
      sections: sections || ['summary', 'financials', 'membership', 'events', 'grants'],
    })

    return NextResponse.json({ packet })
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('Board packet error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
