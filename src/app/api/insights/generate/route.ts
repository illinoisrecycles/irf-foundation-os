import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface InsightData {
  insight_type: 'trend' | 'warning' | 'opportunity' | 'recommendation'
  category: string
  title: string
  message: string
  data?: Record<string, any>
  action_url?: string
  action_label?: string
  priority: number
}

/**
 * POST /api/insights/generate
 * Generate AI-powered insights from organizational data
 */
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get organization context
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!orgMember) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const orgId = orgMember.organization_id

    // Gather metrics for analysis
    const metrics = await gatherMetrics(supabase, orgId)

    // Generate insights using rules + AI
    const insights = await generateInsights(metrics, orgId)

    // Save insights
    if (insights.length > 0) {
      const { error } = await supabase
        .from('ai_insights')
        .insert(insights.map(i => ({ ...i, organization_id: orgId })))

      if (error) {
        console.error('Failed to save insights:', error)
      }
    }

    return NextResponse.json({
      success: true,
      insights_generated: insights.length,
    })

  } catch (error: any) {
    console.error('Insights generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate insights' },
      { status: 500 }
    )
  }
}

async function gatherMetrics(supabase: any, orgId: string) {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
  const yearStart = new Date(now.getFullYear(), 0, 1)

  // Parallel queries for efficiency
  const [
    membersResult,
    recentDonations,
    olderDonations,
    eventsResult,
    volunteersResult,
    grantsResult,
  ] = await Promise.all([
    // Members
    supabase
      .from('member_organizations')
      .select('status, expires_at')
      .eq('organization_id', orgId),

    // Recent donations (last 30 days)
    supabase
      .from('donations')
      .select('amount_cents, created_at')
      .eq('organization_id', orgId)
      .gte('created_at', thirtyDaysAgo.toISOString()),

    // Older donations (30-60 days ago)
    supabase
      .from('donations')
      .select('amount_cents')
      .eq('organization_id', orgId)
      .gte('created_at', sixtyDaysAgo.toISOString())
      .lt('created_at', thirtyDaysAgo.toISOString()),

    // Events
    supabase
      .from('events')
      .select('date_start, registered_count, capacity')
      .eq('organization_id', orgId)
      .gte('date_start', now.toISOString()),

    // Volunteers
    supabase
      .from('volunteer_hours')
      .select('hours')
      .eq('organization_id', orgId)
      .eq('status', 'approved')
      .gte('date', yearStart.toISOString()),

    // Grants
    supabase
      .from('external_grant_opportunities')
      .select('match_score, deadline, status')
      .eq('organization_id', orgId)
      .in('status', ['recommended', 'high_priority']),
  ])

  // Calculate metrics
  const members = membersResult.data || []
  const activeMembers = members.filter((m: any) => m.status === 'active').length
  const expiringMembers = members.filter((m: any) => {
    if (!m.expires_at) return false
    const expiry = new Date(m.expires_at)
    return expiry > now && expiry < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  }).length

  const recentDonationTotal = (recentDonations.data || [])
    .reduce((sum: number, d: any) => sum + (d.amount_cents || 0), 0)
  const olderDonationTotal = (olderDonations.data || [])
    .reduce((sum: number, d: any) => sum + (d.amount_cents || 0), 0)

  const donationChange = olderDonationTotal > 0
    ? ((recentDonationTotal - olderDonationTotal) / olderDonationTotal) * 100
    : 0

  const upcomingEvents = (eventsResult.data || []).length
  const lowAttendanceEvents = (eventsResult.data || []).filter((e: any) => 
    e.capacity && e.registered_count < e.capacity * 0.3
  ).length

  const volunteerHours = (volunteersResult.data || [])
    .reduce((sum: number, v: any) => sum + (v.hours || 0), 0)

  const highMatchGrants = (grantsResult.data || []).filter((g: any) => g.match_score >= 0.8).length
  const urgentGrants = (grantsResult.data || []).filter((g: any) => {
    const deadline = new Date(g.deadline)
    return deadline > now && deadline < new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  }).length

  return {
    membership: {
      total: members.length,
      active: activeMembers,
      expiringSoon: expiringMembers,
      renewalRate: members.length > 0 ? (activeMembers / members.length) * 100 : 0,
    },
    donations: {
      recent30Days: recentDonationTotal / 100,
      previous30Days: olderDonationTotal / 100,
      changePercent: Math.round(donationChange),
      recentCount: (recentDonations.data || []).length,
    },
    events: {
      upcoming: upcomingEvents,
      lowAttendance: lowAttendanceEvents,
    },
    volunteers: {
      hoursYTD: volunteerHours,
    },
    grants: {
      highMatches: highMatchGrants,
      urgentDeadlines: urgentGrants,
    },
  }
}

