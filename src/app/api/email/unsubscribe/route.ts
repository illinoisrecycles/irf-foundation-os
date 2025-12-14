import { NextResponse } from 'next/server'
import { handleUnsubscribe } from '@/lib/email/campaigns'

export async function POST(req: Request) {
  const { email, organization_id, campaign_id, reason } = await req.json()

  if (!email || !organization_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    await handleUnsubscribe({
      organizationId: organization_id,
      email,
      campaignId: campaign_id,
      reason,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
