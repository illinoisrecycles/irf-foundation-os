import type { SupabaseClient } from '@supabase/supabase-js'
import { queueEmail } from '@/lib/email/outbox'

// ============================================================================
// AUTOMATION ACTIONS
// All actions an automation rule can perform
// ============================================================================

export type AutomationAction =
  | { type: 'create_work_item'; title: string; description?: string; priority?: string; reference_type?: string; reference_id_path?: string; dedupe_key?: string }
  | { type: 'send_email'; template_id?: string; to_path: string; subject: string; body_template: string; data?: Record<string, any> }
  | { type: 'update_status'; table: string; id_path: string; status_field?: string; status_value: string }
  | { type: 'assign_reviewer'; application_id_path: string; reviewer_profile_id?: string; auto_assign?: boolean; role?: string }
  | { type: 'create_payment_request'; amount_cents_path: string; payer_email_path?: string; memo?: string; due_days?: number }
  | { type: 'trigger_webhook'; webhook_id: string; payload_template?: Record<string, any> }
  | { type: 'add_tag'; entity_type: string; entity_id_path: string; tag: string }
  | { type: 'remove_tag'; entity_type: string; entity_id_path: string; tag: string }
  | { type: 'update_field'; table: string; id_path: string; field: string; value_path?: string; value?: any }
  | { type: 'create_task'; title: string; description?: string; due_days?: number; assignee_path?: string }
  | { type: 'slack_notify'; channel: string; message_template: string }
  | { type: 'delay'; minutes: number }

export type ActionResult = {
  success: boolean
  action_type: string
  details?: Record<string, any>
  error?: string
}

/**
 * Execute a single automation action
 */
