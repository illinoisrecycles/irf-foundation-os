/**
 * Foundation Automation Recipe Pack v2
 * 
 * Drop-in automation rules aligned with the v2 action schema.
 * Uses dot-notation event taxonomy: entity.action
 * 
 * Seed these via /api/automation/rules endpoint
 */

import type { AutomationAction } from '@/lib/automation/actions'

export interface AutomationRecipe {
  name: string
  description: string
  trigger_events: string[]
  filters?: Record<string, any>
  actions: AutomationAction[]
  is_active: boolean
  stop_on_error?: boolean
  category: 'donations' | 'membership' | 'grants' | 'events' | 'volunteers' | 'compliance' | 'board'
}

export const FOUNDATION_RECIPE_PACK_V2: AutomationRecipe[] = [
  // =====================================================
  // DONATION AUTOMATIONS
  // =====================================================
  {
    name: 'Donation Receipt (Immediate)',
    description: 'Send tax-deductible receipt immediately after successful donation.',
    trigger_events: ['donation.created'],
    actions: [
      {
        type: 'send_email',
        to_path: 'donor_email',
        subject: 'Thank you for your donation to {{org_name}}',
        body_template: `Dear {{donor_name}},

Thank you for your generous gift of ${{amount_dollars}} to {{org_name}}.

Your donation is tax-deductible to the extent allowed by law. Please retain this email as your receipt.

Receipt Details:
- Amount: ${{amount_dollars}}
- Date: {{donation_date}}
- Receipt ID: {{donation_id}}

Your support makes our work possible. Thank you!

Warm regards,
{{org_name}}`,
      },
    ],
    is_active: true,
    stop_on_error: true,
    category: 'donations',
  },
  {
    name: 'Major Gift Alert ($1,000+)',
    description: 'Notify development team and create follow-up task for gifts of $1,000 or more.',
    trigger_events: ['donation.created'],
    filters: { amount_cents: { gte: 100000 } },
    actions: [
      {
        type: 'create_work_item',
        title: 'Major Gift Follow-up: {{donor_name}}',
        description: 'Gift of ${{amount_dollars}} received. Personal thank-you call recommended within 24 hours.',
        priority: 'high',
        reference_type: 'donation',
        reference_id_path: 'donation_id',
        dedupe_key: 'major-gift-{{donation_id}}',
      },
      {
        type: 'slack_notify',
        channel: '#development',
        message_template: '🎉 Major Gift Alert! {{donor_name}} donated ${{amount_dollars}}',
      },
      {
        type: 'add_tag',
        entity_type: 'donations',
        entity_id_path: 'donation_id',
        tag: 'major_gift',
      },
    ],
    is_active: true,
    category: 'donations',
  },
  {
    name: 'First-Time Donor Welcome',
    description: 'Special welcome for first-time donors with engagement opportunities.',
    trigger_events: ['donation.created'],
    filters: { is_first_donation: true },
    actions: [
      {
        type: 'send_email',
        to_path: 'donor_email',
        subject: 'Welcome to the {{org_name}} family!',
        body_template: `Dear {{donor_name}},

Welcome! Your gift of ${{amount_dollars}} marks the beginning of what we hope will be a long relationship.

Here's how you can stay connected:
- Follow us on LinkedIn: {{linkedin_url}}
- Subscribe to our newsletter: {{newsletter_url}}
- Join our volunteer community: {{volunteer_url}}

Thank you for joining our mission!

Best,
{{org_name}}`,
      },
      {
        type: 'add_tag',
        entity_type: 'profiles',
        entity_id_path: 'donor_profile_id',
        tag: 'new_donor_2024',
      },
    ],
    is_active: true,
    category: 'donations',
  },

  // =====================================================
  // MEMBERSHIP AUTOMATIONS
  // =====================================================
  {
    name: 'Membership Renewal Confirmation',
    description: 'Confirm renewal and send updated benefits information.',
    trigger_events: ['membership.renewed'],
    actions: [
      {
        type: 'send_email',
        to_path: 'member_email',
        subject: 'Your {{org_name}} membership has been renewed',
        body_template: `Dear {{member_name}},

Great news! Your membership has been renewed through {{expires_at}}.

Your member benefits:
{{benefits_list}}

Access your member portal: {{portal_url}}

Thank you for your continued support!

Best regards,
{{org_name}}`,
      },
      {
        type: 'create_task',
        title: 'Renewal outreach: {{member_name}}',
        description: 'Send a quick welcome-back note or schedule a check-in call.',
        due_days: 7,
        assignee_path: 'owner_profile_id',
      },
    ],
    is_active: true,
    category: 'membership',
  },
  {
    name: 'Payment Failed - First Notice',
    description: 'Email member immediately when payment fails, tag for follow-up.',
    trigger_events: ['payment.failed'],
    actions: [
      {
        type: 'send_email',
        to_path: 'member_email',
        subject: 'Action Required: Payment issue with your {{org_name}} membership',
        body_template: `Dear {{member_name}},

We were unable to process your recent payment for your {{org_name}} membership.

Please update your payment information to avoid any interruption to your benefits.

Update Payment Method: {{billing_url}}

If you have questions, please reply to this email.

Thank you,
{{org_name}} Team`,
      },
      {
        type: 'add_tag',
        entity_type: 'member_organizations',
        entity_id_path: 'member_org_id',
        tag: 'billing_issue',
      },
      {
        type: 'create_work_item',
        title: 'Payment Failed: {{member_name}}',
        description: 'Follow up if not resolved within 3 days.',
        priority: 'medium',
        reference_type: 'member_organization',
        reference_id_path: 'member_org_id',
        dedupe_key: 'payment-failed-{{member_org_id}}',
      },
    ],
    is_active: true,
    stop_on_error: false,
    category: 'membership',
  },
  {
    name: 'Membership Expiration Warning (30 Days)',
    description: 'Send renewal reminder 30 days before expiration.',
    trigger_events: ['membership.expiring_soon'],
    filters: { days_until_expiry: { lte: 30 } },
    actions: [
      {
        type: 'send_email',
        to_path: 'member_email',
        subject: 'Your {{org_name}} membership expires in {{days_until_expiry}} days',
        body_template: `Dear {{member_name}},

Your {{org_name}} membership will expire on {{expires_at}}.

Renew now to maintain uninterrupted access to your benefits:
- Member directory
- Event discounts
- Resources library
- Networking opportunities

Renew Now: {{renewal_url}}

Questions? Reply to this email anytime.

Best,
{{org_name}}`,
      },
    ],
    is_active: true,
    category: 'membership',
  },
  {
    name: 'Membership Lapsed - Re-engagement',
    description: 'Send a win-back email when membership lapses.',
    trigger_events: ['membership.expired'],
    actions: [
      {
        type: 'send_email',
        to_path: 'member_email',
        subject: 'We miss you at {{org_name}}',
        body_template: `Dear {{member_name}},

We noticed your membership with {{org_name}} has expired. We miss having you as part of our community!

Here's what you're missing:
{{recent_activities}}

Rejoin today: {{renewal_url}}

We'd love to have you back.

Warm regards,
{{org_name}} Team`,
      },
      {
        type: 'update_field',
        table: 'member_organizations',
        id_path: 'member_org_id',
        field: 'status',
        value: 'lapsed',
      },
    ],
    is_active: true,
    category: 'membership',
  },

  // =====================================================
  // GRANT AUTOMATIONS
  // =====================================================
  {
    name: 'Grant Application Acknowledgement',
    description: 'Confirm receipt and create internal triage task.',
    trigger_events: ['grant.application.submitted'],
    actions: [
      {
        type: 'send_email',
        to_path: 'applicant_email',
        subject: 'Application Received: {{project_title}}',
        body_template: `Dear {{applicant_name}},

Thank you for submitting your application for {{project_title}}.

We have received your application and it is now under review. Our team will contact you if we need any additional information.

Application Reference: {{application_id}}
Submitted: {{submitted_at}}

You can check your application status at: {{portal_url}}

Thank you for your interest in {{org_name}}.

Best regards,
{{org_name}} Grants Team`,
      },
      {
        type: 'create_work_item',
        title: 'Triage Grant Application: {{project_title}}',
        description: 'Verify completeness, check eligibility, review for COI. Organization: {{organization_name}}. Amount requested: ${{requested_amount_dollars}}.',
        priority: 'medium',
        reference_type: 'grant_application',
        reference_id_path: 'application_id',
        dedupe_key: 'triage-{{application_id}}',
      },
    ],
    is_active: true,
    category: 'grants',
  },
  {
    name: 'Auto-Assign Grant Reviewers',
    description: 'Automatically assign reviewers when application is ready for review.',
    trigger_events: ['grant.application.ready_for_review'],
    actions: [
      {
        type: 'assign_reviewer',
        application_id_path: 'application_id',
        auto_assign: true,
        role: 'reviewer',
      },
      {
        type: 'update_status',
        table: 'grant_applications',
        id_path: 'application_id',
        status_value: 'in_review',
      },
      {
        type: 'send_email',
        to_path: 'reviewer_emails',
        subject: 'Review Assignment: {{project_title}}',
        body_template: `You have been assigned to review a grant application.

Project: {{project_title}}
Organization: {{organization_name}}
Amount Requested: ${{requested_amount_dollars}}

Please complete your review by {{review_deadline}}.

Review Now: {{review_url}}`,
      },
    ],
    is_active: true,
    category: 'grants',
  },
  {
    name: 'Grant Review Complete - Queue for Decision',
    description: 'When all reviews complete, create board docket item.',
    trigger_events: ['grant.review.completed'],
    filters: { all_reviews_complete: true },
    actions: [
      {
        type: 'create_work_item',
        title: 'Decision Needed: {{project_title}}',
        description: 'All reviews completed. Average score: {{average_score}}. Add to board docket for decision. Application: {{application_id}}.',
        priority: 'high',
        reference_type: 'grant_application',
        reference_id_path: 'application_id',
        dedupe_key: 'decision-{{application_id}}',
      },
      {
        type: 'add_tag',
        entity_type: 'grant_applications',
        entity_id_path: 'application_id',
        tag: 'ready_for_docket',
      },
    ],
    is_active: true,
    category: 'grants',
  },
  {
    name: 'Grant Award Notification',
    description: 'Notify grantee, update status, and initiate disbursement workflow.',
    trigger_events: ['grant.awarded'],
    actions: [
      {
        type: 'send_email',
        to_path: 'applicant_email',
        subject: 'Grant Award Notification: {{project_title}}',
        body_template: `Dear {{applicant_name}},

We are pleased to inform you that {{org_name}} has approved a grant award for {{project_title}}.

Award Amount: ${{award_amount_dollars}}
Grant Period: {{grant_start}} - {{grant_end}}

Next Steps:
1. Review and sign the grant agreement (attached)
2. Submit required documentation
3. First disbursement will be processed upon receipt

Please log into your grantee portal for full details: {{grantee_portal_url}}

Congratulations!

{{org_name}} Grants Team`,
      },
      {
        type: 'update_status',
        table: 'grant_applications',
        id_path: 'application_id',
        status_value: 'awarded',
      },
      {
        type: 'create_payment_request',
        amount_cents_path: 'first_disbursement_cents',
        payer_email_path: 'finance_email',
        memo: 'Grant disbursement #1 for {{project_title}}',
        due_days: 14,
      },
    ],
    is_active: true,
    category: 'grants',
  },
  {
    name: 'Grant Decline Notification',
    description: 'Respectfully notify applicants of declined applications.',
    trigger_events: ['grant.declined'],
    actions: [
      {
        type: 'send_email',
        to_path: 'applicant_email',
        subject: 'Application Update: {{project_title}}',
        body_template: `Dear {{applicant_name}},

Thank you for your application to {{org_name}} for {{project_title}}.

After careful review, we regret that we are unable to fund this project at this time. This decision reflects our limited resources and many competing priorities, not a judgment on your organization's important work.

We encourage you to apply for future funding opportunities.

Thank you for your interest in our mission.

Sincerely,
{{org_name}}`,
      },
      {
        type: 'update_status',
        table: 'grant_applications',
        id_path: 'application_id',
        status_value: 'declined',
      },
    ],
    is_active: true,
    category: 'grants',
  },

  // =====================================================
  // EVENT AUTOMATIONS
  // =====================================================
  {
    name: 'Event Registration Confirmation',
    description: 'Send confirmation with event details and calendar invite.',
    trigger_events: ['event.registration.created'],
    actions: [
      {
        type: 'send_email',
        to_path: 'registrant_email',
        subject: 'Confirmed: {{event_title}} on {{event_date}}',
        body_template: `Dear {{registrant_name}},

You're registered for {{event_title}}!

Event Details:
📅 Date: {{event_date}}
🕐 Time: {{event_time}}
📍 Location: {{event_location}}

{{#if is_virtual}}
Join Link: {{virtual_link}}
{{/if}}

Add to Calendar: {{calendar_link}}

We look forward to seeing you!

{{org_name}}`,
      },
    ],
    is_active: true,
    category: 'events',
  },
  {
    name: 'Event Reminder (24 Hours)',
    description: 'Send reminder email 24 hours before event.',
    trigger_events: ['event.reminder.24h'],
    actions: [
      {
        type: 'send_email',
        to_path: 'registrant_email',
        subject: 'Reminder: {{event_title}} is tomorrow!',
        body_template: `Hi {{registrant_name}},

Just a reminder that {{event_title}} is tomorrow!

📅 {{event_date}} at {{event_time}}
📍 {{event_location}}

{{#if is_virtual}}
Join here: {{virtual_link}}
{{/if}}

See you there!
{{org_name}}`,
      },
    ],
    is_active: true,
    category: 'events',
  },

  // =====================================================
  // VOLUNTEER AUTOMATIONS
  // =====================================================
  {
    name: 'Volunteer Signup Confirmation',
    description: 'Confirm volunteer signup with shift details.',
    trigger_events: ['volunteer.signup.created'],
    actions: [
      {
        type: 'send_email',
        to_path: 'volunteer_email',
        subject: 'Volunteer Signup Confirmed: {{opportunity_title}}',
        body_template: `Dear {{volunteer_name}},

Thank you for signing up to volunteer!

Your Assignment:
📋 {{opportunity_title}}
📅 {{shift_date}}
🕐 {{shift_time}}
📍 {{shift_location}}

Contact: {{coordinator_name}} ({{coordinator_email}})

Please arrive 10 minutes early for check-in.

Thank you for your service!
{{org_name}}`,
      },
    ],
    is_active: true,
    category: 'volunteers',
  },
  {
    name: 'Volunteer Hours Milestone',
    description: 'Celebrate volunteer hour milestones (50, 100, 250, 500).',
    trigger_events: ['volunteer.hours.milestone'],
    filters: { milestone: { in: [50, 100, 250, 500] } },
    actions: [
      {
        type: 'send_email',
        to_path: 'volunteer_email',
        subject: '🎉 Congratulations on {{milestone}} volunteer hours!',
        body_template: `Dear {{volunteer_name}},

What an incredible achievement! You've reached {{milestone}} hours of volunteer service with {{org_name}}.

Your dedication makes a real difference in our community. Thank you!

Total Impact:
⏱️ {{total_hours}} hours
📅 Volunteering since {{start_date}}
🏆 Achievement: {{milestone}}-Hour Club

We're so grateful for your commitment.

With appreciation,
{{org_name}}`,
      },
      {
        type: 'add_tag',
        entity_type: 'profiles',
        entity_id_path: 'volunteer_profile_id',
        tag: 'volunteer_{{milestone}}_hours',
      },
    ],
    is_active: true,
    category: 'volunteers',
  },

  // =====================================================
  // COMPLIANCE & BOARD AUTOMATIONS
  // =====================================================
  {
    name: 'Daily Compliance Check',
    description: 'Create tasks for upcoming compliance deadlines.',
    trigger_events: ['compliance.tick.daily'],
    actions: [
      {
        type: 'create_task',
        title: 'Compliance Review: Due Items',
        description: 'Review upcoming compliance deadlines (990-PF, state filings, grant reports) and confirm responsible parties.',
        due_days: 0,
        assignee_role: 'compliance_officer',
      },
    ],
    is_active: true,
    category: 'compliance',
  },
  {
    name: 'Board Meeting Reminder (1 Week)',
    description: 'Send board packet and reminder 1 week before meeting.',
    trigger_events: ['board.meeting.reminder.7d'],
    actions: [
      {
        type: 'send_email',
        to_path: 'board_member_emails',
        subject: 'Board Meeting Reminder: {{meeting_date}}',
        body_template: `Dear Board Members,

This is a reminder that our next board meeting is scheduled for:

📅 {{meeting_date}}
🕐 {{meeting_time}}
📍 {{meeting_location}}

Agenda and Board Packet: {{packet_url}}

Please review the materials before the meeting. RSVP if you haven't already.

Thank you,
{{org_name}}`,
      },
    ],
    is_active: true,
    category: 'board',
  },
]

/**
 * Get recipes by category
 */
export function getRecipesByCategory(category: AutomationRecipe['category']): AutomationRecipe[] {
  return FOUNDATION_RECIPE_PACK_V2.filter(r => r.category === category)
}

/**
 * Get all trigger events used in recipes
 */
export function getAllTriggerEvents(): string[] {
  const events = new Set<string>()
  FOUNDATION_RECIPE_PACK_V2.forEach(r => {
    r.trigger_events.forEach(e => events.add(e))
  })
  return Array.from(events).sort()
}
