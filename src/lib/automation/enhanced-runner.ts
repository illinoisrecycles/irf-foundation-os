import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================================
// ENHANCED AUTOMATION RUNNER
// Supports event triggers, scheduled triggers, and state watchers
// ============================================================================

type ActionResult = {
  success: boolean
  action_type: string
  result?: any
  error?: string
}

// ============================================================================
// SCHEDULED AUTOMATION RUNNER
// Run by cron: evaluates scheduled automations
// ============================================================================

export async function runScheduledAutomations(): Promise<{ processed: number; errors: string[] }> {
  const supabase = createAdminClient()
  const now = new Date()
  const errors: string[] = []
  let processed = 0

  // Find due scheduled automations
  const { data: schedules } = await supabase
    .from('scheduled_automations')
    .select('*')
    .eq('is_active', true)
    .lte('next_run_at', now.toISOString())
    .limit(50)

  if (!schedules?.length) return { processed: 0, errors: [] }

  for (const schedule of schedules) {
    try {
      // Run the automation
      if (schedule.automation_rule_id) {
        // Execute linked rule
        const { data: rule } = await supabase
          .from('automation_rules')
          .select('*')
          .eq('id', schedule.automation_rule_id)
          .single()

        if (rule) {
          await executeActions(supabase, schedule.organization_id, rule.actions, {
            trigger: 'scheduled',
            schedule_id: schedule.id,
            schedule_name: schedule.name,
          })
        }
      } else if (schedule.action_config) {
        // Execute inline actions
        await executeActions(
          supabase, 
          schedule.organization_id, 
          schedule.action_config.actions || [schedule.action_config],
          { trigger: 'scheduled', schedule_id: schedule.id }
        )
      }

      // Calculate next run time
      const nextRun = calculateNextRun(schedule)

      await supabase
        .from('scheduled_automations')
        .update({
          last_run_at: now.toISOString(),
          next_run_at: nextRun?.toISOString(),
          run_count: (schedule.run_count || 0) + 1,
          last_error: null,
        })
        .eq('id', schedule.id)

      processed++

    } catch (err: any) {
      errors.push(`Schedule ${schedule.id}: ${err.message}`)
      
      await supabase
        .from('scheduled_automations')
        .update({
          last_run_at: now.toISOString(),
          last_error: err.message,
        })
        .eq('id', schedule.id)
    }
  }

  return { processed, errors }
}

function calculateNextRun(schedule: any): Date | null {
  const now = new Date()

  if (schedule.schedule_type === 'once') {
    return null // Don't reschedule one-time runs
  }

  if (schedule.schedule_type === 'interval' && schedule.interval_minutes) {
    return new Date(now.getTime() + schedule.interval_minutes * 60 * 1000)
  }

  if (schedule.schedule_type === 'cron' && schedule.cron_expression) {
    // Simple cron parsing for common patterns
    return parseSimpleCron(schedule.cron_expression, now)
  }

  return null
}

function parseSimpleCron(cron: string, from: Date): Date {
  // Simple implementation for common patterns
  // Format: minute hour day-of-month month day-of-week
  const parts = cron.split(' ')
  if (parts.length !== 5) return new Date(from.getTime() + 24 * 60 * 60 * 1000)

  const [minute, hour, , , dayOfWeek] = parts
  const next = new Date(from)

  // Daily at specific time
  if (minute !== '*' && hour !== '*' && dayOfWeek === '*') {
    next.setHours(parseInt(hour), parseInt(minute), 0, 0)
    if (next <= from) next.setDate(next.getDate() + 1)
    return next
  }

  // Weekly on specific day
  if (dayOfWeek !== '*') {
    const targetDay = parseInt(dayOfWeek)
    next.setHours(parseInt(hour) || 0, parseInt(minute) || 0, 0, 0)
    while (next.getDay() !== targetDay || next <= from) {
      next.setDate(next.getDate() + 1)
    }
    return next
  }

  // Default: tomorrow same time
  next.setDate(next.getDate() + 1)
  return next
}

// ============================================================================
// STATE WATCHER RUNNER
// Evaluates conditions and triggers automations
// ============================================================================

