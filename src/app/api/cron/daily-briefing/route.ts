import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

/**
 * Daily Briefing - "Chief of Staff" Email
 * 
 * Sends a morning summary to admins at 8:00 AM with:
 * - Yesterday's revenue
 * - New members
 * - Pending approvals
 * - At-risk member alerts
 * - Upcoming events
 * - Grant deadlines
 * 
 * Cron: 0 8 * * 1-5 (8 AM, Monday-Friday)
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get all organizations
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name')

    let briefingsSent = 0

    for (const org of orgs || []) {
      const stats = await gatherIntelligence(org.id)
      const admins = await getAdminEmails(org.id)

      if (admins.length === 0) continue

      const emailHtml = generateBriefingEmail(org.name, stats)

      // Send to each admin
      for (const email of admins) {
        try {
          await resend.emails.send({
            from: `${org.name} <briefing@${process.env.EMAIL_DOMAIN || 'foundationos.org'}>`,
            to: email,
            subject: `☕ Daily Briefing: $${stats.revenue.toLocaleString()} raised yesterday`,
            html: emailHtml,
          })
          briefingsSent++
        } catch (err) {
          console.error(`Failed to send briefing to ${email}:`, err)
        }
      }
    }

    return NextResponse.json({
      success: true,
      briefings_sent: briefingsSent,
      timestamp: new Date().toISOString(),
    })

  } catch (error: any) {
    console.error('Daily briefing error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

interface BriefingStats {
  revenue: number
  revenueChange: number
  newMembers: number
  totalMembers: number
  pendingApprovals: number
  atRiskMembers: number
  atRiskDetails: { name: string; score: number; change: number }[]
  upcomingEvents: { title: string; date: string; registered: number }[]
  grantDeadlines: { title: string; deadline: string; match: number }[]
  topDonor?: { name: string; amount: number }
}

async function gatherIntelligence(orgId: string): Promise<BriefingStats> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)
  
  const twoDaysAgo = new Date(yesterday)
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 1)

  const weekFromNow = new Date()
  weekFromNow.setDate(weekFromNow.getDate() + 7)

  // Parallel queries
  const [
    revenueResult,
    previousRevenueResult,
    newMembersResult,
    totalMembersResult,
    approvalsResult,
    atRiskResult,
    eventsResult,
    grantsResult,
  ] = await Promise.all([
    // Revenue yesterday
    supabase
      .from('donations')
      .select('amount_cents, donor_name')
      .eq('organization_id', orgId)
      .gte('created_at', yesterday.toISOString())
      .eq('status', 'succeeded'),
    
    // Revenue day before (for comparison)
    supabase
      .from('donations')
      .select('amount_cents')
      .eq('organization_id', orgId)
      .gte('created_at', twoDaysAgo.toISOString())
      .lt('created_at', yesterday.toISOString())
      .eq('status', 'succeeded'),
    
    // New members yesterday
    supabase
      .from('member_organizations')
      .select('id', { count: 'exact' })
      .eq('organization_id', orgId)
      .gte('joined_at', yesterday.toISOString()),
    
    // Total active members
    supabase
      .from('member_organizations')
      .select('id', { count: 'exact' })
      .eq('organization_id', orgId)
      .eq('status', 'active'),
    
    // Pending approvals
    supabase
      .from('approval_requests')
      .select('id', { count: 'exact' })
      .eq('organization_id', orgId)
      .eq('status', 'pending'),
    
    // At-risk members (score < 50 or dropped 10+ points)
    supabase
      .from('member_health_scores')
      .select(`
        score, 
        score_change,
        profile:profiles(full_name, email)
      `)
      .eq('organization_id', orgId)
      .or('score.lt.50,score_change.lt.-10')
      .order('score', { ascending: true })
      .limit(5),
    
    // Upcoming events (next 7 days)
    supabase
      .from('events')
      .select('title, date_start, registered_count')
      .eq('organization_id', orgId)
      .gte('date_start', new Date().toISOString())
      .lte('date_start', weekFromNow.toISOString())
      .order('date_start')
      .limit(3),
    
    // Grant deadlines (next 14 days)
    supabase
      .from('external_grant_opportunities')
      .select('title, deadline, match_score')
      .eq('organization_id', orgId)
      .in('status', ['recommended', 'high_priority'])
      .gte('deadline', new Date().toISOString())
      .lte('deadline', new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString())
      .order('deadline')
      .limit(3),
  ])

  // Calculate revenue
  const revenue = (revenueResult.data || []).reduce((sum, d) => sum + (d.amount_cents || 0), 0) / 100
  const previousRevenue = (previousRevenueResult.data || []).reduce((sum, d) => sum + (d.amount_cents || 0), 0) / 100
  const revenueChange = previousRevenue > 0 ? Math.round(((revenue - previousRevenue) / previousRevenue) * 100) : 0

  // Find top donor
  const topDonation = (revenueResult.data || []).sort((a, b) => (b.amount_cents || 0) - (a.amount_cents || 0))[0]

  return {
    revenue,
    revenueChange,
    newMembers: newMembersResult.count || 0,
    totalMembers: totalMembersResult.count || 0,
    pendingApprovals: approvalsResult.count || 0,
    atRiskMembers: (atRiskResult.data || []).length,
    atRiskDetails: (atRiskResult.data || []).map((m: any) => ({
      name: m.profile?.full_name || m.profile?.email || 'Unknown',
      score: m.score,
      change: m.score_change || 0,
    })),
    upcomingEvents: (eventsResult.data || []).map((e: any) => ({
      title: e.title,
      date: new Date(e.date_start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      registered: e.registered_count || 0,
    })),
    grantDeadlines: (grantsResult.data || []).map((g: any) => ({
      title: g.title?.substring(0, 50) + (g.title?.length > 50 ? '...' : ''),
      deadline: new Date(g.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      match: Math.round((g.match_score || 0) * 100),
    })),
    topDonor: topDonation ? {
      name: topDonation.donor_name || 'Anonymous',
      amount: (topDonation.amount_cents || 0) / 100,
    } : undefined,
  }
}

async function getAdminEmails(orgId: string): Promise<string[]> {
  // Get admins who have briefings enabled (or default to all admins)
  const { data: prefs } = await supabase
    .from('briefing_preferences')
    .select('user_id')
    .eq('organization_id', orgId)
    .eq('enabled', true)

  if (prefs && prefs.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('email')
      .in('id', prefs.map(p => p.user_id))
    return profiles?.map(p => p.email).filter(Boolean) || []
  }

  // Fallback: all admins
  const { data: members } = await supabase
    .from('organization_members')
    .select('profile:profiles(email)')
    .eq('organization_id', orgId)
    .eq('role', 'admin')

  return members?.map((m: any) => m.profile?.email).filter(Boolean) || []
}

function generateBriefingEmail(orgName: string, stats: BriefingStats): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.foundationos.org'
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #166534, #15803d); color: white; padding: 24px;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">☕ Good Morning</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">Here's your ${orgName} briefing for ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>
      
      <!-- Stats Grid -->
      <div style="padding: 24px;">
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
          
          <!-- Revenue -->
          <div style="background: #f0fdf4; border-radius: 8px; padding: 16px;">
            <div style="font-size: 12px; color: #166534; font-weight: 600; text-transform: uppercase;">Revenue (24h)</div>
            <div style="font-size: 28px; font-weight: 700; color: #166534; margin-top: 4px;">
              $${stats.revenue.toLocaleString()}
            </div>
            ${stats.revenueChange !== 0 ? `
            <div style="font-size: 12px; color: ${stats.revenueChange > 0 ? '#16a34a' : '#dc2626'}; margin-top: 4px;">
              ${stats.revenueChange > 0 ? '↑' : '↓'} ${Math.abs(stats.revenueChange)}% vs previous day
            </div>
            ` : ''}
          </div>
          
          <!-- Members -->
          <div style="background: #eff6ff; border-radius: 8px; padding: 16px;">
            <div style="font-size: 12px; color: #1d4ed8; font-weight: 600; text-transform: uppercase;">New Members</div>
            <div style="font-size: 28px; font-weight: 700; color: #1d4ed8; margin-top: 4px;">
              +${stats.newMembers}
            </div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
              ${stats.totalMembers.toLocaleString()} total active
            </div>
          </div>
          
          <!-- Approvals -->
          <div style="background: ${stats.pendingApprovals > 0 ? '#fef3c7' : '#f3f4f6'}; border-radius: 8px; padding: 16px;">
            <div style="font-size: 12px; color: ${stats.pendingApprovals > 0 ? '#d97706' : '#6b7280'}; font-weight: 600; text-transform: uppercase;">Pending Actions</div>
            <div style="font-size: 28px; font-weight: 700; color: ${stats.pendingApprovals > 0 ? '#d97706' : '#374151'}; margin-top: 4px;">
              ${stats.pendingApprovals}
            </div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
              awaiting your review
            </div>
          </div>
          
          <!-- At Risk -->
          <div style="background: ${stats.atRiskMembers > 0 ? '#fef2f2' : '#f3f4f6'}; border-radius: 8px; padding: 16px;">
            <div style="font-size: 12px; color: ${stats.atRiskMembers > 0 ? '#dc2626' : '#6b7280'}; font-weight: 600; text-transform: uppercase;">At-Risk Members</div>
            <div style="font-size: 28px; font-weight: 700; color: ${stats.atRiskMembers > 0 ? '#dc2626' : '#374151'}; margin-top: 4px;">
              ${stats.atRiskMembers}
            </div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
              need attention
            </div>
          </div>
        </div>
        
        ${stats.atRiskMembers > 0 ? `
        <!-- At Risk Alert -->
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-top: 20px;">
          <div style="font-weight: 600; color: #991b1b; margin-bottom: 8px;">⚠️ Members Needing Attention</div>
          ${stats.atRiskDetails.map(m => `
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #fecaca;">
              <span style="color: #374151;">${m.name}</span>
              <span style="color: #dc2626; font-weight: 500;">Score: ${m.score} ${m.change < 0 ? `(↓${Math.abs(m.change)})` : ''}</span>
            </div>
          `).join('')}
          <a href="${appUrl}/admin/members?filter=at_risk" style="display: inline-block; margin-top: 12px; color: #dc2626; text-decoration: none; font-weight: 500;">
            View Retention Dashboard →
          </a>
        </div>
        ` : ''}
        
        ${stats.topDonor && stats.topDonor.amount >= 100 ? `
        <!-- Top Donor -->
        <div style="background: #fdf4ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 16px; margin-top: 20px;">
          <div style="font-weight: 600; color: #7e22ce; margin-bottom: 4px;">🎉 Notable Gift</div>
          <div style="color: #374151;">
            <strong>${stats.topDonor.name}</strong> donated <strong>$${stats.topDonor.amount.toLocaleString()}</strong> yesterday
          </div>
        </div>
        ` : ''}
        
        ${stats.upcomingEvents.length > 0 ? `
        <!-- Upcoming Events -->
        <div style="margin-top: 20px;">
          <div style="font-weight: 600; color: #374151; margin-bottom: 12px;">📅 This Week's Events</div>
          ${stats.upcomingEvents.map(e => `
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
              <span style="color: #374151;">${e.title}</span>
              <span style="color: #6b7280;">${e.date} · ${e.registered} registered</span>
            </div>
          `).join('')}
        </div>
        ` : ''}
        
        ${stats.grantDeadlines.length > 0 ? `
        <!-- Grant Deadlines -->
        <div style="margin-top: 20px;">
          <div style="font-weight: 600; color: #374151; margin-bottom: 12px;">💰 Grant Deadlines (Next 14 Days)</div>
          ${stats.grantDeadlines.map(g => `
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
              <span style="color: #374151;">${g.title}</span>
              <span style="color: #6b7280;">${g.deadline} · ${g.match}% match</span>
            </div>
          `).join('')}
        </div>
        ` : ''}
        
        <!-- CTA -->
        <div style="margin-top: 24px; text-align: center;">
          <a href="${appUrl}/admin" style="display: inline-block; background: #166534; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Open Command Center
          </a>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; font-size: 12px; color: #6b7280;">
          You're receiving this because you're an admin of ${orgName}.
          <a href="${appUrl}/admin/settings/notifications" style="color: #166534;">Manage preferences</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`
}
