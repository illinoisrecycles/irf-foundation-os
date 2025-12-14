import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext } from '@/lib/auth/org-context'

// ============================================================================
// GLOBAL SEARCH API
// Search across members, payments, events, grants, work items
// ============================================================================

type SearchResult = {
  id: string
  type: 'member' | 'payment' | 'event' | 'grant' | 'work_item' | 'email'
  title: string
  subtitle?: string
  url: string
  metadata?: Record<string, any>
}

export async function GET(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)

    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q')?.trim()
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] })
    }

    const searchTerm = `%${query}%`
    const results: SearchResult[] = []

    // Search members
    const { data: members } = await supabase
      .from('members')
      .select('id, first_name, last_name, email, company')
      .eq('organization_id', ctx.organizationId)
      .or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm},company.ilike.${searchTerm}`)
      .limit(limit)

    members?.forEach(m => {
      results.push({
        id: m.id,
        type: 'member',
        title: [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email,
        subtitle: m.company || m.email,
        url: `/admin/members/${m.id}`,
      })
    })

    // Search payments
    const { data: payments } = await supabase
      .from('payments')
      .select('id, amount_cents, status, description, profile:profiles(email, first_name, last_name)')
      .eq('organization_id', ctx.organizationId)
      .or(`description.ilike.${searchTerm}`)
      .limit(limit)

    payments?.forEach(p => {
      const profile = p.profile as any
      results.push({
        id: p.id,
        type: 'payment',
        title: `$${(p.amount_cents / 100).toFixed(2)} - ${p.status}`,
        subtitle: p.description || (profile?.email) || 'Payment',
        url: `/admin/payments?id=${p.id}`,
      })
    })

    // Search events
    const { data: events } = await supabase
      .from('events')
      .select('id, title, start_date, location')
      .eq('organization_id', ctx.organizationId)
      .or(`title.ilike.${searchTerm},location.ilike.${searchTerm}`)
      .limit(limit)

    events?.forEach(e => {
      results.push({
        id: e.id,
        type: 'event',
        title: e.title,
        subtitle: e.location || (e.start_date ? new Date(e.start_date).toLocaleDateString() : undefined),
        url: `/admin/events/${e.id}`,
      })
    })

    // Search grant applications
    const { data: grants } = await supabase
      .from('grant_applications')
      .select('id, title, status, applicant_name, applicant_email')
      .eq('organization_id', ctx.organizationId)
      .or(`title.ilike.${searchTerm},applicant_name.ilike.${searchTerm},applicant_email.ilike.${searchTerm}`)
      .limit(limit)

    grants?.forEach(g => {
      results.push({
        id: g.id,
        type: 'grant',
        title: g.title || 'Grant Application',
        subtitle: g.applicant_name || g.applicant_email || g.status,
        url: `/admin/grants?id=${g.id}`,
      })
    })

    // Search work items
    const { data: workItems } = await supabase
      .from('work_items')
      .select('id, title, item_type, status, priority')
      .eq('organization_id', ctx.organizationId)
      .ilike('title', searchTerm)
      .limit(limit)

    workItems?.forEach(w => {
      results.push({
        id: w.id,
        type: 'work_item',
        title: w.title,
        subtitle: `${w.item_type} - ${w.status}`,
        url: `/admin/inbox?id=${w.id}`,
      })
    })

    // Search email campaigns
    const { data: emails } = await supabase
      .from('email_campaigns')
      .select('id, name, subject, status')
      .eq('organization_id', ctx.organizationId)
      .or(`name.ilike.${searchTerm},subject.ilike.${searchTerm}`)
      .limit(limit)

    emails?.forEach(e => {
      results.push({
        id: e.id,
        type: 'email',
        title: e.name || e.subject,
        subtitle: e.status,
        url: `/admin/email?id=${e.id}`,
      })
    })

    // Sort by relevance (exact matches first)
    const queryLower = query.toLowerCase()
    results.sort((a, b) => {
      const aExact = a.title.toLowerCase().includes(queryLower) ? 0 : 1
      const bExact = b.title.toLowerCase().includes(queryLower) ? 0 : 1
      return aExact - bExact
    })

    return NextResponse.json({ results: results.slice(0, limit) })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('Search error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
