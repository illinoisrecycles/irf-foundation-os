import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/types/database'

type WorkItemInsert = Database['public']['Tables']['work_items']['Insert']

export async function GET(req: Request) {
  const url = new URL(req.url)
  
  // Verify cron secret - check Authorization header (Vercel cron) or query param (manual)
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const querySecret = url.searchParams.get('secret') || ''
  
  const isAuthorized = !cronSecret || 
    authHeader === `Bearer ${cronSecret}` || 
    querySecret === cronSecret

  if (!isAuthorized) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = url.searchParams.get('orgId') || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || ''
  if (!orgId) {
    return NextResponse.json({ ok: false, error: 'Missing orgId' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const now = new Date()
  const horizon = new Date()
  horizon.setDate(horizon.getDate() + 30)

  let created = 0

  // 1) Memberships expiring within 30 days
  type MembershipRow = {
    id: string
    end_date: string | null
    profile_id: string
    profiles: {
      id: string
      email: string
      display_name: string | null
      first_name: string | null
      last_name: string | null
    } | null
  }

  const { data: memberships } = await supabase
    .from('memberships')
    .select('id, end_date, profile_id, profiles(id,email,display_name,first_name,last_name)')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .not('end_date', 'is', null)
    .gte('end_date', now.toISOString())
    .lte('end_date', horizon.toISOString())
    .limit(500)
    .returns<MembershipRow[]>()

  for (const m of memberships ?? []) {
    const p = m.profiles

    const name = p?.display_name || 
      [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 
      p?.email || 
      'Member'

    const dedupe = `membership:renewal:${m.id}`

    const workItem: WorkItemInsert = {
      organization_id: orgId,
      type: 'alert',
      module: 'memberships',
      title: `Renewal due: ${name}`,
      body: `Membership expires on ${new Date(m.end_date!).toLocaleDateString()}.`,
      priority: 'normal',
      status: 'open',
      due_at: m.end_date,
      reference_type: 'membership',
      reference_id: m.id,
      dedupe_key: dedupe,
      actions: {
        primary: { label: 'Send reminder', href: `/admin/members?action=send-renewal&id=${m.id}` }
      }
    }

    const { error } = await supabase.from('work_items').upsert(workItem, { 
      onConflict: 'organization_id,dedupe_key',
      ignoreDuplicates: true
    })

    if (!error) created++
  }

  // 2) Donations missing receipts
  type DonationRow = {
    id: string
    donor_email: string
    donor_name: string | null
    amount_cents: number
    created_at: string
    receipt_sent_at: string | null
    status: string
  }

  const { data: donations } = await supabase
    .from('donations')
    .select('id, donor_email, donor_name, amount_cents, created_at, receipt_sent_at, status')
    .eq('organization_id', orgId)
    .eq('status', 'succeeded')
    .is('receipt_sent_at', null)
    .limit(300)
    .returns<DonationRow[]>()

  for (const d of donations ?? []) {
    const label = d.donor_name || d.donor_email || 'Donor'
    const dedupe = `donation:receipt:${d.id}`

    const workItem: WorkItemInsert = {
      organization_id: orgId,
      type: 'task',
      module: 'donations',
      title: `Send receipt: ${label}`,
      body: `Donation of $${(d.amount_cents / 100).toFixed(2)} received ${new Date(d.created_at).toLocaleDateString()}.`,
      priority: 'normal',
      status: 'open',
      due_at: d.created_at,
      reference_type: 'donation',
      reference_id: d.id,
      dedupe_key: dedupe,
      actions: {
        primary: { label: 'Send receipt', href: `/admin/donations/${d.id}?action=send-receipt` }
      }
    }

    const { error } = await supabase.from('work_items').upsert(workItem, { 
      onConflict: 'organization_id,dedupe_key',
      ignoreDuplicates: true
    })

    if (!error) created++
  }

  // 3) Upcoming events needing reminders (7 days out)
  type EventRow = {
    id: string
    title: string
    start_date: string
  }

  const sevenDaysOut = new Date()
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7)
  const eightDaysOut = new Date()
  eightDaysOut.setDate(eightDaysOut.getDate() + 8)

  const { data: events } = await supabase
    .from('events')
    .select('id, title, start_date')
    .eq('organization_id', orgId)
    .eq('status', 'published')
    .gte('start_date', sevenDaysOut.toISOString())
    .lt('start_date', eightDaysOut.toISOString())
    .limit(50)
    .returns<EventRow[]>()

  for (const e of events ?? []) {
    const dedupe = `event:reminder:${e.id}`

    const workItem: WorkItemInsert = {
      organization_id: orgId,
      type: 'task',
      module: 'events',
      title: `Send reminders: ${e.title}`,
      body: `Event starts ${new Date(e.start_date).toLocaleDateString()}. Send attendee reminders.`,
      priority: 'normal',
      status: 'open',
      due_at: now.toISOString(),
      reference_type: 'event',
      reference_id: e.id,
      dedupe_key: dedupe,
      actions: {
        primary: { label: 'Send reminders', href: `/admin/events/${e.id}?action=send-reminders` }
      }
    }

    const { error } = await supabase.from('work_items').upsert(workItem, { 
      onConflict: 'organization_id,dedupe_key',
      ignoreDuplicates: true
    })

    if (!error) created++
  }

  return NextResponse.json({ ok: true, created })
}
