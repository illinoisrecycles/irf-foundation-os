import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * POST /api/reports/ai-narrative
 * Generate AI-powered narrative reports (annual, quarterly, donor, grant)
 */
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { 
      report_type = 'annual_impact',
      year = new Date().getFullYear(),
      period_start,
      period_end,
      audience = 'general', // general, donors, board, funders
      tone = 'inspiring', // inspiring, formal, casual
      include_financials = false,
    } = await req.json()

    // Get organization
    const { data: member } = await supabase
      .from('organization_members')
      .select('organization_id, organization:organizations(*)')
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'No organization' }, { status: 404 })
    }

    const org = member.organization as any
    const orgId = member.organization_id

    // Gather all metrics for the period
    const metrics = await gatherReportMetrics(supabase, orgId, year, period_start, period_end)

    // Generate narrative based on report type
    let prompt = ''
    let maxTokens = 2000

    switch (report_type) {
      case 'annual_impact':
        prompt = buildAnnualReportPrompt(org, metrics, year, audience, tone, include_financials)
        maxTokens = 3000
        break
      case 'quarterly_summary':
        prompt = buildQuarterlyPrompt(org, metrics, audience, tone)
        maxTokens = 1500
        break
      case 'donor_report':
        prompt = buildDonorReportPrompt(org, metrics, tone)
        maxTokens = 1200
        break
      case 'grant_report':
        prompt = buildGrantReportPrompt(org, metrics)
        maxTokens = 2000
        break
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }

    // Generate with GPT-4o
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert nonprofit communications writer. You create compelling, data-driven narratives that inspire action while remaining credible and authentic. You never use generic filler language—every sentence conveys meaning. You balance storytelling with concrete metrics.`
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    })

    const narrative = completion.choices[0].message.content

    // Save to database
    const { data: report, error } = await supabase
      .from('generated_reports')
      .insert({
        organization_id: orgId,
        report_type,
        title: `${year} ${report_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
        period_start: period_start || `${year}-01-01`,
        period_end: period_end || `${year}-12-31`,
        content: narrative,
        metrics,
        generated_by: user.id,
      })
      .select()
      .single()

    return NextResponse.json({
      success: true,
      report_id: report?.id,
      narrative,
      metrics,
      word_count: narrative?.split(/\s+/).length,
    })

  } catch (error: any) {
    console.error('Narrative generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Generation failed' },
      { status: 500 }
    )
  }
}

async function gatherReportMetrics(
  supabase: any, 
  orgId: string, 
  year: number,
  periodStart?: string,
  periodEnd?: string
) {
  const startDate = periodStart || `${year}-01-01`
  const endDate = periodEnd || `${year}-12-31`

  const [
    membersResult,
    donationsResult,
    eventsResult,
    volunteerResult,
    programsResult,
    beneficiariesResult,
    outcomesResult,
    grantsResult,
  ] = await Promise.all([
    // Members
    supabase
      .from('member_organizations')
      .select('status, joined_at')
      .eq('organization_id', orgId),

    // Donations
    supabase
      .from('donations')
      .select('amount_cents, donation_type, created_at')
      .eq('organization_id', orgId)
      .gte('created_at', startDate)
      .lte('created_at', endDate),

    // Events
    supabase
      .from('events')
      .select('title, registered_count, date_start')
      .eq('organization_id', orgId)
      .gte('date_start', startDate)
      .lte('date_start', endDate),

    // Volunteer hours
    supabase
      .from('volunteer_hours')
      .select('hours')
      .eq('organization_id', orgId)
      .eq('status', 'approved')
      .gte('date', startDate)
      .lte('date', endDate),

    // Programs
    supabase
      .from('programs')
      .select('title, status, goal')
      .eq('organization_id', orgId)
      .eq('status', 'active'),

    // Beneficiaries
    supabase
      .from('beneficiaries')
      .select('id, status')
      .gte('enrollment_date', startDate)
      .lte('enrollment_date', endDate),

    // Outcomes
    supabase
      .from('outcome_data')
      .select('value, indicator:outcome_indicators(name, unit)')
      .gte('reported_date', startDate)
      .lte('reported_date', endDate),

    // Grants
    supabase
      .from('grant_applications')
      .select('requested_amount_cents, status')
      .eq('organization_id', orgId)
      .gte('submitted_at', startDate)
      .lte('submitted_at', endDate),
  ])

  // Calculate metrics
  const donations = donationsResult.data || []
  const totalRevenue = donations.reduce((sum: number, d: any) => sum + (d.amount_cents || 0), 0) / 100
  const donorCount = new Set(donations.map((d: any) => d.donor_email)).size

  const volunteers = volunteerResult.data || []
  const totalVolunteerHours = volunteers.reduce((sum: number, v: any) => sum + (v.hours || 0), 0)

  const events = eventsResult.data || []
  const totalAttendees = events.reduce((sum: number, e: any) => sum + (e.registered_count || 0), 0)

  const grants = grantsResult.data || []
  const grantsFunded = grants.filter((g: any) => g.status === 'funded').length
  const grantsRequested = grants.reduce((sum: number, g: any) => sum + (g.requested_amount_cents || 0), 0) / 100

  const members = membersResult.data || []
  const activeMembers = members.filter((m: any) => m.status === 'active').length
  const newMembers = members.filter((m: any) => 
    new Date(m.joined_at) >= new Date(startDate)
  ).length

  // Aggregate outcomes by indicator
  const outcomes = outcomesResult.data || []
  const outcomesByIndicator: Record<string, number> = {}
  outcomes.forEach((o: any) => {
    const name = o.indicator?.name || 'Other'
    outcomesByIndicator[name] = (outcomesByIndicator[name] || 0) + (o.value || 0)
  })

  return {
    period: { start: startDate, end: endDate },
    financial: {
      totalRevenue,
      donorCount,
      donationCount: donations.length,
      averageGift: donations.length > 0 ? Math.round(totalRevenue / donations.length) : 0,
      grantsRequested,
      grantsFunded,
    },
    membership: {
      activeMembers,
      newMembers,
      totalMembers: members.length,
    },
    engagement: {
      eventsHeld: events.length,
      totalAttendees,
      volunteerHours: Math.round(totalVolunteerHours),
      volunteerCount: volunteers.length,
    },
    impact: {
      beneficiariesServed: beneficiariesResult.data?.length || 0,
      programsActive: programsResult.data?.length || 0,
      outcomes: outcomesByIndicator,
    },
    highlights: {
      topEvents: events.slice(0, 3).map((e: any) => e.title),
      topPrograms: programsResult.data?.slice(0, 3).map((p: any) => p.title) || [],
    },
  }
}

