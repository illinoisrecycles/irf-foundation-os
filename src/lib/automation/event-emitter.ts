/**
 * Unified Automation Event Emitter
 * 
 * Central module for emitting events that trigger automations.
 * Uses dot-notation taxonomy: entity.action (e.g., donation.created)
 * 
 * Events are:
 * 1. Logged to automation_event_log for audit
 * 2. Matched against active automation rules
 * 3. Queued for processing
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Standard event taxonomy
 */
export const EVENT_TAXONOMY = {
  // Donations
  DONATION_CREATED: 'donation.created',
  DONATION_REFUNDED: 'donation.refunded',
  
  // Membership
  MEMBERSHIP_RENEWED: 'membership.renewed',
  MEMBERSHIP_EXPIRED: 'membership.expired',
  MEMBERSHIP_EXPIRING_SOON: 'membership.expiring_soon',
  MEMBERSHIP_CREATED: 'membership.created',
  
  // Payments
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  
  // Grants
  GRANT_APPLICATION_SUBMITTED: 'grant.application.submitted',
  GRANT_APPLICATION_READY_FOR_REVIEW: 'grant.application.ready_for_review',
  GRANT_REVIEW_ASSIGNED: 'grant.review.assigned',
  GRANT_REVIEW_COMPLETED: 'grant.review.completed',
  GRANT_AWARDED: 'grant.awarded',
  GRANT_DECLINED: 'grant.declined',
  GRANT_REPORT_DUE: 'grant.report.due',
  GRANT_DISBURSEMENT_SCHEDULED: 'grant.disbursement.scheduled',
  GRANT_DISBURSEMENT_PAID: 'grant.disbursement.paid',
  
  // Events
  EVENT_REGISTRATION_CREATED: 'event.registration.created',
  EVENT_REGISTRATION_PAID: 'event.registration.paid',
  EVENT_REGISTRATION_CANCELED: 'event.registration.canceled',
  EVENT_REMINDER_24H: 'event.reminder.24h',
  EVENT_COMPLETED: 'event.completed',
  
  // Volunteers
  VOLUNTEER_SIGNUP_CREATED: 'volunteer.signup.created',
  VOLUNTEER_HOURS_LOGGED: 'volunteer.hours.logged',
  VOLUNTEER_HOURS_MILESTONE: 'volunteer.hours.milestone',
  
  // Board
  BOARD_MEETING_REMINDER_7D: 'board.meeting.reminder.7d',
  BOARD_MEETING_REMINDER_1D: 'board.meeting.reminder.1d',
  BOARD_VOTE_CREATED: 'board.vote.created',
  
  // Compliance
  COMPLIANCE_TICK_DAILY: 'compliance.tick.daily',
  COMPLIANCE_TICK_WEEKLY: 'compliance.tick.weekly',
  
  // Members
  MEMBER_HEALTH_ALERT: 'member.health.alert',
  MEMBER_PROFILE_UPDATED: 'member.profile.updated',
} as const

export type EventName = typeof EVENT_TAXONOMY[keyof typeof EVENT_TAXONOMY] | string

/**
 * Emit an automation event
 * 
 * @param organizationId - The organization context
 * @param eventName - Dot-notation event name (e.g., 'donation.created')
 * @param payload - Event data available for variable substitution in actions
 * @param sourceType - Where the event originated (webhook, api, cron, manual)
 * @param sourceId - Unique identifier for the source (e.g., webhook event ID)
 */