export async function executeAction(
  supabase: SupabaseClient,
  orgId: string,
  eventPayload: Record<string, any>,
  action: AutomationAction,
  profileId?: string
): Promise<ActionResult> {
  try {
    switch (action.type) {
      case 'create_work_item': {
        const referenceId = action.reference_id_path 
          ? getByPath(eventPayload, action.reference_id_path) 
          : undefined

        // Check for deduplication
        if (action.dedupe_key) {
          const { data: existing } = await supabase
            .from('work_items')
            .select('id')
            .eq('organization_id', orgId)
            .eq('dedupe_key', interpolate(action.dedupe_key, eventPayload))
            .maybeSingle()

          if (existing) {
            return { success: true, action_type: action.type, details: { skipped: true, reason: 'duplicate' } }
          }
        }

        const { data, error } = await supabase
          .from('work_items')
          .insert({
            organization_id: orgId,
            item_type: action.reference_type || 'task',
            title: interpolate(action.title, eventPayload),
            description: action.description ? interpolate(action.description, eventPayload) : null,
            priority: action.priority || 'medium',
            reference_type: action.reference_type,
            reference_id: referenceId,
            dedupe_key: action.dedupe_key ? interpolate(action.dedupe_key, eventPayload) : null,
            status: 'open',
          })
          .select('id')
          .single()

        if (error) throw error
        return { success: true, action_type: action.type, details: { work_item_id: data.id } }
      }

      case 'send_email': {
        const toEmail = getByPath(eventPayload, action.to_path)
        if (!toEmail) throw new Error(`send_email: no email at path ${action.to_path}`)

        const mergedData = { ...eventPayload, ...action.data }
        const subject = interpolate(action.subject, mergedData)
        const html = interpolate(action.body_template, mergedData)

        const emailId = await queueEmail({
          organizationId: orgId,
          to: toEmail,
          subject,
          html,
          idempotencyKey: `automation_${orgId}_${Date.now()}`,
        })

        return { success: true, action_type: action.type, details: { email_id: emailId } }
      }

      case 'update_status': {
        const id = getByPath(eventPayload, action.id_path)
        if (!id) throw new Error(`update_status: missing id at path ${action.id_path}`)

        const statusField = action.status_field ?? 'status'
        const { error } = await supabase
          .from(action.table)
          .update({ [statusField]: action.status_value, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('organization_id', orgId)

        if (error) throw error
        return { success: true, action_type: action.type, details: { table: action.table, id, status: action.status_value } }
      }

      case 'assign_reviewer': {
        const applicationId = getByPath(eventPayload, action.application_id_path)
        if (!applicationId) throw new Error(`assign_reviewer: missing application id`)

        let reviewerId = action.reviewer_profile_id

        // Auto-assign: find reviewer with least current assignments
        if (action.auto_assign && !reviewerId) {
          const { data: reviewers } = await supabase
            .from('grant_reviewers')
            .select(`
              profile_id,
              assignments:grant_reviewer_assignments(count)
            `)
            .eq('organization_id', orgId)
            .eq('is_active', true)
            .order('assignments', { ascending: true })
            .limit(1)

          reviewerId = reviewers?.[0]?.profile_id
        }

        if (!reviewerId) throw new Error('assign_reviewer: no reviewer available')

        const { data, error } = await supabase
          .from('grant_reviewer_assignments')
          .insert({
            organization_id: orgId,
            application_id: applicationId,
            reviewer_profile_id: reviewerId,
            role: action.role ?? 'reviewer',
            status: 'assigned',
          })
          .select('id')
          .single()

        if (error) throw error
        return { success: true, action_type: action.type, details: { assignment_id: data.id, reviewer_id: reviewerId } }
      }

      case 'create_payment_request': {
        const amountCents = Number(getByPath(eventPayload, action.amount_cents_path) ?? 0)
        if (!amountCents || amountCents <= 0) throw new Error(`create_payment_request: invalid amount`)

        const payerEmail = action.payer_email_path ? getByPath(eventPayload, action.payer_email_path) : null
        const dueAt = new Date()
        dueAt.setDate(dueAt.getDate() + (action.due_days ?? 14))

        const { data, error } = await supabase
          .from('payments')
          .insert({
            organization_id: orgId,
            amount_cents: amountCents,
            currency: 'usd',
            payment_type: 'request',
            status: 'pending',
            payer_email: payerEmail,
            description: action.memo ? interpolate(action.memo, eventPayload) : 'Payment request',
            due_at: dueAt.toISOString(),
          })
          .select('id')
          .single()

        if (error) throw error

        // Create work item for visibility
        await supabase.from('work_items').insert({
          organization_id: orgId,
          item_type: 'payment',
          title: `Payment request: $${(amountCents / 100).toFixed(2)}`,
          reference_type: 'payment',
          reference_id: data.id,
          priority: 'medium',
        })

        return { success: true, action_type: action.type, details: { payment_id: data.id, amount_cents: amountCents } }
      }

      case 'trigger_webhook': {
        const { data: webhook, error: whErr } = await supabase
          .from('webhooks')
          .select('url, secret')
          .eq('id', action.webhook_id)
          .eq('organization_id', orgId)
          .eq('is_active', true)
          .single()

        if (whErr || !webhook) throw new Error('Webhook not found or inactive')

        const payload = action.payload_template 
          ? interpolateObject(action.payload_template, eventPayload)
          : eventPayload

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': webhook.secret,
          },
          body: JSON.stringify(payload),
        })

        return { 
          success: response.ok, 
          action_type: action.type, 
          details: { status: response.status, webhook_id: action.webhook_id } 
        }
      }

      case 'update_field': {
        const id = getByPath(eventPayload, action.id_path)
        if (!id) throw new Error(`update_field: missing id at path ${action.id_path}`)

        const value = action.value_path 
          ? getByPath(eventPayload, action.value_path)
          : action.value

        const { error } = await supabase
          .from(action.table)
          .update({ [action.field]: value, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('organization_id', orgId)

        if (error) throw error
        return { success: true, action_type: action.type, details: { table: action.table, id, field: action.field } }
      }

      case 'add_tag':
      case 'remove_tag': {
        const entityId = getByPath(eventPayload, action.entity_id_path)
        if (!entityId) throw new Error(`${action.type}: missing entity id`)

        if (action.type === 'add_tag') {
          await supabase.from('entity_tags').upsert({
            organization_id: orgId,
            entity_type: action.entity_type,
            entity_id: entityId,
            tag: action.tag,
          }, { onConflict: 'organization_id,entity_type,entity_id,tag' })
        } else {
          await supabase.from('entity_tags')
            .delete()
            .eq('organization_id', orgId)
            .eq('entity_type', action.entity_type)
            .eq('entity_id', entityId)
            .eq('tag', action.tag)
        }

        return { success: true, action_type: action.type, details: { entity_id: entityId, tag: action.tag } }
      }

      case 'delay': {
        // Delay is handled by the queue - just return success
        return { success: true, action_type: action.type, details: { minutes: action.minutes } }
      }

      default:
        throw new Error(`Unsupported action type: ${(action as any).type}`)
    }
  } catch (err: any) {
    return { success: false, action_type: action.type, error: err.message }
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function getByPath(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), obj)
}

function interpolate(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
    const value = getByPath(data, path)
    return value !== undefined ? String(value) : ''
  })
}

function interpolateObject(template: Record<string, any>, data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(template)) {
    if (typeof value === 'string') {
      result[key] = interpolate(value, data)
    } else if (typeof value === 'object' && value !== null) {
      result[key] = interpolateObject(value, data)
    } else {
      result[key] = value
    }
  }
  return result
}