function buildAnnualReportPrompt(
  org: any, 
  metrics: any, 
  year: number, 
  audience: string,
  tone: string,
  includeFinancials: boolean
): string {
  return `Write a compelling annual impact report (1000-1500 words) for ${org.name}.

ORGANIZATION CONTEXT:
- Mission: ${org.mission_statement || 'Building a sustainable future'}
- Focus Areas: ${org.focus_areas?.join(', ') || 'Environmental sustainability'}
- Year: ${year}

KEY METRICS FOR ${year}:
📊 IMPACT
- People Served: ${metrics.impact.beneficiariesServed.toLocaleString()}
- Active Programs: ${metrics.impact.programsActive}
- Outcomes: ${JSON.stringify(metrics.impact.outcomes)}

👥 ENGAGEMENT
- Events Held: ${metrics.engagement.eventsHeld}
- Total Attendees: ${metrics.engagement.totalAttendees.toLocaleString()}
- Volunteer Hours: ${metrics.engagement.volunteerHours.toLocaleString()}

🤝 MEMBERSHIP
- Active Members: ${metrics.membership.activeMembers}
- New Members This Year: ${metrics.membership.newMembers}

${includeFinancials ? `
💰 FINANCIAL
- Total Revenue: $${metrics.financial.totalRevenue.toLocaleString()}
- Number of Donors: ${metrics.financial.donorCount}
- Grants Awarded: ${metrics.financial.grantsFunded}
` : ''}

HIGHLIGHTS:
- Top Events: ${metrics.highlights.topEvents.join(', ')}
- Top Programs: ${metrics.highlights.topPrograms.join(', ')}

AUDIENCE: ${audience}
TONE: ${tone}

STRUCTURE YOUR REPORT:
1. Engaging Opening (connect emotionally, set the stage)
2. Year in Review (major accomplishments, milestones)
3. Impact by Program Area (with specific metrics and stories)
4. Community Engagement (volunteers, events, partnerships)
5. Looking Ahead (vision for next year)
6. Gratitude & Call to Action (thank supporters, invite continued involvement)

REQUIREMENTS:
- Use active voice
- Include specific numbers (don't round excessively)
- Create vivid imagery
- Balance storytelling with data
- End with inspiring call to action
- Do NOT use generic phrases like "we're proud" or "we're excited"
- Make every sentence count`
}

function buildQuarterlyPrompt(org: any, metrics: any, audience: string, tone: string): string {
  return `Write a quarterly progress update (500-700 words) for ${org.name}.

Period: ${metrics.period.start} to ${metrics.period.end}

KEY HIGHLIGHTS:
- Beneficiaries Served: ${metrics.impact.beneficiariesServed}
- Events Held: ${metrics.engagement.eventsHeld}
- Volunteer Hours: ${metrics.engagement.volunteerHours}
- New Members: ${metrics.membership.newMembers}

TONE: ${tone}
AUDIENCE: ${audience}

Include:
1. Quarter highlights (2-3 key wins)
2. Program updates
3. Upcoming initiatives
4. Thank supporters

Keep it concise, energetic, and action-oriented.`
}

function buildDonorReportPrompt(org: any, metrics: any, tone: string): string {
  return `Write a donor impact report (400-600 words) for ${org.name}.

YOUR GIFT AT WORK:
- People Reached: ${metrics.impact.beneficiariesServed}
- Programs Funded: ${metrics.impact.programsActive}
- Community Events: ${metrics.engagement.eventsHeld}

DONOR COMMUNITY:
- Fellow Donors: ${metrics.financial.donorCount}
- Volunteer Hours: ${metrics.engagement.volunteerHours}

Create a warm, personal letter that:
1. Thanks donors sincerely (without being generic)
2. Shows specific impact of their gifts
3. Shares one compelling story
4. Invites continued partnership

TONE: ${tone}
Make donors feel like valued partners, not ATMs.`
}

function buildGrantReportPrompt(org: any, metrics: any): string {
  return `Write a grant progress report (800-1000 words) for ${org.name}.

GRANT PERIOD OUTCOMES:
${JSON.stringify(metrics.impact.outcomes, null, 2)}

BENEFICIARIES: ${metrics.impact.beneficiariesServed}
PROGRAMS: ${metrics.impact.programsActive}

Include:
1. Executive Summary
2. Progress Against Goals (with specific metrics)
3. Challenges & Adaptations
4. Success Stories (1-2 brief examples)
5. Financial Summary Overview
6. Next Steps

TONE: Professional, evidence-based, transparent
Format for grant compliance while remaining readable.`
}
