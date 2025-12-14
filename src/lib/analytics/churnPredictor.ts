/**
 * Donor Churn Prediction Algorithm
 * 
 * Advanced model combining RFM (Recency, Frequency, Monetary), 
 * engagement signals, and behavioral patterns to predict donor retention risk.
 * 
 * Target accuracy: 75-85% (industry benchmark for nonprofit churn prediction)
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface ChurnPrediction {
  profileId: string
  riskScore: number // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  factors: ChurnFactors
  recommendations: string[]
  explanation: string
}

export interface ChurnFactors {
  recency: { days: number; score: number }
  frequency: { perYear: number; score: number }
  monetary: { average: number; total: number; score: number }
  engagement: { score: number; details: string[] }
  behavioral: { flags: string[]; score: number }
  trend: { direction: 'up' | 'down' | 'stable'; score: number }
}

/**
 * Calculate churn risk for a single donor/member
 */
export async function predictChurnRisk(
  profileId: string,
  organizationId: string
): Promise<ChurnPrediction> {
  // Fetch all relevant data
  const [donations, events, volunteer, membership, loginActivity] = await Promise.all([
    fetchDonationHistory(profileId, organizationId),
    fetchEventAttendance(profileId, organizationId),
    fetchVolunteerActivity(profileId, organizationId),
    fetchMembershipData(profileId, organizationId),
    fetchLoginActivity(profileId),
  ])

  const factors: ChurnFactors = {
    recency: calculateRecency(donations),
    frequency: calculateFrequency(donations),
    monetary: calculateMonetary(donations),
    engagement: calculateEngagement(events, volunteer, loginActivity),
    behavioral: detectBehavioralFlags(donations, membership),
    trend: analyzeTrend(donations),
  }

  // Calculate weighted risk score
  const weights = {
    recency: 0.25,
    frequency: 0.20,
    monetary: 0.15,
    engagement: 0.20,
    behavioral: 0.15,
    trend: 0.05,
  }

  let riskScore = 0
  riskScore += (100 - factors.recency.score) * weights.recency
  riskScore += (100 - factors.frequency.score) * weights.frequency
  riskScore += (100 - factors.monetary.score) * weights.monetary
  riskScore += (100 - factors.engagement.score) * weights.engagement
  riskScore += factors.behavioral.score * weights.behavioral
  riskScore += (100 - factors.trend.score) * weights.trend

  riskScore = Math.min(100, Math.max(0, Math.round(riskScore)))

  const riskLevel = getRiskLevel(riskScore)
  const recommendations = generateRecommendations(factors, riskLevel)
  const explanation = await generateAIExplanation(factors, riskScore, riskLevel)

  // Save prediction
  await savePrediction(profileId, organizationId, riskScore, riskLevel, factors, recommendations)

  return {
    profileId,
    riskScore,
    riskLevel,
    factors,
    recommendations,
    explanation,
  }
}

/**
 * RFM Component Calculations
 */

function calculateRecency(donations: any[]): { days: number; score: number } {
  if (!donations.length) {
    return { days: 9999, score: 0 }
  }

  const lastDonation = new Date(donations[0].created_at)
  const days = Math.floor((Date.now() - lastDonation.getTime()) / (1000 * 60 * 60 * 24))

  // Scoring: <30 days = 100, 30-90 = 80, 90-180 = 60, 180-365 = 40, 365+ = 20
  let score = 100
  if (days > 365) score = 10
  else if (days > 180) score = 30
  else if (days > 90) score = 50
  else if (days > 30) score = 75

  return { days, score }
}

function calculateFrequency(donations: any[]): { perYear: number; score: number } {
  if (!donations.length) {
    return { perYear: 0, score: 0 }
  }

  const firstDonation = new Date(donations[donations.length - 1].created_at)
  const yearsActive = Math.max(1, (Date.now() - firstDonation.getTime()) / (365 * 24 * 60 * 60 * 1000))
  const perYear = donations.length / yearsActive

  // Scoring: 4+/year = 100, 2-4 = 80, 1-2 = 60, <1 = 30
  let score = 30
  if (perYear >= 4) score = 100
  else if (perYear >= 2) score = 80
  else if (perYear >= 1) score = 60

  return { perYear: Math.round(perYear * 10) / 10, score }
}

function calculateMonetary(donations: any[]): { average: number; total: number; score: number } {
  if (!donations.length) {
    return { average: 0, total: 0, score: 0 }
  }

  const total = donations.reduce((sum: number, d: any) => sum + (d.amount_cents || 0), 0)
  const average = total / donations.length

  // Scoring based on average gift (adjust thresholds per org)
  let score = 30
  if (average >= 50000) score = 100 // $500+
  else if (average >= 25000) score = 85 // $250+
  else if (average >= 10000) score = 70 // $100+
  else if (average >= 5000) score = 50 // $50+

  return { average: average / 100, total: total / 100, score }
}

