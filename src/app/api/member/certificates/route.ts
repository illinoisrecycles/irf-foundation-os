import { NextResponse } from 'next/server'
import { getMemberTranscript } from '@/lib/ceu/service'
import { requireContext, handleAuthError } from '@/lib/auth/context'

export async function GET(req: Request) {
  try {
    const ctx = await requireContext(req)
    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get('member_id') || ctx.userId

    const transcript = await getMemberTranscript(memberId)

    return NextResponse.json({
      certificates: transcript.credits,
      summary: Object.fromEntries(
        Object.entries(transcript.summary).map(([type, data]) => [type, data.total])
      ),
      total: transcript.totalCredits,
    })
  } catch (err) {
    return handleAuthError(err)
  }
}
