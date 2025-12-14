import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAction, type AutomationAction, type ActionResult } from './actions'

// ============================================================================
// AUTOMATION RUNNER
// Processes queue items and records results
// ============================================================================

export type QueueItem = {
  id: string
  organization_id: string
  rule_id: string
  event_type: string
  event_payload: Record<string, any>
  attempts: number
}

/**
 * Run automation for a single queue item
 */
export async function runAutomationForQueueItem(
  supabase: SupabaseClient,
  item: QueueItem
): Promise<void> {
  const startedAt = new Date()

  // Get the automation rule
  const { data: rule, error: ruleErr } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('id', item.rule_id)
    .eq('organization_id', item.organization_id)
    .single()

  if (ruleErr || !rule) {
    await supabase.rpc('fail_automation_queue', {
      p_id: item.id,
      p_error: `Rule not found: ${item.rule_id}`,
    })
    return
  }

  if (!rule.is_active) {
    await supabase.rpc('complete_automation_queue', {
      p_id: item.id,
      p_result: { skipped: true, reason: 'rule_inactive' },
    })
    return
  }

  // Execute actions sequentially
  const actions = (rule.actions || []) as AutomationAction[]
  const results: ActionResult[] = []
  let hasError = false

  for (const action of actions) {
    // Handle delay action specially
    if (action.type === 'delay') {
      // Re-queue with delay
      await supabase
        .from('automation_queue')
        .update({
          status: 'pending',
          scheduled_for: new Date(Date.now() + action.minutes * 60 * 1000).toISOString(),
          locked_at: null,
          locked_by: null,
        })
        .eq('id', item.id)
      
      // Record partial run
      await recordRun(supabase, item, rule, startedAt, results, 'delayed')
      return
    }

    const result = await executeAction(
      supabase,
      item.organization_id,
      item.event_payload,
      action
    )

    results.push(result)

    if (!result.success) {
      hasError = true
      // Continue or stop based on rule config
      if (rule.stop_on_error !== false) {
        break
      }
    }
  }

  // Record the automation run
  await recordRun(
    supabase, 
    item, 
    rule, 
    startedAt, 
    results, 
    hasError ? 'failed' : 'completed'
  )

  // Update queue item
  if (hasError) {
    const lastError = results.find(r => !r.success)?.error || 'Unknown error'
    await supabase.rpc('fail_automation_queue', {
      p_id: item.id,
      p_error: lastError,
    })
  } else {
    await supabase.rpc('complete_automation_queue', {
      p_id: item.id,
      p_result: { results },
    })
  }
}

/**
 * Record an automation run for audit/history
 */
async function recordRun(
  supabase: SupabaseClient,
  item: QueueItem,
  rule: any,
  startedAt: Date,
  results: ActionResult[],
  status: 'completed' | 'failed' | 'delayed'
): Promise<void> {
  await supabase.from('automation_runs').insert({
    organization_id: item.organization_id,
    rule_id: item.rule_id,
    queue_item_id: item.id,
    event_type: item.event_type,
    event_payload: item.event_payload,
    status,
    started_at: startedAt.toISOString(),
    completed_at: new Date().toISOString(),
    duration_ms: Date.now() - startedAt.getTime(),
    actions_executed: results.length,
    actions_succeeded: results.filter(r => r.success).length,
    actions_failed: results.filter(r => !r.success).length,
    results,
    error: results.find(r => !r.success)?.error,
  })
}

/**
 * Trigger an event and enqueue matching automations
 */
export async function triggerEvent(
  supabase: SupabaseClient,
  organizationId: string,
  eventType: string,
  payload: Record<string, any>,
  scheduledFor?: Date
): Promise<{ queued: number }> {
  // Map old event types to new format if needed
  const { data: mapping } = await supabase
    .from('event_type_mapping')
    .select('new_type')
    .eq('old_type', eventType)
    .maybeSingle()

  const normalizedEventType = mapping?.new_type || eventType

  // Find matching active rules
  const { data: rules, error } = await supabase
    .from('automation_rules')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .contains('trigger_events', [normalizedEventType])

  if (error || !rules?.length) {
    return { queued: 0 }
  }

  // Enqueue each matching rule
  let queued = 0
  for (const rule of rules) {
    const { error: enqueueErr } = await supabase.rpc('enqueue_automation', {
      p_organization_id: organizationId,
      p_rule_id: rule.id,
      p_event_type: normalizedEventType,
      p_event_payload: payload,
      p_scheduled_for: scheduledFor?.toISOString() || new Date().toISOString(),
    })

    if (!enqueueErr) queued++
  }

  return { queued }
}