/**
 * Engagement Calculation
 */

function calculateEngagement(
  events: any[],
  volunteer: any,
  loginActivity: any
): { score: number; details: string[] } {
  let score = 0
  const details: string[] = []

  // Event attendance (max 40 points)
  const eventScore = Math.min(40, events.length * 10)
  score += eventScore
  if (events.length > 0) {
    details.push(`Attended ${events.length} events`)
  }

  // Volunteer hours (max 30 points)
  const volunteerHours = volunteer?.totalHours || 0
  const volunteerScore = Math.min(30, volunteerHours * 2)
  score += volunteerScore
  if (volunteerHours > 0) {
    details.push(`${volunteerHours} volunteer hours`)
  }

  // Login recency (max 30 points)
  const daysSinceLogin = loginActivity?.daysSinceLogin || 999
  let loginScore = 0
  if (daysSinceLogin < 7) loginScore = 30
  else if (daysSinceLogin < 30) loginScore = 20
  else if (daysSinceLogin < 90) loginScore = 10
  score += loginScore

  if (details.length === 0) {
    details.push('No recent engagement activity')
  }

  return { score: Math.min(100, score), details }
}

/**
 * Behavioral Flag Detection
 */

function detectBehavioralFlags(
  donations: any[],
  membership: any
): { flags: string[]; score: number } {
  const flags: string[] = []
  let score = 0

  // Check for declining donation amounts
  if (donations.length >= 3) {
    const recent = donations.slice(0, 3).map((d: any) => d.amount_cents)
    const isDecreasing = recent[0] < recent[1] && recent[1] < recent[2]
    if (isDecreasing) {
      flags.push('Declining donation amounts')
      score += 30
    }
  }

  // Check for reduced frequency
  const recentYear = donations.filter((d: any) => 
    new Date(d.created_at) > new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
  ).length
  const previousYear = donations.filter((d: any) => {
    const date = new Date(d.created_at)
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    const twoYearsAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000)
    return date > twoYearsAgo && date <= oneYearAgo
  }).length

  if (previousYear > 0 && recentYear < previousYear * 0.5) {
    flags.push('Reduced giving frequency')
    score += 25
  }

  // Check membership status
  if (membership?.status === 'expired') {
    flags.push('Membership expired')
    score += 35
  } else if (membership?.status === 'lapsed') {
    flags.push('Membership lapsed')
    score += 40
  }

  // Check for downgrade
  if (membership?.previousTier && membership?.currentTier) {
    if (membership.previousTier > membership.currentTier) {
      flags.push('Downgraded membership tier')
      score += 20
    }
  }

  return { flags, score: Math.min(100, score) }
}

/**
 * Trend Analysis
 */

function analyzeTrend(donations: any[]): { direction: 'up' | 'down' | 'stable'; score: number } {
  if (donations.length < 4) {
    return { direction: 'stable', score: 50 }
  }

  // Compare first half vs second half of donation history
  const half = Math.floor(donations.length / 2)
  const recentHalf = donations.slice(0, half)
  const olderHalf = donations.slice(half)

  const recentAvg = recentHalf.reduce((s: number, d: any) => s + d.amount_cents, 0) / recentHalf.length
  const olderAvg = olderHalf.reduce((s: number, d: any) => s + d.amount_cents, 0) / olderHalf.length

  const change = (recentAvg - olderAvg) / olderAvg

  if (change > 0.15) {
    return { direction: 'up', score: 85 }
  } else if (change < -0.15) {
    return { direction: 'down', score: 25 }
  }
  return { direction: 'stable', score: 50 }
}

/**
 * Risk Level Classification
 */

function getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 75) return 'critical'
  if (score >= 55) return 'high'
  if (score >= 35) return 'medium'
  return 'low'
}

/**
 * Generate Action Recommendations
 */

function generateRecommendations(factors: ChurnFactors, riskLevel: string): string[] {
  const recommendations: string[] = []

  if (factors.recency.days > 180) {
    recommendations.push('Send personalized re-engagement email')
  }

  if (factors.engagement.score < 40) {
    recommendations.push('Invite to upcoming event or volunteer opportunity')
  }

  if (factors.behavioral.flags.includes('Declining donation amounts')) {
    recommendations.push('Schedule personal call from development officer')
  }

  if (factors.behavioral.flags.includes('Membership expired')) {
    recommendations.push('Send renewal reminder with special offer')
  }

  if (riskLevel === 'critical') {
    recommendations.push('Escalate to major gifts officer for personal outreach')
    recommendations.push('Consider special recognition or stewardship gift')
  }

  if (recommendations.length === 0) {
    recommendations.push('Maintain regular communication cadence')
    recommendations.push('Include in quarterly impact report distribution')
  }

  return recommendations
}

