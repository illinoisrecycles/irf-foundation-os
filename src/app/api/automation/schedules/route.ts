import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================================
// SCHEDULED AUTOMATIONS API
// Time-based automation triggers
// ============================================================================

export async function GET(req: Request) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  
  const orgId = searchParams.get('organization_id')

  if (!orgId) {
    return NextResponse.json({ error: 'organization_id required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('scheduled_automations')
    .select(`
      *,
      automation_rule:automation_rules (id, name, event_type)
    `)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ schedules: data })
}

export async function POST(req: Request) {
  const supabase = createAdminClient()
  const body = await req.json()

  const {
    organization_id,
    name,
    description,
    schedule_type, // 'cron' | 'interval' | 'once'
    cron_expression,
    interval_minutes,
    run_at,
    timezone = 'America/Chicago',
    automation_rule_id,
    action_config,
  } = body

  if (!organization_id || !name || !schedule_type) {
    return NextResponse.json({ 
      error: 'organization_id, name, and schedule_type required' 
    }, { status: 400 })
  }

  // Validate schedule config
  if (schedule_type === 'cron' && !cron_expression) {
    return NextResponse.json({ error: 'cron_expression required for cron schedule' }, { status: 400 })
  }
  if (schedule_type === 'interval' && !interval_minutes) {
    return NextResponse.json({ error: 'interval_minutes required for interval schedule' }, { status: 400 })
  }
  if (schedule_type === 'once' && !run_at) {
    return NextResponse.json({ error: 'run_at required for once schedule' }, { status: 400 })
  }

  // Calculate next run time
  let nextRunAt: string | null = null
  const now = new Date()

  if (schedule_type === 'once') {
    nextRunAt = run_at
  } else if (schedule_type === 'interval') {
    nextRunAt = new Date(now.getTime() + interval_minutes * 60 * 1000).toISOString()
  } else if (schedule_type === 'cron') {
    // Simple next run calculation (in production use a proper cron parser)
    nextRunAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString() // Default to 1 hour
  }

  const { data, error } = await supabase
    .from('scheduled_automations')
    .insert({
      organization_id,
      name,
      description,
      schedule_type,
      cron_expression,
      interval_minutes,
      run_at,
      timezone,
      automation_rule_id,
      action_config,
      is_active: true,
      next_run_at: nextRunAt,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ schedule: data })
}

export async function PATCH(req: Request) {
  const supabase = createAdminClient()
  const body = await req.json()

  const { id, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('scheduled_automations')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ schedule: data })
}

export async function DELETE(req: Request) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('scheduled_automations')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
