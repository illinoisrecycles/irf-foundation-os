import { triggerWebhooks, WebhookEventType } from '../webhooks'
import { sendEmail } from '../email'

// ============================================================================
// EVENT TYPES
// ============================================================================
export type EventBusEvent = {
  id: string
  organization_id: string
  event_type: string
  payload: Record<string, any>
  created_at: string
}

export type AutomationAction = {
  type: 'send_email' | 'create_work_item' | 'trigger_webhook' | 'slack_notify' | 'update_engagement' | 'add_tag'
  config: Record<string, any>
}

export type AutomationRule = {
  id: string
  name: string
  trigger_type: string
  trigger_conditions: Record<string, any>
  actions: AutomationAction[]
  is_active: boolean
}

// ============================================================================
// CONDITION MATCHING
// ============================================================================
function matchesConditions(payload: Record<string, any>, conditions: Record<string, any>): boolean {
  for (const [key, condition] of Object.entries(conditions)) {
    const value = payload[key]

    // Handle different condition types
    if (typeof condition === 'object' && condition !== null) {
      // Range conditions
      if ('gte' in condition && value < condition.gte) return false
      if ('lte' in condition && value > condition.lte) return false
      if ('gt' in condition && value <= condition.gt) return false
      if ('lt' in condition && value >= condition.lt) return false
      if ('eq' in condition && value !== condition.eq) return false
      if ('ne' in condition && value === condition.ne) return false
      if ('in' in condition && !condition.in.includes(value)) return false
      if ('contains' in condition && !String(value).includes(condition.contains)) return false
    } else {
      // Direct equality
      if (value !== condition) return false
    }
  }
  return true
}

// ============================================================================
// ACTION EXECUTORS
// ============================================================================
async function executeAction(
  action: AutomationAction,
  event: EventBusEvent,
  supabase: any
): Promise<{ success: boolean; error?: string }> {
  try {
    switch (action.type) {
      case 'send_email': {
        const { template, to_field, subject, body } = action.config
        const toEmail = event.payload[to_field] || action.config.to
        if (!toEmail) return { success: false, error: 'No recipient email' }

        await sendEmail({
          to: toEmail,
          subject: interpolateTemplate(subject, event.payload),
          html: interpolateTemplate(body, event.payload),
        })
        return { success: true }
      }

      case 'create_work_item': {
        const { title, description, priority, due_days } = action.config
        const dueAt = due_days
          ? new Date(Date.now() + due_days * 24 * 60 * 60 * 1000).toISOString()
          : null

        await supabase.from('work_items').insert({
          organization_id: event.organization_id,
          item_type: 'task',
          title: interpolateTemplate(title, event.payload),
          description: interpolateTemplate(description, event.payload),
          priority: priority || 'medium',
          due_at: dueAt,
          status: 'open',
          reference_type: event.event_type.split('_')[0],
          reference_id: event.payload.id,
        })
        return { success: true }
      }

      case 'trigger_webhook': {
        const webhookEvent = (action.config.event_type || event.event_type.replace('_', '.')) as WebhookEventType
        await triggerWebhooks(supabase, event.organization_id, webhookEvent, event.payload)
        return { success: true }
      }

      case 'slack_notify': {
        const { webhook_url, message } = action.config
        if (!webhook_url) return { success: false, error: 'No Slack webhook URL' }

        await fetch(webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: interpolateTemplate(message, event.payload),
          }),
        })
        return { success: true }
      }

      case 'update_engagement': {
        const { points, activity_type } = action.config
        const memberId = event.payload.member_organization_id || event.payload.id

        if (memberId && points) {
          await supabase.from('member_activities').insert({
            member_organization_id: memberId,
            activity_type: activity_type || event.event_type,
            points: points,
            reference_type: event.event_type.split('_')[0],
            reference_id: event.payload.id,
          })
          // Trigger engagement recalculation
          await supabase.rpc('calculate_engagement_score', { member_org_id: memberId })
        }
        return { success: true }
      }

      case 'add_tag': {
        const { tag } = action.config
        const memberId = event.payload.member_organization_id || event.payload.id

        if (memberId && tag) {
          const { data: member } = await supabase
            .from('member_organizations')
            .select('tags')
            .eq('id', memberId)
            .single()

          const currentTags = member?.tags || []
          if (!currentTags.includes(tag)) {
            await supabase
              .from('member_organizations')
              .update({ tags: [...currentTags, tag] })
              .eq('id', memberId)
          }
        }
        return { success: true }
      }

      default:
        return { success: false, error: `Unknown action type: ${action.type}` }
    }
  } catch (err: any) {
    console.error(`[Automation] Action ${action.type} failed:`, err)
    return { success: false, error: err.message }
  }
}

// ============================================================================
// TEMPLATE INTERPOLATION
// ============================================================================
function interpolateTemplate(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined ? String(data[key]) : match
  })
}

// ============================================================================
// MAIN EVENT PROCESSOR
// ============================================================================
export async function processEventBus(supabase: any, limit: number = 100): Promise<{
  processed: number
  errors: number
}> {
  // Fetch unprocessed events
  const { data: events, error } = await supabase
    .from('event_bus')
    .select('*')
    .eq('processed', false)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error || !events?.length) {
    return { processed: 0, errors: 0 }
  }

  let processed = 0
  let errors = 0

  for (const event of events) {
    try {
      // Fetch matching automation rules
      const { data: rules } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('organization_id', event.organization_id)
        .eq('trigger_type', event.event_type)
        .eq('is_active', true)

      for (const rule of rules || []) {
        // Check if conditions match
        if (!matchesConditions(event.payload, rule.trigger_conditions)) {
          continue
        }

        // Execute all actions
        for (const action of rule.actions) {
          const result = await executeAction(action, event, supabase)
          if (!result.success) {
            console.error(`[Automation] Rule ${rule.name} action failed:`, result.error)
          }
        }

        // Update rule stats
        await supabase
          .from('automation_rules')
          .update({
            run_count: supabase.sql`run_count + 1`,
            last_run_at: new Date().toISOString(),
          })
          .eq('id', rule.id)
      }

      // Mark event as processed
      await supabase
        .from('event_bus')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('id', event.id)

      processed++
    } catch (err: any) {
      console.error(`[Automation] Event processing error:`, err)
      await supabase
        .from('event_bus')
        .update({ processed: true, error: err.message })
        .eq('id', event.id)
      errors++
    }
  }

  return { processed, errors }
}

// ============================================================================
// REAL-TIME EVENT TRIGGER (For immediate processing)
// ============================================================================
export async function triggerEvent(
  supabase: any,
  orgId: string,
  eventType: string,
  payload: Record<string, any>
): Promise<void> {
  // Insert into event bus
  const { data: event } = await supabase
    .from('event_bus')
    .insert({
      organization_id: orgId,
      event_type: eventType,
      payload,
    })
    .select()
    .single()

  if (event) {
    // Process immediately (could also be deferred to a queue)
    const { data: rules } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('organization_id', orgId)
      .eq('trigger_type', eventType)
      .eq('is_active', true)

    for (const rule of rules || []) {
      if (matchesConditions(payload, rule.trigger_conditions)) {
        for (const action of rule.actions) {
          await executeAction(action, event, supabase)
        }
      }
    }

    await supabase
      .from('event_bus')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('id', event.id)
  }
}
