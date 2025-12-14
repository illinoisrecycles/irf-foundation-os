import { createAdminClient } from '@/lib/supabase/admin'
import { generatePersonalizedEmail } from '@/lib/ai'
import { sendEmail } from '@/lib/email'
import { triggerWebhooks, WebhookEventType } from '@/lib/webhooks'

// ============================================================================
// TYPES
// ============================================================================
type QueueItem = {
  id: string
  organization_id: string
  event_type: string
  payload: Record<string, any>
  status: string
  retry_count: number
  max_retries: number
}

type AutomationRule = {
  id: string
  name: string
  trigger_type: string
  trigger_conditions: Record<string, any>
  actions: ActionConfig[]
  is_active: boolean
}

type ActionConfig = {
  type: 'send_email' | 'ai_email_draft' | 'create_work_item' | 'slack_notify' | 
        'update_engagement' | 'add_tag' | 'trigger_webhook' | 'delay' |
        'update_status' | 'assign_reviewer' | 'sms_notify'
  config: Record<string, any>
}

type ActionResult = {
  action: string
  success: boolean
  result?: any
  error?: string
}

// ============================================================================
// MAIN QUEUE PROCESSOR
// ============================================================================
export async function processAutomationQueue(workerId: string = 'default'): Promise<{
  processed: number
  succeeded: number
  failed: number
}> {
  const supabase = createAdminClient()
  const lockDuration = 5 * 60 * 1000 // 5 minutes
  
  let processed = 0
  let succeeded = 0
  let failed = 0

  // Fetch and lock pending items (prevents concurrent processing)
  const { data: items, error } = await supabase
    .from('automation_queue')
    .select('*')
    .in('status', ['pending', 'retrying'])
    .lte('scheduled_for', new Date().toISOString())
    .is('locked_at', null)
    .order('created_at', { ascending: true })
    .limit(50)

  if (error || !items?.length) {
    return { processed: 0, succeeded: 0, failed: 0 }
  }

  for (const item of items) {
    // Lock the item
    const { error: lockError } = await supabase
      .from('automation_queue')
      .update({
        status: 'processing',
        locked_at: new Date().toISOString(),
        locked_by: workerId,
      })
      .eq('id', item.id)
      .is('locked_at', null) // Optimistic lock

    if (lockError) continue // Another worker got it

    try {
      const result = await processQueueItem(item as QueueItem)
      
      if (result.success) {
        succeeded++
        await supabase
          .from('automation_queue')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString(),
            locked_at: null,
            locked_by: null,
          })
          .eq('id', item.id)
      } else {
        throw new Error(result.error || 'Processing failed')
      }
    } catch (err: any) {
      failed++
      const newRetryCount = (item.retry_count || 0) + 1
      const shouldRetry = newRetryCount < (item.max_retries || 3)

      await supabase
        .from('automation_queue')
        .update({
          status: shouldRetry ? 'retrying' : 'failed',
          retry_count: newRetryCount,
          error_message: err.message,
          locked_at: null,
          locked_by: null,
          // Exponential backoff: 1min, 5min, 25min
          scheduled_for: shouldRetry 
            ? new Date(Date.now() + Math.pow(5, newRetryCount) * 60000).toISOString()
            : undefined,
        })
        .eq('id', item.id)
    }

    processed++
  }

  // Clean up stale locks (items locked > 5 minutes ago)
  await supabase
    .from('automation_queue')
    .update({ locked_at: null, locked_by: null, status: 'retrying' })
    .eq('status', 'processing')
    .lt('locked_at', new Date(Date.now() - lockDuration).toISOString())

  return { processed, succeeded, failed }
}

// ============================================================================
// PROCESS SINGLE QUEUE ITEM
// ============================================================================
async function processQueueItem(item: QueueItem): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()

  // Fetch matching automation rules
  const { data: rules, error: rulesError } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('organization_id', item.organization_id)
    .eq('trigger_type', item.event_type)
    .eq('is_active', true)

  if (rulesError) {
    return { success: false, error: rulesError.message }
  }

  if (!rules?.length) {
    // No rules to run - mark as success
    return { success: true }
  }

  const results: ActionResult[] = []

  for (const rule of rules as AutomationRule[]) {
    // Evaluate conditions
    if (!evaluateConditions(rule.trigger_conditions, item.payload)) {
      continue
    }

    // Create automation run record
    const { data: run } = await supabase
      .from('automation_runs')
      .insert({
        queue_item_id: item.id,
        rule_id: rule.id,
        organization_id: item.organization_id,
        trigger_event: item.event_type,
        trigger_payload: item.payload,
        status: 'running',
      })
      .select()
      .single()

    const runId = run?.id
    const actionResults: ActionResult[] = []

    // Execute actions
    for (const action of rule.actions) {
      const result = await executeAction(action, item, supabase)
      actionResults.push(result)
      results.push(result)

      // Stop on failure unless configured to continue
      if (!result.success && !action.config.continue_on_failure) {
        break
      }
    }

    // Update run record
    const allSucceeded = actionResults.every(r => r.success)
    await supabase
      .from('automation_runs')
      .update({
        actions_executed: actionResults,
        status: allSucceeded ? 'completed' : 'partial',
        completed_at: new Date().toISOString(),
        duration_ms: run ? Date.now() - new Date(run.started_at).getTime() : 0,
      })
      .eq('id', runId)

    // Update rule stats
    await supabase
      .from('automation_rules')
      .update({
        run_count: supabase.sql`run_count + 1`,
        last_run_at: new Date().toISOString(),
      })
      .eq('id', rule.id)
  }

  const anyFailed = results.some(r => !r.success)
  return {
    success: !anyFailed,
    error: anyFailed ? results.find(r => !r.success)?.error : undefined,
  }
}

