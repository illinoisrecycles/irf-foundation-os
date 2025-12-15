import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Member Health Score Calculator API
 * 
 * GET - Retrieve health scores
 * POST - Calculate/recalculate health scores for all members
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const url = new URL(req.url)
  const riskLevel = url.searchParams.get('risk_level')
  const limit = parseInt(url.searchParams.get('limit') || '100')

  let query = supabase
    .from('member_health_scores')
    .select(`
      *,
      profile:profiles(full_name, email, avatar_url)
    `)
    .order('score', { ascending: true })

  if (riskLevel && riskLevel !== 'all') {
    query = query.eq('risk_level', riskLevel)
  }

  const { data, error } = await query.limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Summary stats
  const scores = data || []
  const summary = {
    total: scores.length,
    healthy: scores.filter(s => s.risk_level === 'healthy').length,
    watch: scores.filter(s => s.risk_level === 'watch').length,
    at_risk: scores.filter(s => s.risk_level === 'at_risk').length,
    critical: scores.filter(s => s.risk_level === 'critical').length,
    average_score: scores.length > 0 
      ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
      : 0,
  }

  return NextResponse.json({ scores, summary })
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { profile_id, organization_id } = body

    // If specific profile, calculate just that one
    if (profile_id && organization_id) {
      const score = await calculateMemberHealthScore(profile_id, organization_id)
      return NextResponse.json({ success: true, score })
    }

    // Otherwise, batch calculate for all active members
    const { data: members, error: membersError } = await supabase
      .from('member_organizations')
      .select('id, organization_id, primary_contact_email')
      .eq('status', 'active')
      .limit(500)

    if (membersError) {
      return NextResponse.json({ error: membersError.message }, { status: 500 })
    }

    let calculated = 0
    let errors = 0

    for (const member of members || []) {
      // Get profile ID from email
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', member.primary_contact_email)
        .single()

      if (profile) {
        try {
          await calculateMemberHealthScore(profile.id, member.organization_id)
          calculated++
        } catch (err) {
          errors++
        }
      }
    }

    return NextResponse.json({
      success: true,
      calculated,
      errors,
      total: members?.length || 0,
    })

  } catch (error: any) {
    console.error('Health score calculation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Calculate health score for a single member
 */
async function calculateMemberHealthScore(profileId: string, orgId: string): Promise<number> {
  const now = new Date()
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
  const twoYearsAgo = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000)

  // Parallel queries
  const [
    eventsResult,
    donationsResult,
    membershipResult,
    volunteerResult,
  ] = await Promise.all([
    // Events attended in last 6 months
    supabase
      .from('event_registrations')
      .select('id, event:events!inner(organization_id, date_start)')
      .eq('profile_id', profileId)
      .eq('status', 'attended')
      .gte('event.date_start', sixMonthsAgo.toISOString()),

    // Donations in last 2 years
    supabase
      .from('donations')
      .select('id, amount_cents, created_at')
      .eq('donor_profile_id', profileId)
      .eq('organization_id', orgId)
      .gte('created_at', twoYearsAgo.toISOString())
      .order('created_at', { ascending: false }),

    // Membership info
    supabase
      .from('member_organizations')
      .select('joined_at, expires_at, status')
      .eq('organization_id', orgId)
      .single(),

    // Volunteer hours
    supabase
      .from('volunteer_hours')
      .select('hours')
      .eq('profile_id', profileId)
      .gte('date', oneYearAgo.toISOString().split('T')[0]),
  ])

  // Calculate component scores
  const eventCount = (eventsResult.data || []).filter(
    (e: any) => e.event?.organization_id === orgId
  ).length
  const engagementScore = Math.min(100, 30 + (eventCount * 15))

  // Financial score based on donation recency
  const donations = donationsResult.data || []
  const lastDonation = donations[0]
  let financialScore = 30 // Base

  if (lastDonation) {
    const daysSinceDonation = Math.floor(
      (now.getTime() - new Date(lastDonation.created_at).getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysSinceDonation < 90) financialScore = 90
    else if (daysSinceDonation < 180) financialScore = 70
    else if (daysSinceDonation < 365) financialScore = 50
    else financialScore = 30
  }

  // Tenure score
  let tenureScore = 40
  const membership = membershipResult.data
  if (membership?.joined_at) {
    const yearsAsMember = (now.getTime() - new Date(membership.joined_at).getTime()) / (365 * 24 * 60 * 60 * 1000)
    if (yearsAsMember >= 5) tenureScore = 100
    else if (yearsAsMember >= 2) tenureScore = 80
    else if (yearsAsMember >= 1) tenureScore = 60
    else tenureScore = 40
  }

  // Activity score (volunteer hours + general activity)
  const totalVolunteerHours = (volunteerResult.data || []).reduce((sum: number, v: any) => sum + (v.hours || 0), 0)
  const activityScore = Math.min(100, 30 + (totalVolunteerHours * 5))

  // Weighted final score
  const finalScore = Math.round(
    engagementScore * 0.3 +
    financialScore * 0.3 +
    tenureScore * 0.2 +
    activityScore * 0.2
  )

  // Determine risk level
  let riskLevel: string
  if (finalScore >= 70) riskLevel = 'healthy'
  else if (finalScore >= 50) riskLevel = 'watch'
  else if (finalScore >= 30) riskLevel = 'at_risk'
  else riskLevel = 'critical'

  // Build signals
  const positiveSignals: string[] = []
  const negativeSignals: string[] = []

  if (eventCount >= 3) positiveSignals.push('frequent_event_attendee')
  if (donations.length >= 2) positiveSignals.push('repeat_donor')
  if (totalVolunteerHours >= 20) positiveSignals.push('active_volunteer')

  if (eventCount === 0) negativeSignals.push('no_recent_events')
  if (!lastDonation) negativeSignals.push('no_donations')
  if (membership?.status === 'expired') negativeSignals.push('membership_expired')

  // Check for declining donations
  if (donations.length >= 2) {
    const recent = donations.slice(0, Math.ceil(donations.length / 2))
    const older = donations.slice(Math.ceil(donations.length / 2))
    const recentAvg = recent.reduce((sum, d) => sum + d.amount_cents, 0) / recent.length
    const olderAvg = older.reduce((sum, d) => sum + d.amount_cents, 0) / older.length
    if (recentAvg < olderAvg * 0.7) {
      negativeSignals.push('declining_donation_amounts')
    }
  }

  // Get previous score
  const { data: existing } = await supabase
    .from('member_health_scores')
    .select('score')
    .eq('profile_id', profileId)
    .eq('organization_id', orgId)
    .single()

  // Upsert
  await supabase
    .from('member_health_scores')
    .upsert({
      organization_id: orgId,
      profile_id: profileId,
      score: finalScore,
      previous_score: existing?.score || null,
      engagement_score: engagementScore,
      financial_score: financialScore,
      tenure_score: tenureScore,
      activity_score: activityScore,
      risk_level: riskLevel,
      positive_signals: positiveSignals,
      negative_signals: negativeSignals,
      last_calculated_at: now.toISOString(),
    }, {
      onConflict: 'organization_id,profile_id',
    })

  return finalScore
}