export async function runStateWatchers(): Promise<{ processed: number; triggered: number; errors: string[] }> {
  const supabase = createAdminClient()
  const errors: string[] = []
  let processed = 0
  let triggered = 0

  // Get active state watchers
  const { data: watchers } = await supabase
    .from('state_watchers')
    .select('*')
    .eq('is_active', true)
    .limit(50)

  if (!watchers?.length) return { processed: 0, triggered: 0, errors: [] }

  for (const watcher of watchers) {
    try {
      processed++

      // Check if we should run based on interval
      if (watcher.last_check_at) {
        const lastCheck = new Date(watcher.last_check_at)
        const minsSinceLastCheck = (Date.now() - lastCheck.getTime()) / 60000
        if (minsSinceLastCheck < (watcher.check_interval_minutes || 60)) {
          continue
        }
      }

      // Execute the condition query
      const matchedEntities = await evaluateStateCondition(supabase, watcher)

      for (const entity of matchedEntities) {
        // Check cooldown
        const { data: existing } = await supabase
          .from('state_watcher_triggers')
          .select('triggered_at')
          .eq('state_watcher_id', watcher.id)
          .eq('entity_id', entity.id)
          .single()

        if (existing) {
          const lastTrigger = new Date(existing.triggered_at)
          const minsSinceLastTrigger = (Date.now() - lastTrigger.getTime()) / 60000
          if (minsSinceLastTrigger < (watcher.cooldown_minutes || 1440)) {
            continue // Still in cooldown
          }
        }

        // Trigger the automation
        if (watcher.automation_rule_id) {
          const { data: rule } = await supabase
            .from('automation_rules')
            .select('*')
            .eq('id', watcher.automation_rule_id)
            .single()

          if (rule) {
            await executeActions(supabase, watcher.organization_id, rule.actions, {
              trigger: 'state_watcher',
              watcher_id: watcher.id,
              entity: entity,
            })
          }
        } else if (watcher.action_config) {
          await executeActions(
            supabase,
            watcher.organization_id,
            watcher.action_config.actions || [watcher.action_config],
            { trigger: 'state_watcher', entity }
          )
        }

        // Record trigger
        await supabase
          .from('state_watcher_triggers')
          .upsert({
            state_watcher_id: watcher.id,
            entity_id: entity.id,
            triggered_at: new Date().toISOString(),
          })

        triggered++
      }

      // Update last check time
      await supabase
        .from('state_watchers')
        .update({ last_check_at: new Date().toISOString() })
        .eq('id', watcher.id)

    } catch (err: any) {
      errors.push(`Watcher ${watcher.id}: ${err.message}`)
    }
  }

  return { processed, triggered, errors }
}

async function evaluateStateCondition(supabase: any, watcher: any): Promise<any[]> {
  // Build query based on watched table and conditions
  const conditions = watcher.condition_jsonb || {}
  
  let query = supabase
    .from(watcher.watched_table)
    .select('id, *')
    .eq('organization_id', watcher.organization_id)
    .limit(100)

  // Apply JSONB conditions
  for (const [field, condition] of Object.entries(conditions)) {
    if (typeof condition === 'object' && condition !== null) {
      const cond = condition as any
      if (cond.eq !== undefined) query = query.eq(field, cond.eq)
      if (cond.neq !== undefined) query = query.neq(field, cond.neq)
      if (cond.gt !== undefined) query = query.gt(field, cond.gt)
      if (cond.lt !== undefined) query = query.lt(field, cond.lt)
      if (cond.gte !== undefined) query = query.gte(field, cond.gte)
      if (cond.lte !== undefined) query = query.lte(field, cond.lte)
      if (cond.is_null) query = query.is(field, null)
      if (cond.older_than_days) {
        const cutoff = new Date(Date.now() - cond.older_than_days * 24 * 60 * 60 * 1000)
        query = query.lt(field, cutoff.toISOString())
      }
    } else {
      query = query.eq(field, condition)
    }
  }

  const { data } = await query
  return data || []
}

// ============================================================================
// ACTION EXECUTOR
// Runs automation actions with idempotency
// ============================================================================

export async function executeActions(
  supabase: any,
  orgId: string,
  actions: any[],
  context: any
): Promise<ActionResult[]> {
  const results: ActionResult[] = []

  for (const action of actions) {
    try {
      const result = await executeAction(supabase, orgId, action, context)
      results.push({ success: true, action_type: action.type, result })
    } catch (err: any) {
      results.push({ success: false, action_type: action.type, error: err.message })
    }
  }

  return results
}

async function executeAction(
  supabase: any,
  orgId: string,
  action: any,
  context: any
): Promise<any> {
  switch (action.type) {
    case 'send_email':
      return await actionSendEmail(supabase, orgId, action, context)

    case 'create_work_item':
      return await actionCreateWorkItem(supabase, orgId, action, context)

    case 'create_approval_request':
      return await actionCreateApprovalRequest(supabase, orgId, action, context)

    case 'update_record':
      return await actionUpdateRecord(supabase, action, context)

    case 'assign_chapter':
      return await actionAssignChapter(supabase, orgId, action, context)

    case 'calculate_donor_tier':
      return await actionCalculateDonorTier(supabase, orgId, context)

    case 'flag_at_risk':
      return await actionFlagAtRisk(supabase, orgId, action, context)

    case 'generate_document':
      return await actionGenerateDocument(supabase, orgId, action, context)

    case 'webhook':
      return await actionWebhook(action, context)

    default:
      throw new Error(`Unknown action type: ${action.type}`)
  }
}

// Action implementations
async function actionSendEmail(supabase: any, orgId: string, action: any, context: any) {
  const { to, subject, template_id, body } = action

  // Queue email
  await supabase.from('email_outbox').insert({
    organization_id: orgId,
    to_email: interpolate(to, context),
    subject: interpolate(subject, context),
    body_html: body ? interpolate(body, context) : null,
    template_id,
    merge_data: context,
    status: 'pending',
  })

  return { queued: true }
}