// ============================================================================
// CONDITION EVALUATOR (The "Smart" Filter)
// ============================================================================
function evaluateConditions(conditions: Record<string, any>, payload: Record<string, any>): boolean {
  if (!conditions || Object.keys(conditions).length === 0) {
    return true // No conditions = always match
  }

  for (const [field, condition] of Object.entries(conditions)) {
    const value = getNestedValue(payload, field)

    if (typeof condition === 'object' && condition !== null && !Array.isArray(condition)) {
      // Complex condition
      if ('eq' in condition && value !== condition.eq) return false
      if ('ne' in condition && value === condition.ne) return false
      if ('gt' in condition && !(value > condition.gt)) return false
      if ('gte' in condition && !(value >= condition.gte)) return false
      if ('lt' in condition && !(value < condition.lt)) return false
      if ('lte' in condition && !(value <= condition.lte)) return false
      if ('in' in condition && !condition.in.includes(value)) return false
      if ('nin' in condition && condition.nin.includes(value)) return false
      if ('contains' in condition && !String(value).includes(condition.contains)) return false
      if ('startsWith' in condition && !String(value).startsWith(condition.startsWith)) return false
      if ('exists' in condition && (condition.exists ? value === undefined : value !== undefined)) return false
      if ('isNull' in condition && (condition.isNull ? value !== null : value === null)) return false
    } else {
      // Direct equality
      if (value !== condition) return false
    }
  }

  return true
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc?.[part], obj)
}

