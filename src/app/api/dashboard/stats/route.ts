import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('organization_id')

  if (!orgId) return NextResponse.json({ error: 'organization_id required' }, { status: 400 })

  const supabase = createAdminClient()
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const oneWeekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalMembers },
    { count: newMembersToday },
    { count: expiringThisWeek },
    { data: payments },
    { count: eventsThisMonth },
    { count: upcomingEvents },
    { data: engagementScores },
    { count: atRiskMembers },
    { count: pendingTasks },
    { count: automationsToday },
  ] = await Promise.all([
    supabase.from('member_organizations').select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId).eq('membership_status', 'active'),
    supabase.from('member_organizations').select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId).gte('joined_at', startOfDay),
    supabase.from('member_organizations').select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId).lte('expires_at', oneWeekFromNow).gte('expires_at', now.toISOString()),
    supabase.from('payments').select('amount_cents, created_at')
      .eq('organization_id', orgId).eq('status', 'succeeded').gte('created_at', startOfYear),
    supabase.from('events').select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId).gte('start_date', startOfMonth),
    supabase.from('events').select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId).gte('start_date', now.toISOString()),
    supabase.from('member_engagement_scores').select('score').eq('organization_id', orgId),
    supabase.from('member_engagement_scores').select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId).lt('score', 40),
    supabase.from('work_items').select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId).eq('status', 'open'),
    supabase.from('automation_runs').select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId).gte('started_at', startOfDay),
  ])

  const totalRevenue = payments?.reduce((sum, p) => sum + p.amount_cents, 0) || 0
  const revenueToday = payments?.filter(p => p.created_at >= startOfDay).reduce((sum, p) => sum + p.amount_cents, 0) || 0
  const avgEngagement = engagementScores?.length
    ? Math.round(engagementScores.reduce((sum, s) => sum + s.score, 0) / engagementScores.length) : 0

  return NextResponse.json({
    totalMembers: totalMembers || 0,
    membersTrend: 5, // Placeholder
    newMembersToday: newMembersToday || 0,
    expiringThisWeek: expiringThisWeek || 0,
    totalRevenue,
    revenueTrend: 12, // Placeholder
    revenueToday,
    eventsThisMonth: eventsThisMonth || 0,
    upcomingEvents: upcomingEvents || 0,
    avgEngagement,
    engagementTrend: 3, // Placeholder
    atRiskMembers: atRiskMembers || 0,
    pendingTasks: pendingTasks || 0,
    automationsTriggered: automationsToday || 0,
  })
}
