import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateBoardReportSummary } from '@/lib/ai'

export async function GET(req: Request) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('organization_id')
  const period = searchParams.get('period') || 'ytd' // ytd, q1, q2, q3, q4, month

  if (!orgId) {
    return NextResponse.json({ error: 'organization_id required' }, { status: 400 })
  }

  try {
    // Calculate date range
    const now = new Date()
    let startDate: Date
    let periodLabel: string

    switch (period) {
      case 'q1':
        startDate = new Date(now.getFullYear(), 0, 1)
        periodLabel = `Q1 ${now.getFullYear()}`
        break
      case 'q2':
        startDate = new Date(now.getFullYear(), 3, 1)
        periodLabel = `Q2 ${now.getFullYear()}`
        break
      case 'q3':
        startDate = new Date(now.getFullYear(), 6, 1)
        periodLabel = `Q3 ${now.getFullYear()}`
        break
      case 'q4':
        startDate = new Date(now.getFullYear(), 9, 1)
        periodLabel = `Q4 ${now.getFullYear()}`
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        periodLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' })
        break
      default: // ytd
        startDate = new Date(now.getFullYear(), 0, 1)
        periodLabel = `YTD ${now.getFullYear()}`
    }

    // Fetch membership stats
    const { data: members } = await supabase
      .from('member_organizations')
      .select('id, membership_status, joined_at, expires_at')
      .eq('organization_id', orgId)

    const totalMembers = members?.filter(m => m.membership_status === 'active').length || 0
    const newMembers = members?.filter(m => 
      new Date(m.joined_at) >= startDate && m.membership_status === 'active'
    ).length || 0
    const expiredMembers = members?.filter(m =>
      m.expires_at && new Date(m.expires_at) >= startDate && new Date(m.expires_at) < now && m.membership_status === 'expired'
    ).length || 0

    // Calculate retention (simplified)
    const previousActive = totalMembers + expiredMembers
    const retentionRate = previousActive > 0 ? Math.round((totalMembers / previousActive) * 100) : 100

    // Fetch financial data
    const { data: payments } = await supabase
      .from('payments')
      .select('amount_cents, payment_type, status')
      .eq('organization_id', orgId)
      .eq('status', 'succeeded')
      .gte('created_at', startDate.toISOString())

    const membershipRevenue = payments
      ?.filter(p => p.payment_type === 'membership')
      .reduce((sum, p) => sum + p.amount_cents, 0) || 0

    const eventRevenue = payments
      ?.filter(p => p.payment_type === 'event')
      .reduce((sum, p) => sum + p.amount_cents, 0) || 0

    const { data: donations } = await supabase
      .from('donations')
      .select('amount_cents')
      .eq('organization_id', orgId)
      .gte('created_at', startDate.toISOString())

    const donationRevenue = donations?.reduce((sum, d) => sum + d.amount_cents, 0) || 0
    const totalRevenue = membershipRevenue + eventRevenue + donationRevenue

    // Estimate expenses (placeholder - would come from actual accounting)
    const expenses = Math.round(totalRevenue * 0.85)

    // Fetch top events
    const { data: events } = await supabase
      .from('events')
      .select('id, title')
      .eq('organization_id', orgId)
      .gte('start_date', startDate.toISOString())
      .lte('start_date', now.toISOString())

    const topEvents: { name: string; attendees: number }[] = []
    for (const event of events || []) {
      const { count } = await supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .eq('attended', true)

      topEvents.push({ name: event.title, attendees: count || 0 })
    }
    topEvents.sort((a, b) => b.attendees - a.attendees)

    // Generate AI summary
    const executiveSummary = await generateBoardReportSummary({
      period: periodLabel,
      totalMembers,
      newMembers,
      churnedMembers: expiredMembers,
      retentionRate,
      totalRevenue,
      membershipRevenue,
      eventRevenue,
      donationRevenue,
      expenses,
      topEvents: topEvents.slice(0, 3),
      engagementHighlights: [],
    })

    // Build report sections
    const report = {
      period: periodLabel,
      generated_at: new Date().toISOString(),
      executive_summary: executiveSummary,
      sections: [
        {
          title: 'Membership',
          metrics: [
            { label: 'Total Active Members', value: totalMembers },
            { label: 'New Members', value: newMembers },
            { label: 'Churned Members', value: expiredMembers },
            { label: 'Retention Rate', value: `${retentionRate}%` },
          ],
        },
        {
          title: 'Financial Overview',
          metrics: [
            { label: 'Total Revenue', value: `$${(totalRevenue / 100).toLocaleString()}` },
            { label: 'Membership Dues', value: `$${(membershipRevenue / 100).toLocaleString()}` },
            { label: 'Event Revenue', value: `$${(eventRevenue / 100).toLocaleString()}` },
            { label: 'Donations', value: `$${(donationRevenue / 100).toLocaleString()}` },
            { label: 'Expenses', value: `$${(expenses / 100).toLocaleString()}` },
            { label: 'Net Income', value: `$${((totalRevenue - expenses) / 100).toLocaleString()}` },
          ],
        },
        {
          title: 'Top Events',
          items: topEvents.slice(0, 5).map(e => ({
            name: e.name,
            value: `${e.attendees} attendees`,
          })),
        },
      ],
    }

    // Save report
    await supabase.from('board_reports').insert({
      organization_id: orgId,
      report_period: periodLabel,
      title: `Board Report - ${periodLabel}`,
      executive_summary: executiveSummary,
      sections: report.sections,
    })

    return NextResponse.json(report)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