/**
 * AI-Generated Explanation
 */

async function generateAIExplanation(
  factors: ChurnFactors,
  riskScore: number,
  riskLevel: string
): Promise<string> {
  const prompt = `Generate a brief 2-3 sentence explanation for this donor churn prediction.

Risk Score: ${riskScore}/100 (${riskLevel})
Key Factors:
- Last donation: ${factors.recency.days} days ago
- Giving frequency: ${factors.frequency.perYear} per year
- Average gift: $${factors.monetary.average}
- Engagement score: ${factors.engagement.score}/100
- Behavioral flags: ${factors.behavioral.flags.join(', ') || 'None'}
- Trend: ${factors.trend.direction}

Be actionable and specific. Don't repeat the numbers, interpret them.`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.3,
    })

    return completion.choices[0].message.content || ''
  } catch {
    return `This donor shows ${riskLevel} risk indicators based on giving patterns and engagement levels.`
  }
}

/**
 * Data Fetchers
 */

async function fetchDonationHistory(profileId: string, orgId: string) {
  const { data } = await supabase
    .from('donations')
    .select('*')
    .or(`donor_profile_id.eq.${profileId},donor_email.eq.(SELECT email FROM profiles WHERE id = '${profileId}')`)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
  return data || []
}

async function fetchEventAttendance(profileId: string, orgId: string) {
  const { data } = await supabase
    .from('event_registrations')
    .select('*, event:events(organization_id)')
    .eq('profile_id', profileId)
    .eq('status', 'attended')
  return data?.filter((r: any) => r.event?.organization_id === orgId) || []
}

async function fetchVolunteerActivity(profileId: string, orgId: string) {
  const { data } = await supabase
    .from('volunteer_hours')
    .select('hours')
    .eq('user_id', profileId)
    .eq('organization_id', orgId)
    .eq('status', 'approved')
  
  const totalHours = data?.reduce((sum, h) => sum + (h.hours || 0), 0) || 0
  return { totalHours }
}

async function fetchMembershipData(profileId: string, orgId: string) {
  const { data } = await supabase
    .from('member_organizations')
    .select('*')
    .eq('primary_contact_email', `(SELECT email FROM profiles WHERE id = '${profileId}')`)
    .eq('organization_id', orgId)
    .single()
  return data
}

async function fetchLoginActivity(profileId: string) {
  // Would integrate with Supabase Auth audit log
  return { daysSinceLogin: 30 } // Placeholder
}

/**
 * Save Prediction to Database
 */

async function savePrediction(
  profileId: string,
  orgId: string,
  riskScore: number,
  riskLevel: string,
  factors: ChurnFactors,
  recommendations: string[]
) {
  await supabase.from('donor_churn_predictions').upsert({
    organization_id: orgId,
    profile_id: profileId,
    recency_days: factors.recency.days,
    frequency_score: factors.frequency.perYear,
    monetary_avg_cents: Math.round(factors.monetary.average * 100),
    event_attendance_count: factors.engagement.details.length,
    declining_amounts: factors.behavioral.flags.includes('Declining donation amounts'),
    reduced_frequency: factors.behavioral.flags.includes('Reduced giving frequency'),
    risk_score: riskScore,
    risk_level: riskLevel,
    primary_risk_factors: factors.behavioral.flags,
    recommended_actions: recommendations,
    calculated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id, profile_id' })
}

/**
 * Batch process all donors for an organization
 */
export async function runChurnAnalysis(organizationId: string): Promise<{
  processed: number
  critical: number
  high: number
  medium: number
  low: number
}> {
  // Get all donors/members
  const { data: profiles } = await supabase
    .from('donations')
    .select('donor_profile_id')
    .eq('organization_id', organizationId)
    .not('donor_profile_id', 'is', null)

  const uniqueProfiles = [...new Set(profiles?.map(p => p.donor_profile_id) || [])]

  const results = { processed: 0, critical: 0, high: 0, medium: 0, low: 0 }

  for (const profileId of uniqueProfiles) {
    try {
      const prediction = await predictChurnRisk(profileId, organizationId)
      results.processed++
      results[prediction.riskLevel]++
    } catch (err) {
      console.error(`Churn prediction failed for ${profileId}:`, err)
    }
  }

  return results
}