async function generateInsights(metrics: any, orgId: string): Promise<InsightData[]> {
  const insights: InsightData[] = []

  // Rule-based insights

  // Membership warnings
  if (metrics.membership.expiringSoon > 0) {
    insights.push({
      insight_type: 'warning',
      category: 'membership',
      title: `${metrics.membership.expiringSoon} Memberships Expiring Soon`,
      message: `You have ${metrics.membership.expiringSoon} members whose memberships will expire in the next 30 days. Consider sending renewal reminders.`,
      action_url: '/admin/members?filter=expiring',
      action_label: 'View Expiring Members',
      priority: 8,
    })
  }

  if (metrics.membership.renewalRate < 75) {
    insights.push({
      insight_type: 'warning',
      category: 'membership',
      title: 'Low Membership Renewal Rate',
      message: `Your renewal rate is ${Math.round(metrics.membership.renewalRate)}%, below the 75% benchmark. Consider a re-engagement campaign.`,
      action_url: '/admin/automation/templates/lapsed-reengagement',
      action_label: 'Set Up Re-engagement',
      priority: 9,
      data: { renewalRate: metrics.membership.renewalRate },
    })
  }

  // Donation trends
  if (metrics.donations.changePercent >= 20) {
    insights.push({
      insight_type: 'trend',
      category: 'donations',
      title: `Donations Up ${metrics.donations.changePercent}%`,
      message: `Great news! Donations are up ${metrics.donations.changePercent}% compared to the previous month. Consider sending thank-you notes to recent donors.`,
      action_url: '/admin/donations',
      action_label: 'View Donations',
      priority: 6,
      data: { change: metrics.donations.changePercent },
    })
  } else if (metrics.donations.changePercent <= -20) {
    insights.push({
      insight_type: 'warning',
      category: 'donations',
      title: `Donations Down ${Math.abs(metrics.donations.changePercent)}%`,
      message: `Donations have decreased by ${Math.abs(metrics.donations.changePercent)}% compared to last month. Consider launching an appeal or reviewing recent communications.`,
      action_url: '/admin/donations/campaigns',
      action_label: 'Create Campaign',
      priority: 9,
      data: { change: metrics.donations.changePercent },
    })
  }

  // Event opportunities
  if (metrics.events.lowAttendance > 0) {
    insights.push({
      insight_type: 'opportunity',
      category: 'events',
      title: 'Events Need Promotion',
      message: `${metrics.events.lowAttendance} upcoming events have low registration. Boost attendance with targeted promotion.`,
      action_url: '/admin/events',
      action_label: 'View Events',
      priority: 7,
    })
  }

  // Grant opportunities
  if (metrics.grants.highMatches > 0) {
    insights.push({
      insight_type: 'opportunity',
      category: 'grants',
      title: `${metrics.grants.highMatches} High-Match Grant Opportunities`,
      message: `AI has found ${metrics.grants.highMatches} federal grants that are strong matches for your organization.`,
      action_url: '/portal/grants/opportunities',
      action_label: 'View Opportunities',
      priority: 8,
    })
  }

  if (metrics.grants.urgentDeadlines > 0) {
    insights.push({
      insight_type: 'warning',
      category: 'grants',
      title: 'Grant Deadlines Approaching',
      message: `${metrics.grants.urgentDeadlines} grant opportunities have deadlines within 14 days. Review and apply soon.`,
      action_url: '/portal/grants/opportunities?urgent=true',
      action_label: 'View Urgent Grants',
      priority: 9,
    })
  }

  // Generate AI-powered strategic insight
  const aiInsight = await generateAIStrategicInsight(metrics)
  if (aiInsight) {
    insights.push(aiInsight)
  }

  return insights
}

async function generateAIStrategicInsight(metrics: any): Promise<InsightData | null> {
  try {
    const prompt = `Analyze these nonprofit metrics and provide ONE strategic insight:

Membership: ${metrics.membership.active} active of ${metrics.membership.total} total (${Math.round(metrics.membership.renewalRate)}% renewal)
Donations: $${metrics.donations.recent30Days.toLocaleString()} last 30 days (${metrics.donations.changePercent > 0 ? '+' : ''}${metrics.donations.changePercent}% change)
Upcoming Events: ${metrics.events.upcoming}
Volunteer Hours YTD: ${metrics.volunteers.hoursYTD}
Grant Opportunities: ${metrics.grants.highMatches} high matches

Respond in JSON format:
{
  "title": "Brief headline (max 60 chars)",
  "message": "2-3 sentence actionable insight",
  "category": "membership|donations|events|volunteers|grants|strategy",
  "priority": 1-10
}

Focus on actionable recommendations. Be specific and data-driven.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 200,
      temperature: 0.5,
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')
    
    if (result.title && result.message) {
      return {
        insight_type: 'recommendation',
        category: result.category || 'strategy',
        title: result.title,
        message: result.message,
        priority: result.priority || 7,
        data: { ai_generated: true },
      }
    }
  } catch (error) {
    console.error('AI insight generation failed:', error)
  }

  return null
}
