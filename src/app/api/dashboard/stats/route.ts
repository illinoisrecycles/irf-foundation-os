import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext } from '@/lib/auth/org-context'

export async function GET(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

    // Total members
    const { count: totalMembers } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ctx.organizationId)
      .eq('status', 'active')

    // New members this month
    const { count: newMembersThisMonth } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ctx.organizationId)
      .gte('created_at', startOfMonth.toISOString())

    // New members last month
    const { count: newMembersLastMonth } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ctx.organizationId)
      .gte('created_at', startOfLastMonth.toISOString())
      .lt('created_at', startOfMonth.toISOString())

    // Revenue this month
    const { data: revenueThisMonth } = await supabase
      .from('payments')
      .select('amount_cents')
      .eq('organization_id', ctx.organizationId)
      .eq('status', 'succeeded')
      .gte('created_at', startOfMonth.toISOString())

    const monthlyRevenue = revenueThisMonth?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0

    // Revenue last month
    const { data: revenueLastMonth } = await supabase
      .from('payments')
      .select('amount_cents')
      .eq('organization_id', ctx.organizationId)
      .eq('status', 'succeeded')
      .gte('created_at', startOfLastMonth.toISOString())
      .lt('created_at', startOfMonth.toISOString())

    const lastMonthRevenue = revenueLastMonth?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0

    // Upcoming events
    const { count: upcomingEvents } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ctx.organizationId)
      .gte('start_date', now.toISOString())
      .eq('status', 'published')

    // Engagement rate (members with activity in last 30 days / total members)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const { count: activeMembers } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ctx.organizationId)
      .eq('status', 'active')
      .gte('last_activity_at', thirtyDaysAgo.toISOString())

    const engagementRate = totalMembers ? Math.round(((activeMembers || 0) / totalMembers) * 100) : 0

    // Calculate growth percentages
    const memberGrowth = newMembersLastMonth 
      ? Math.round(((newMembersThisMonth || 0) - newMembersLastMonth) / newMembersLastMonth * 100)
      : 0

    const revenueGrowth = lastMonthRevenue
      ? Math.round((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue * 100)
      : 0

    return NextResponse.json({
      totalMembers: totalMembers || 0,
      memberGrowth,
      monthlyRevenue,
      revenueGrowth,
      upcomingEvents: upcomingEvents || 0,
      engagementRate,
      engagementChange: 0, // TODO: Calculate vs last month
    })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('Dashboard stats error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