// ============================================================================
// ACTION EXECUTORS
// ============================================================================
async function executeAction(
  action: ActionConfig,
  item: QueueItem,
  supabase: any
): Promise<ActionResult> {
  const startTime = Date.now()

  try {
    switch (action.type) {
      case 'send_email': {
        const { to_field, to, subject, body, template } = action.config
        const recipientEmail = to || item.payload[to_field]
        
        if (!recipientEmail) {
          return { action: action.type, success: false, error: 'No recipient email' }
        }

        // Queue in email outbox for reliable delivery
        await supabase.from('email_outbox').insert({
          organization_id: item.organization_id,
          to_email: recipientEmail,
          subject: interpolate(subject, item.payload),
          html_body: interpolate(body, item.payload),
          template_id: template,
          template_data: item.payload,
          idempotency_key: `${item.id}_${action.type}_${Date.now()}`,
        })

        return { action: action.type, success: true, result: { queued: true } }
      }

      case 'ai_email_draft': {
        // KILLER FEATURE: AI drafts the email, human reviews
        const { context_template, tone, approval_required } = action.config
        const context = interpolate(context_template, item.payload)

        const draft = await generatePersonalizedEmail({
          recipientName: item.payload.donor_name || item.payload.name || 'Member',
          recipientType: item.event_type.includes('donation') ? 'donor' : 'member',
          purpose: item.event_type.includes('donation') ? 'thank_you' : 're_engagement',
          context: item.payload,
          tone: tone || 'friendly',
        })

        if (approval_required !== false) {
          // Create review task instead of sending
          await supabase.from('work_items').insert({
            organization_id: item.organization_id,
            item_type: 'approval',
            title: `Review: ${draft.subject}`,
            description: `AI-generated email for ${item.payload.email || item.payload.donor_email}:\n\n${draft.body}`,
            priority: 'medium',
            metadata: {
              draft_subject: draft.subject,
              draft_body: draft.body,
              recipient: item.payload.email || item.payload.donor_email,
              action: 'send_email',
            },
            reference_type: item.event_type.split('.')[0],
            reference_id: item.payload.id,
          })
          return { action: action.type, success: true, result: { draft, requires_approval: true } }
        }

        // Direct send (if no approval required)
        await supabase.from('email_outbox').insert({
          organization_id: item.organization_id,
          to_email: item.payload.email || item.payload.donor_email,
          subject: draft.subject,
          html_body: draft.body,
        })

        return { action: action.type, success: true, result: { draft, sent: true } }
      }

      case 'create_work_item': {
        const { title, description, priority, due_days, item_type, assignee } = action.config
        
        const dueAt = due_days
          ? new Date(Date.now() + due_days * 24 * 60 * 60 * 1000).toISOString()
          : null

        const { data: workItem } = await supabase.from('work_items').insert({
          organization_id: item.organization_id,
          item_type: item_type || 'task',
          title: interpolate(title, item.payload),
          description: interpolate(description, item.payload),
          priority: priority || 'medium',
          due_at: dueAt,
          assigned_to: assignee,
          status: 'open',
          reference_type: item.event_type.split('.')[0],
          reference_id: item.payload.id,
          dedupe_key: `${item.id}_${action.type}`,
        }).select().single()

        return { action: action.type, success: true, result: { work_item_id: workItem?.id } }
      }

      case 'slack_notify': {
        const { webhook_url, message, channel } = action.config
        if (!webhook_url) {
          return { action: action.type, success: false, error: 'No Slack webhook URL' }
        }

        const response = await fetch(webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: interpolate(message, item.payload),
            channel: channel,
          }),
        })

        return { 
          action: action.type, 
          success: response.ok, 
          error: response.ok ? undefined : `Slack error: ${response.status}` 
        }
      }

      case 'sms_notify': {
        // Future: Integrate Twilio
        const { to_field, message } = action.config
        const phone = item.payload[to_field]
        
        // For now, create a work item to manually send
        await supabase.from('work_items').insert({
          organization_id: item.organization_id,
          item_type: 'task',
          title: `Send SMS to ${phone}`,
          description: interpolate(message, item.payload),
          priority: 'high',
        })

        return { action: action.type, success: true, result: { queued_manual: true } }
      }

      case 'update_engagement': {
        const { points, activity_type } = action.config
        const memberId = item.payload.member_organization_id

        if (memberId && points) {
          await supabase.from('member_activities').insert({
            member_organization_id: memberId,
            activity_type: activity_type || item.event_type,
            points: points,
            reference_type: item.event_type.split('.')[0],
            reference_id: item.payload.id,
          })

          await supabase.rpc('calculate_engagement_score', { member_org_id: memberId })
        }

        return { action: action.type, success: true }
      }

      case 'add_tag': {
        const { tag, tag_field } = action.config
        const tagValue = tag || item.payload[tag_field]
        const memberId = item.payload.member_organization_id

        if (memberId && tagValue) {
          const { data: member } = await supabase
            .from('member_organizations')
            .select('tags')
            .eq('id', memberId)
            .single()

          const currentTags = member?.tags || []
          if (!currentTags.includes(tagValue)) {
            await supabase
              .from('member_organizations')
              .update({ tags: [...currentTags, tagValue] })
              .eq('id', memberId)
          }
        }

        return { action: action.type, success: true }
      }

      case 'trigger_webhook': {
        const eventType = (action.config.event_type || item.event_type.replace('_', '.')) as WebhookEventType
        const result = await triggerWebhooks(supabase, item.organization_id, eventType, item.payload)
        return { action: action.type, success: true, result }
      }

      case 'delay': {
        const { minutes } = action.config
        // Re-queue the remaining actions with a delay
        // This is handled by the scheduler, not here
        return { action: action.type, success: true, result: { delayed_minutes: minutes } }
      }

      case 'update_status': {
        const { entity_type, status_field, new_status } = action.config
        const entityId = item.payload.id

        if (entityId && entity_type) {
          await supabase
            .from(entity_type)
            .update({ [status_field || 'status']: new_status })
            .eq('id', entityId)
        }

        return { action: action.type, success: true }
      }

      case 'assign_reviewer': {
        const { reviewer_pool, auto_detect_conflict } = action.config
        // For grants workflow
        // Implementation would pick from reviewer pool, check conflicts
        return { action: action.type, success: true, result: { pending_implementation: true } }
      }

      default:
        return { action: action.type, success: false, error: `Unknown action type: ${action.type}` }
    }
  } catch (err: any) {
    return { action: action.type, success: false, error: err.message }
  }
}

// ============================================================================
// TEMPLATE INTERPOLATION
// ============================================================================
function interpolate(template: string, data: Record<string, any>): string {
  if (!template) return ''
  
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const value = getNestedValue(data, path)
    return value !== undefined ? String(value) : match
  })
}

// ============================================================================
// MANUAL EVENT TRIGGER (For testing / API use)
// ============================================================================
export async function emitDomainEvent(
  orgId: string,
  eventType: string,
  payload: Record<string, any>,
  options?: { delay_minutes?: number }
): Promise<string> {
  const supabase = createAdminClient()

  const scheduledFor = options?.delay_minutes
    ? new Date(Date.now() + options.delay_minutes * 60000).toISOString()
    : new Date().toISOString()

  const { data, error } = await supabase
    .from('automation_queue')
    .insert({
      organization_id: orgId,
      event_type: eventType,
      payload,
      scheduled_for: scheduledFor,
    })
    .select()
    .single()

  if (error) throw error

  // Also log to immutable domain_events for audit
  await supabase.from('domain_events').insert({
    organization_id: orgId,
    event_type: eventType,
    aggregate_type: eventType.split('.')[0],
    aggregate_id: payload.id,
    payload,
  })

  return data.id
}
