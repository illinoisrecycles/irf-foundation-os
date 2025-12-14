import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { predictChurnRisk } from '@/lib/ai'

export async function GET(req: Request) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('member_id')

  if (!memberId) {
    return NextResponse.json({ error: 'member_id required' }, { status: 400 })
  }

  try {
    const { data: member } = await supabase
      .from('member_organizations')
      .select('id, name, membership_status, joined_at')
      .eq('id', memberId)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const { data: score } = await supabase
      .from('member_engagement_scores')
      .select('score')
      .eq('member_organization_id', memberId)
      .single()

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    
    const { data: activities } = await supabase
      .from('member_activities')
      .select('id')
      .eq('member_organization_id', memberId)
      .gte('activity_date', ninetyDaysAgo)

    const { data: events } = await supabase
      .from('event_registrations')
      .select('id')
      .eq('member_organization_id', memberId)
      .eq('attended', true)

    const { data: donations } = await supabase
      .from('donations')
      .select('amount_cents')
      .eq('donor_member_id', memberId)

    const { data: lastActivity } = await supabase
      .from('member_activities')
      .select('activity_date')
      .eq('member_organization_id', memberId)
      .order('activity_date', { ascending: false })
      .limit(1)
      .single()

    const prediction = await predictChurnRisk({
      memberName: member.name,
      status: member.membership_status,
      joinedAt: member.joined_at,
      lastActivityDate: lastActivity?.activity_date || null,
      engagementScore: score?.score || 0,
      activitiesLast90Days: activities?.length || 0,
      eventsAttended: events?.length || 0,
      totalDonations: donations?.reduce((sum, d) => sum + d.amount_cents, 0) || 0,
      renewalHistory: [],
    })

    await supabase
      .from('member_engagement_scores')
      .upsert({
        member_organization_id: memberId,
        predicted_churn_risk: prediction.riskScore,
        churn_risk_factors: prediction.factors,
        ai_recommendations: prediction.recommendations,
        prediction_updated_at: new Date().toISOString(),
      })

    return NextResponse.json(prediction)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
