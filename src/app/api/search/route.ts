import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function orgIdFromUrl(url: URL) {
  return url.searchParams.get('orgId') || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || ''
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()
  const scope = url.searchParams.get('scope') || 'all'
  const orgId = orgIdFromUrl(url)

  if (!q || !orgId) return NextResponse.json({ results: [] })

  const supabase = createAdminClient()
  const results: Array<{
    kind: 'member' | 'event' | 'donation'
    id: string
    title: string
    subtitle?: string
    href: string
  }> = []

  const like = `%${q}%`

  // Search members
  if (scope === 'all' || scope === 'members') {
    const { data } = await supabase
      .from('organization_members')
      .select('id, profile:profiles(id,email,first_name,last_name,display_name)')
      .eq('organization_id', orgId)
      .limit(8)

    for (const row of data || []) {
      const p = row.profile as { id: string; email: string; first_name: string | null; last_name: string | null; display_name: string | null } | null
      if (!p) continue
      
      const name = p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Member'
      const searchText = `${name} ${p.email}`.toLowerCase()
      
      if (searchText.includes(q.toLowerCase())) {
        results.push({
          kind: 'member',
          id: row.id,
          title: name,
          subtitle: p.email,
          href: `/admin/members/${row.id}`,
        })
      }
    }
  }

  // Search events
  if (scope === 'all' || scope === 'events') {
    const { data } = await supabase
      .from('events')
      .select('id,title,start_date')
      .eq('organization_id', orgId)
      .ilike('title', like)
      .limit(6)

    for (const e of data || []) {
      results.push({
        kind: 'event',
        id: e.id,
        title: e.title,
        subtitle: new Date(e.start_date).toLocaleDateString(),
        href: `/admin/events/${e.id}`,
      })
    }
  }

  // Search donations
  if (scope === 'all' || scope === 'donations') {
    const { data } = await supabase
      .from('donations')
      .select('id, donor_email, donor_name, amount_cents, created_at')
      .eq('organization_id', orgId)
      .limit(6)

    for (const d of data || []) {
      const searchText = `${d.donor_name || ''} ${d.donor_email}`.toLowerCase()
      
      if (searchText.includes(q.toLowerCase())) {
        results.push({
          kind: 'donation',
          id: d.id,
          title: d.donor_name || d.donor_email || 'Donation',
          subtitle: `$${(d.amount_cents / 100).toFixed(2)} • ${new Date(d.created_at).toLocaleDateString()}`,
          href: `/admin/donations/${d.id}`,
        })
      }
    }
  }

  return NextResponse.json({ results: results.slice(0, 10) })
}
