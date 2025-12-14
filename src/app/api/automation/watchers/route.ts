import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================================
// STATE WATCHERS API
// Condition-based automation triggers
// ============================================================================

export async function GET(req: Request) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  
  const orgId = searchParams.get('organization_id')

  if (!orgId) {
    return NextResponse.json({ error: 'organization_id required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('state_watchers')
    .select(`
      *,
      automation_rule:automation_rules (id, name)
    `)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ watchers: data })
}

export async function POST(req: Request) {
  const supabase = createAdminClient()
  const body = await req.json()

  const {
    organization_id,
    name,
    description,
    watched_table,
    condition_jsonb,
    automation_rule_id,
    action_config,
    check_interval_minutes = 60,
    cooldown_minutes = 1440,
  } = body

  if (!organization_id || !name || !watched_table) {
    return NextResponse.json({ 
      error: 'organization_id, name, and watched_table required' 
    }, { status: 400 })
  }

  // Validate watched table (whitelist for security)
  const allowedTables = [
    'member_organizations',
    'grant_applications',
    'donations',
    'event_registrations',
    'invoices',
    'payments',
    'work_items',
  ]

  if (!allowedTables.includes(watched_table)) {
    return NextResponse.json({ 
      error: `Invalid watched_table. Allowed: ${allowedTables.join(', ')}` 
    }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('state_watchers')
    .insert({
      organization_id,
      name,
      description,
      watched_table,
      condition_jsonb,
      automation_rule_id,
      action_config,
      check_interval_minutes,
      cooldown_minutes,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ watcher: data })
}

export async function PATCH(req: Request) {
  const supabase = createAdminClient()
  const body = await req.json()

  const { id, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('state_watchers')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ watcher: data })
}

export async function DELETE(req: Request) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('state_watchers')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// ============================================================================
// COMMON WATCHER TEMPLATES
// ============================================================================

export const WATCHER_TEMPLATES = [
  {
    name: 'Inactive Members (90 days)',
    description: 'Detect members with no activity for 90 days',
    watched_table: 'member_organizations',
    condition_jsonb: {
      membership_status: { eq: 'active' },
      last_activity_at: { older_than_days: 90 },
      risk_flag: { is_null: true },
    },
    suggested_action: 'flag_at_risk',
  },
  {
    name: 'Stale Grant Applications',
    description: 'Applications submitted but not reviewed for 14 days',
    watched_table: 'grant_applications',
    condition_jsonb: {
      status: { eq: 'submitted' },
      created_at: { older_than_days: 14 },
    },
    suggested_action: 'create_work_item',
  },
  {
    name: 'Overdue Invoices',
    description: 'Invoices past due date',
    watched_table: 'invoices',
    condition_jsonb: {
      status: { eq: 'sent' },
      due_date: { lt: 'NOW()' },
    },
    suggested_action: 'send_email',
  },
  {
    name: 'Expiring Memberships (30 days)',
    description: 'Members expiring in next 30 days',
    watched_table: 'member_organizations',
    condition_jsonb: {
      membership_status: { eq: 'active' },
      membership_expires_at: { lte: 'NOW() + 30 days' },
    },
    suggested_action: 'send_email',
  },
]