async function actionCreateWorkItem(supabase: any, orgId: string, action: any, context: any) {
  const { data } = await supabase
    .from('work_items')
    .insert({
      organization_id: orgId,
      item_type: action.item_type || 'task',
      title: interpolate(action.title, context),
      description: action.description ? interpolate(action.description, context) : null,
      priority: action.priority || 'medium',
      due_date: action.due_in_days 
        ? new Date(Date.now() + action.due_in_days * 24 * 60 * 60 * 1000).toISOString()
        : null,
      assigned_to: action.assigned_to,
    })
    .select()
    .single()

  return data
}

async function actionCreateApprovalRequest(supabase: any, orgId: string, action: any, context: any) {
  const entityId = getByPath(context, action.entity_id_path)
  
  const { data } = await supabase
    .from('approval_requests')
    .insert({
      organization_id: orgId,
      approval_type: action.approval_type,
      entity_table: action.entity_table,
      entity_id: entityId,
      title: interpolate(action.title, context),
      description: action.description ? interpolate(action.description, context) : null,
      amount_cents: action.amount_cents_path ? getByPath(context, action.amount_cents_path) : null,
    })
    .select()
    .single()

  // Create steps if provided
  if (action.steps?.length && data) {
    const steps = action.steps.map((s: any, idx: number) => ({
      organization_id: orgId,
      approval_request_id: data.id,
      step_order: s.step_order || idx + 1,
      role_required: s.role_required,
      profile_id: s.profile_id,
    }))

    await supabase.from('approval_steps').insert(steps)
  }

  return data
}

async function actionUpdateRecord(supabase: any, action: any, context: any) {
  const entityId = getByPath(context, action.entity_id_path || 'entity.id')
  const updates: any = {}

  for (const [field, value] of Object.entries(action.updates || {})) {
    updates[field] = typeof value === 'string' ? interpolate(value, context) : value
  }

  await supabase
    .from(action.table)
    .update(updates)
    .eq('id', entityId)

  return { updated: true }
}

async function actionAssignChapter(supabase: any, orgId: string, action: any, context: any) {
  const member = context.entity || context.member
  const state = member?.address_state || member?.state

  // Find matching chapter
  const { data: chapters } = await supabase
    .from('chapters')
    .select('id, name')
    .eq('organization_id', orgId)
    .eq('is_active', true)

  let assignedChapter = null
  for (const chapter of chapters || []) {
    // Check if chapter handles this state (would be in states array)
    // For now, simple assignment
    if (chapter) {
      assignedChapter = chapter
      break
    }
  }

  if (assignedChapter && member?.id) {
    await supabase
      .from('member_organizations')
      .update({ chapter_id: assignedChapter.id })
      .eq('id', member.id)
  }

  return { chapter: assignedChapter }
}

async function actionCalculateDonorTier(supabase: any, orgId: string, context: any) {
  const memberId = context.entity?.member_id || context.member_id

  // Calculate lifetime value
  const { data: donations } = await supabase
    .from('donations')
    .select('amount_cents')
    .eq('donor_member_id', memberId)

  const ltv = donations?.reduce((sum: number, d: any) => sum + (d.amount_cents || 0), 0) || 0

  // Determine tier
  let tier = null
  if (ltv >= 500000) tier = 'platinum' // $5,000+
  else if (ltv >= 100000) tier = 'gold' // $1,000+
  else if (ltv >= 50000) tier = 'silver' // $500+
  else if (ltv >= 10000) tier = 'bronze' // $100+

  if (tier && memberId) {
    await supabase
      .from('member_organizations')
      .update({ 
        donor_tier: tier,
        lifetime_value_cents: ltv 
      })
      .eq('id', memberId)
  }

  return { ltv, tier }
}

async function actionFlagAtRisk(supabase: any, orgId: string, action: any, context: any) {
  const memberId = context.entity?.id || context.member_id

  await supabase
    .from('member_organizations')
    .update({ 
      risk_flag: action.risk_level || 'high',
      risk_flagged_at: new Date().toISOString()
    })
    .eq('id', memberId)

  return { flagged: true }
}

async function actionGenerateDocument(supabase: any, orgId: string, action: any, context: any) {
  // Queue document generation
  const { data } = await supabase
    .from('generated_documents')
    .insert({
      organization_id: orgId,
      template_id: action.template_id,
      document_type: action.document_type,
      entity_table: action.entity_table,
      entity_id: getByPath(context, action.entity_id_path),
      title: interpolate(action.title || 'Generated Document', context),
      merge_data: context,
    })
    .select()
    .single()

  return data
}

async function actionWebhook(action: any, context: any) {
  const response = await fetch(action.url, {
    method: action.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...action.headers,
    },
    body: JSON.stringify(context),
  })

  return { status: response.status, ok: response.ok }
}

// Helper functions
function interpolate(template: string, context: any): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
    return getByPath(context, path) || ''
  })
}

function getByPath(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], obj)
}