export async function emitAutomationEvent(
  organizationId: string,
  eventName: EventName,
  payload: Record<string, any>,
  sourceType: 'webhook' | 'api' | 'cron' | 'manual' = 'api',
  sourceId?: string
): Promise<{ rulesMatched: number; rulesExecuted: number }> {
  
  // 1. Log the event
  const { data: eventLog } = await supabase
    .from('automation_event_log')
    .insert({
      organization_id: organizationId,
      event_name: eventName,
      event_payload: payload,
      source_type: sourceType,
      source_id: sourceId,
    })
    .select()
    .single()

  // 2. Find matching rules
  const { data: rules } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .contains('trigger_events', [eventName])

  if (!rules || rules.length === 0) {
    return { rulesMatched: 0, rulesExecuted: 0 }
  }

  // 3. Filter by conditions
  const matchingRules = rules.filter(rule => {
    if (!rule.filters) return true
    return evaluateFilters(rule.filters, payload)
  })

  // 4. Queue for execution
  let rulesExecuted = 0
  for (const rule of matchingRules) {
    try {
      await supabase.from('automation_queue').insert({
        organization_id: organizationId,
        rule_id: rule.id,
        event_name: eventName,
        event_payload: payload,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      rulesExecuted++
    } catch (err) {
      console.error(`Failed to queue rule ${rule.id}:`, err)
    }
  }

  // 5. Update event log with match count
  if (eventLog) {
    await supabase
      .from('automation_event_log')
      .update({ 
        rules_matched: matchingRules.length,
        rules_executed: rulesExecuted 
      })
      .eq('id', eventLog.id)
  }

  return { 
    rulesMatched: matchingRules.length, 
    rulesExecuted 
  }
}

/**
 * Evaluate rule filters against event payload
 */
function evaluateFilters(
  filters: Record<string, any>,
  payload: Record<string, any>
): boolean {
  for (const [field, condition] of Object.entries(filters)) {
    const value = getNestedValue(payload, field)

    if (typeof condition === 'object' && condition !== null) {
      // Complex conditions: { gte: 100, lte: 500 }
      if ('gte' in condition && value < condition.gte) return false
      if ('gt' in condition && value <= condition.gt) return false
      if ('lte' in condition && value > condition.lte) return false
      if ('lt' in condition && value >= condition.lt) return false
      if ('eq' in condition && value !== condition.eq) return false
      if ('ne' in condition && value === condition.ne) return false
      if ('in' in condition && !condition.in.includes(value)) return false
      if ('nin' in condition && condition.nin.includes(value)) return false
      if ('contains' in condition && !String(value).includes(condition.contains)) return false
      if ('starts_with' in condition && !String(value).startsWith(condition.starts_with)) return false
      if ('ends_with' in condition && !String(value).endsWith(condition.ends_with)) return false
    } else {
      // Simple equality
      if (value !== condition) return false
    }
  }

  return true
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

/**
 * Helper to emit common events
 */
export const emitEvents = {
  donationCreated: (orgId: string, data: {
    donation_id: string
    donor_email: string
    donor_name?: string
    amount_cents: number
    is_first_donation?: boolean
    is_recurring?: boolean
  }) => emitAutomationEvent(orgId, EVENT_TAXONOMY.DONATION_CREATED, {
    ...data,
    amount_dollars: (data.amount_cents / 100).toFixed(2),
    donation_date: new Date().toISOString(),
  }),

  memberCreated: (orgId: string, data: {
    member_org_id?: string
    member_email: string
    member_name?: string
    organization_name?: string
    membership_type?: string
  }) => emitAutomationEvent(orgId, 'member.created', {
    ...data,
    created_at: new Date().toISOString(),
  }),

  membershipRenewed: (orgId: string, data: {
    member_org_id: string
    member_email: string
    member_name: string
    expires_at: string
    amount_cents?: number
  }) => emitAutomationEvent(orgId, EVENT_TAXONOMY.MEMBERSHIP_RENEWED, data),

  grantApplicationSubmitted: (orgId: string, data: {
    application_id: string
    applicant_email: string
    applicant_name: string
    project_title: string
    organization_name: string
    requested_amount_cents: number
  }) => emitAutomationEvent(orgId, EVENT_TAXONOMY.GRANT_APPLICATION_SUBMITTED, {
    ...data,
    requested_amount_dollars: (data.requested_amount_cents / 100).toFixed(2),
    submitted_at: new Date().toISOString(),
  }),

  grantAwarded: (orgId: string, data: {
    application_id: string
    applicant_email: string
    applicant_name: string
    project_title: string
    award_amount_cents: number
    grant_start: string
    grant_end: string
  }) => emitAutomationEvent(orgId, EVENT_TAXONOMY.GRANT_AWARDED, {
    ...data,
    award_amount_dollars: (data.award_amount_cents / 100).toFixed(2),
  }),

  paymentFailed: (orgId: string, data: {
    member_org_id: string
    member_email: string
    member_name: string
    amount_cents: number
    billing_url: string
  }) => emitAutomationEvent(orgId, EVENT_TAXONOMY.PAYMENT_FAILED, data),

  eventRegistration: (orgId: string, data: {
    registration_id: string
    event_id: string
    event_title: string
    event_date: string
    event_time?: string
    event_location?: string
    registrant_email: string
    registrant_name: string
    is_virtual?: boolean
    virtual_link?: string
  }) => emitAutomationEvent(orgId, EVENT_TAXONOMY.EVENT_REGISTRATION_CREATED, data),

  invoiceOverdue: (orgId: string, data: {
    invoice_id: string
    invoice_number: string
    bill_to_email: string
    amount_cents: number
    amount_formatted: string
    pay_url: string
    due_date: string
  }) => emitAutomationEvent(orgId, 'invoice.overdue', data),

  approvalCreated: (orgId: string, data: {
    approval_id: string
    approval_type: string
    title: string
    amount_cents?: number
    created_by_email: string
  }) => emitAutomationEvent(orgId, 'approval.created', data),
}
