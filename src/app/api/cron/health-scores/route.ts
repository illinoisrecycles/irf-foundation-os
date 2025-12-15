import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { emitAutomationEvent } from '@/lib/automation/event-emitter'

/**
 * Member Health Score Calculator
 * 
 * Weekly cron that:
 * 1. Calculates health scores for all members
 * 2. Identifies members whose scores dropped significantly
 * 3. Triggers alerts for at-risk members
 * 
 * Cron: 0 6 * * 1 (6 AM every Monday)
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = {
      organizations_processed: 0,
      members_scored: 0,
      alerts_triggered: 0,
      errors: [] as string[],
    }

    // Get all organizations
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name')

    for (const org of orgs || []) {
      try {
        const orgResults = await processOrganization(org.id)
        results.members_scored += orgResults.scored
        results.alerts_triggered += orgResults.alerts
        results.organizations_processed++
      } catch (err: any) {
        results.errors.push(`${org.name}: ${err.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    })

  } catch (error: any) {
    console.error('Health score calculation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function processOrganization(orgId: string): Promise<{ scored: number; alerts: number }> {
  let scored = 0
  let alerts = 0

  // Get all active members
  const { data: members } = await supabase
    .from('member_organizations')
    .select(`
      id,
      primary_contact_email,
      organization_name,
      joined_at,
      status,
      profile:profiles!primary_contact_email(id, full_name, email)
    `)
    .eq('organization_id', orgId)
    .eq('status', 'active')

  for (const member of members || []) {
    const profileId = (member.profile as any)?.id
    if (!profileId) continue

    const score = await calculateHealthScore(profileId, orgId, member)
    
    // Check for significant drops
    const { data: previousScore } = await supabase
      .from('member_health_scores')
      .select('score')
      .eq('organization_id', orgId)
      .eq('profile_id', profileId)
      .single()

    const scoreDrop = previousScore ? previousScore.score - score.total : 0
    const riskLevel = getRiskLevel(score.total)

    // Upsert health score
    await supabase.from('member_health_scores').upsert({
      organization_id: orgId,
      profile_id: profileId,
      member_org_id: member.id,
      score: score.total,
      previous_score: previousScore?.score || score.total,
      engagement_score: score.engagement,
      financial_score: score.financial,
      tenure_score: score.tenure,
      activity_score: score.activity,
      positive_signals: score.positiveSignals,
      negative_signals: score.negativeSignals,
      risk_level: riskLevel,
      last_calculated_at: new Date().toISOString(),
      last_engagement_at: score.lastEngagement,
    }, {
      onConflict: 'organization_id,profile_id',
    })

    scored++

    // Trigger alert if dropped by 10+ points or critical risk
    if (scoreDrop >= 10 || riskLevel === 'critical') {
      await emitAutomationEvent(orgId, 'member.health.alert', {
        profile_id: profileId,
        member_org_id: member.id,
        member_name: (member.profile as any)?.full_name || member.organization_name,
        member_email: member.primary_contact_email,
        current_score: score.total,
        previous_score: previousScore?.score,
        score_drop: scoreDrop,
        risk_level: riskLevel,
        negative_signals: score.negativeSignals,
      })
      alerts++
    }
  }

  return { scored, alerts }
}

interface HealthScore {
  total: number
  engagement: number
  financial: number
  tenure: number
  activity: number
  positiveSignals: string[]
  negativeSignals: string[]
  lastEngagement: string | null
}

async function calculateHealthScore(
  profileId: string,
  orgId: string,
  member: any
): Promise<HealthScore> {
  const positiveSignals: string[] = []
  const negativeSignals: string[] = []
  let lastEngagement: string | null = null

  const now = new Date()
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  // ===== ENGAGEMENT SCORE (events, volunteer hours) =====
  let engagementScore = 30 // Base score

  // Events attended in last 6 months
  const { count: eventCount } = await supabase
    .from('event_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .eq('status', 'attended')
    .gte('created_at', sixMonthsAgo.toISOString())

  if (eventCount && eventCount >= 3) {
    engagementScore += 40
    positiveSignals.push('attended_3plus_events')
  } else if (eventCount && eventCount >= 1) {
    engagementScore += 20
    positiveSignals.push('attended_event')
  } else {
    negativeSignals.push('no_events_6months')
  }

  // Volunteer hours
  const { data: volunteerData } = await supabase
    .from('volunteer_hours')
    .select('hours')
    .eq('profile_id', profileId)
    .gte('date', sixMonthsAgo.toISOString())

  const totalVolunteerHours = volunteerData?.reduce((sum, v) => sum + (v.hours || 0), 0) || 0
  if (totalVolunteerHours >= 20) {
    engagementScore += 30
    positiveSignals.push('active_volunteer')
  } else if (totalVolunteerHours >= 5) {
    engagementScore += 15
  }

  engagementScore = Math.min(100, engagementScore)

  // ===== FINANCIAL SCORE (donation recency, consistency) =====
  let financialScore = 30

  const { data: donations } = await supabase
    .from('donations')
    .select('amount_cents, created_at')
    .eq('organization_id', orgId)
    .or(`donor_profile_id.eq.${profileId},donor_email.eq.${member.primary_contact_email}`)
    .order('created_at', { ascending: false })
    .limit(20)

  if (donations && donations.length > 0) {
    const lastDonation = new Date(donations[0].created_at)
    lastEngagement = donations[0].created_at

    // Recency
    if (lastDonation > thirtyDaysAgo) {
      financialScore += 35
      positiveSignals.push('recent_donation')
    } else if (lastDonation > ninetyDaysAgo) {
      financialScore += 25
    } else if (lastDonation > sixMonthsAgo) {
      financialScore += 15
    } else {
      negativeSignals.push('no_donation_6months')
    }

    // Consistency (multiple donations in past year)
    const yearDonations = donations.filter(d => new Date(d.created_at) > oneYearAgo)
    if (yearDonations.length >= 4) {
      financialScore += 25
      positiveSignals.push('consistent_donor')
    } else if (yearDonations.length >= 2) {
      financialScore += 15
    }

    // Check for declining amounts
    if (yearDonations.length >= 2) {
      const recentAvg = yearDonations.slice(0, Math.ceil(yearDonations.length / 2))
        .reduce((sum, d) => sum + d.amount_cents, 0) / Math.ceil(yearDonations.length / 2)
      const olderAvg = yearDonations.slice(Math.ceil(yearDonations.length / 2))
        .reduce((sum, d) => sum + d.amount_cents, 0) / Math.floor(yearDonations.length / 2)
      
      if (olderAvg > 0 && recentAvg < olderAvg * 0.7) {
        negativeSignals.push('declining_donation_amount')
        financialScore -= 10
      } else if (recentAvg > olderAvg * 1.2) {
        positiveSignals.push('increasing_donations')
        financialScore += 10
      }
    }
  } else {
    negativeSignals.push('no_donations')
  }

  financialScore = Math.max(0, Math.min(100, financialScore))

  // ===== TENURE SCORE =====
  let tenureScore = 30
  const joinedAt = member.joined_at ? new Date(member.joined_at) : now

  const yearsAsMember = (now.getTime() - joinedAt.getTime()) / (365 * 24 * 60 * 60 * 1000)
  if (yearsAsMember >= 5) {
    tenureScore = 100
    positiveSignals.push('5plus_year_member')
  } else if (yearsAsMember >= 3) {
    tenureScore = 85
    positiveSignals.push('3plus_year_member')
  } else if (yearsAsMember >= 1) {
    tenureScore = 65
  } else {
    tenureScore = 40
    positiveSignals.push('new_member')
  }

  // ===== ACTIVITY SCORE (login, email engagement) =====
  let activityScore = 50 // Default - we may not have login data

  // Check for recent profile updates (proxy for activity)
  const { data: profile } = await supabase
    .from('profiles')
    .select('updated_at')
    .eq('id', profileId)
    .single()

  if (profile?.updated_at) {
    const lastUpdate = new Date(profile.updated_at)
    if (lastUpdate > thirtyDaysAgo) {
      activityScore = 80
      positiveSignals.push('recent_activity')
    } else if (lastUpdate > ninetyDaysAgo) {
      activityScore = 60
    } else {
      activityScore = 40
      negativeSignals.push('inactive_90days')
    }
  }

  // ===== CALCULATE TOTAL =====
  const totalScore = Math.round(
    engagementScore * 0.30 +
    financialScore * 0.30 +
    tenureScore * 0.20 +
    activityScore * 0.20
  )

  return {
    total: totalScore,
    engagement: engagementScore,
    financial: financialScore,
    tenure: tenureScore,
    activity: activityScore,
    positiveSignals,
    negativeSignals,
    lastEngagement,
  }
}

function getRiskLevel(score: number): string {
  if (score >= 70) return 'healthy'
  if (score >= 50) return 'watch'
  if (score >= 30) return 'at_risk'
  return 'critical'
}
