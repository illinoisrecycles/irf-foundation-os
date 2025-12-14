import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================================
// PRE-BUILT AUTOMATION RECIPES - 1-Click Setup
// This is what makes us better than Salesforce (which needs expensive consultants)
// ============================================================================

export type Recipe = {
  id: string
  name: string
  description: string
  category: 'retention' | 'fundraising' | 'engagement' | 'operations' | 'onboarding'
  icon: string
  trigger_type: string
  trigger_conditions: Record<string, any>
  actions: any[]
  tags: string[]
}

export const AUTOMATION_RECIPES: Recipe[] = [
  // ============================================================================
  // FUNDRAISING RECIPES
  // ============================================================================
  {
    id: 'major-donor-steward',
    name: 'Major Donor Stewardship',
    description: 'Instant executive notification + personal thank you for gifts over $1,000',
    category: 'fundraising',
    icon: '💎',
    trigger_type: 'donation.created',
    trigger_conditions: { amount_cents: { gte: 100000 } }, // $1,000+
    actions: [
      {
        type: 'slack_notify',
        config: {
          message: '🚨 Major Donor Alert! {{donor_name}} just gave \${{amount_cents/100}}. Call within 15 minutes to triple retention rates!',
        },
      },
      {
        type: 'create_work_item',
        config: {
          title: '📞 Call {{donor_name}} - Major Gift Thank You',
          description: 'New major donor! Amount: \${{amount_cents/100}}. Personal call recommended within 24 hours.',
          priority: 'urgent',
          due_days: 1,
        },
      },
      {
        type: 'ai_email_draft',
        config: {
          context_template: 'First-time major donor {{donor_name}} gave \${{amount_cents/100}}. Draft a warm, personal thank you emphasizing impact.',
          tone: 'warm',
          approval_required: true,
        },
      },
      {
        type: 'add_tag',
        config: { tag: 'major-donor' },
      },
    ],
    tags: ['high-impact', 'donor-retention'],
  },

  {
    id: 'first-time-donor',
    name: 'First-Time Donor Welcome',
    description: 'Welcome series for new donors with impact story',
    category: 'fundraising',
    icon: '🎉',
    trigger_type: 'donation.created',
    trigger_conditions: { is_first_donation: true },
    actions: [
      {
        type: 'send_email',
        config: {
          to_field: 'donor_email',
          subject: 'Thank you for your first gift, {{donor_name}}!',
          body: `Dear {{donor_name}},

Thank you for your generous gift of \${{amount_formatted}}! As a first-time donor, you've just joined our community of changemakers.

Your support directly impacts [describe impact]. We're excited to have you with us!

With gratitude,
The Team`,
        },
      },
      {
        type: 'update_engagement',
        config: { points: 50, activity_type: 'first_donation' },
      },
      {
        type: 'add_tag',
        config: { tag: 'new-donor-2024' },
      },
    ],
    tags: ['donor-acquisition'],
  },

  {
    id: 'recurring-donor-upgrade',
    name: 'Monthly Donor Anniversary',
    description: 'Celebrate and thank recurring donors on their anniversary',
    category: 'fundraising',
    icon: '🔄',
    trigger_type: 'donation.recurring_anniversary',
    trigger_conditions: {},
    actions: [
      {
        type: 'ai_email_draft',
        config: {
          context_template: '{{donor_name}} has been a monthly donor for {{months_active}} months, giving \${{total_given}} total. Draft a heartfelt anniversary thank you.',
          tone: 'warm',
          approval_required: true,
        },
      },
      {
        type: 'create_work_item',
        config: {
          title: 'Send thank you card to {{donor_name}}',
          description: 'Monthly donor anniversary - consider handwritten note',
          priority: 'medium',
        },
      },
    ],
    tags: ['donor-retention'],
  },

  // ============================================================================
  // RETENTION RECIPES
  // ============================================================================
  {
    id: 'churn-prevention-intercept',
    name: 'Churn Prevention Intercept',
    description: 'AI-powered early warning when engagement drops - intervene before they leave',
    category: 'retention',
    icon: '🚨',
    trigger_type: 'member.score_dropped',
    trigger_conditions: { new_score: { lt: 40 } },
    actions: [
      {
        type: 'create_work_item',
        config: {
          title: '⚠️ At-Risk: {{name}} - Engagement dropped to {{new_score}}',
          description: 'Member engagement score dropped from {{old_score}} to {{new_score}}. Review their activity and reach out personally.',
          priority: 'high',
          due_days: 3,
        },
      },
      {
        type: 'ai_email_draft',
        config: {
          context_template: 'Member {{name}} engagement dropped significantly. Find a relevant resource or upcoming event to re-engage them.',
          tone: 'friendly',
          approval_required: true,
        },
      },
      {
        type: 'add_tag',
        config: { tag: 'at-risk' },
      },
    ],
    tags: ['high-impact', 'retention'],
  },

  {
    id: 'renewal-reminder-sequence',
    name: 'Renewal Reminder Sequence',
    description: 'Automated 60/30/7 day renewal reminders',
    category: 'retention',
    icon: '📅',
    trigger_type: 'member.expiring_soon',
    trigger_conditions: { days_until_expiry: 60 },
    actions: [
      {
        type: 'send_email',
        config: {
          to_field: 'email',
          subject: '{{name}}, your membership renews in 60 days',
          body: `Hi {{name}},

Just a friendly reminder that your membership will expire on {{expires_at}}.

Renew now to keep your benefits:
- Member directory listing
- Event discounts
- Resource library access

[Renew Now Button]

Questions? Reply to this email!`,
        },
      },
      {
        type: 'create_work_item',
        config: {
          title: 'Follow up: {{name}} renewal in 60 days',
          description: 'Sent 60-day reminder. Follow up if no response.',
          priority: 'low',
          due_days: 30,
        },
      },
    ],
    tags: ['retention'],
  },

  {
    id: 'lapsed-member-winback',
    name: 'Lapsed Member Win-Back',
    description: 'Re-engage members who expired with personalized outreach',
    category: 'retention',
    icon: '🔙',
    trigger_type: 'member.expired',
    trigger_conditions: {},
    actions: [
      {
        type: 'delay',
        config: { minutes: 1440 }, // Wait 24 hours
      },
      {
        type: 'ai_email_draft',
        config: {
          context_template: '{{name}} membership just expired. Draft a personalized win-back email mentioning what they might be missing.',
          tone: 'friendly',
          approval_required: true,
        },
      },
      {
        type: 'add_tag',
        config: { tag: 'lapsed' },
      },
      {
        type: 'create_work_item',
        config: {
          title: 'Win-back call: {{name}}',
          description: 'Membership expired. Personal call recommended within 7 days.',
          priority: 'medium',
          due_days: 7,
        },
      },
    ],
    tags: ['retention', 'win-back'],
  },

  // ============================================================================
  // ENGAGEMENT RECIPES
  // ============================================================================
  {
    id: 'ghost-board-member',
    name: 'Ghost Board Member Alert',
    description: 'Alert when board members miss meetings',
    category: 'engagement',
    icon: '👻',
    trigger_type: 'event.board_member_absent',
    trigger_conditions: {},
    actions: [
      {
        type: 'delay',
        config: { minutes: 1440 }, // 24 hours
      },
      {
        type: 'send_email',
        config: {
          to_field: 'email',
          subject: 'We missed you at the Board Meeting',
          body: `Hi {{name}},

We noticed you weren't able to attend yesterday's Board Meeting. Here's what you missed:

- Meeting recording: [link]
- Minutes: [link]
- Action items: [summary]

Let us know if you have any questions!`,
        },
      },
      {
        type: 'create_work_item',
        config: {
          title: 'Check in with {{name}} - missed board meeting',
          description: 'Board member missed meeting. Personal check-in recommended.',
          priority: 'medium',
        },
      },
    ],
    tags: ['governance'],
  },

  {
    id: 'event-followup',
    name: 'Post-Event Follow-Up',
    description: 'Automatic thank you and survey after event attendance',
    category: 'engagement',
    icon: '📧',
    trigger_type: 'event.attended',
    trigger_conditions: {},
    actions: [
      {
        type: 'delay',
        config: { minutes: 60 }, // 1 hour after event ends
      },
      {
        type: 'send_email',
        config: {
          to_field: 'attendee_email',
          subject: 'Thanks for attending {{event_title}}!',
          body: `Hi {{attendee_name}},

Thank you for joining us at {{event_title}}! We hope you found it valuable.

We'd love your feedback: [Survey Link]

Resources from the event: [Link]

See you at the next one!`,
        },
      },
      {
        type: 'update_engagement',
        config: { points: 20, activity_type: 'event_attended' },
      },
    ],
    tags: ['events'],
  },

  // ============================================================================
  // ONBOARDING RECIPES
  // ============================================================================
  {
    id: 'new-member-onboarding',
    name: 'New Member Onboarding Series',
    description: 'Welcome sequence: Day 1, 3, 7 emails + profile completion task',
    category: 'onboarding',
    icon: '👋',
    trigger_type: 'member.created',
    trigger_conditions: {},
    actions: [
      {
        type: 'send_email',
        config: {
          to_field: 'email',
          subject: 'Welcome to the community, {{name}}!',
          body: `Welcome {{name}}!

We're thrilled to have you as a member. Here's how to get started:

1. Complete your profile: [Link]
2. Browse the member directory: [Link]
3. Check out upcoming events: [Link]

Questions? Just reply to this email!`,
        },
      },
      {
        type: 'create_work_item',
        config: {
          title: 'Welcome call: {{name}} (new member)',
          description: 'New member joined. Personal welcome call recommended.',
          priority: 'medium',
          due_days: 7,
        },
      },
      {
        type: 'update_engagement',
        config: { points: 10, activity_type: 'joined' },
      },
      {
        type: 'add_tag',
        config: { tag: 'new-member-2024' },
      },
    ],
    tags: ['onboarding', 'high-impact'],
  },

  // ============================================================================
  // OPERATIONS RECIPES
  // ============================================================================
  {
    id: 'grant-submitted-workflow',
    name: 'Grant Application Workflow',
    description: 'Auto-assign reviewers and notify applicant when grant submitted',
    category: 'operations',
    icon: '📋',
    trigger_type: 'grant.application.submitted',
    trigger_conditions: {},
    actions: [
      {
        type: 'send_email',
        config: {
          to_field: 'applicant_email',
          subject: 'Grant Application Received: {{project_title}}',
          body: `Dear {{applicant_name}},

We've received your grant application for "{{project_title}}" requesting \${{requested_amount}}.

Your application ID is: {{application_id}}

Timeline:
- Review period: 2-4 weeks
- Decision notification: [Date]

We'll be in touch!`,
        },
      },
      {
        type: 'create_work_item',
        config: {
          title: 'Assign reviewers: {{project_title}}',
          description: 'New grant application received. Assign 2-3 reviewers.',
          priority: 'high',
          due_days: 3,
        },
      },
    ],
    tags: ['grants'],
  },

  {
    id: 'payment-failed-recovery',
    name: 'Payment Failed Recovery',
    description: 'Automatic retry notification and staff alert on failed payments',
    category: 'operations',
    icon: '💳',
    trigger_type: 'payment.failed',
    trigger_conditions: {},
    actions: [
      {
        type: 'send_email',
        config: {
          to_field: 'email',
          subject: 'Action needed: Payment issue with your membership',
          body: `Hi {{name}},

We had trouble processing your payment of \${{amount}}.

This is often due to an expired card or temporary hold. Please update your payment method:

[Update Payment Method]

If you have questions, we're here to help!`,
        },
      },
      {
        type: 'create_work_item',
        config: {
          title: '💳 Payment failed: {{name}}',
          description: 'Payment of \${{amount}} failed. Follow up if not resolved in 3 days.',
          priority: 'high',
          due_days: 3,
        },
      },
    ],
    tags: ['billing'],
  },
]

// ============================================================================
// RECIPE INSTALLER
// ============================================================================
export async function installRecipe(orgId: string, recipeId: string): Promise<{ success: boolean; ruleId?: string; error?: string }> {
  const recipe = AUTOMATION_RECIPES.find(r => r.id === recipeId)
  if (!recipe) {
    return { success: false, error: 'Recipe not found' }
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('automation_rules')
    .insert({
      organization_id: orgId,
      name: recipe.name,
      description: recipe.description,
      trigger_type: recipe.trigger_type,
      trigger_conditions: recipe.trigger_conditions,
      actions: recipe.actions,
      is_active: false, // Start inactive so they can review
      metadata: { recipe_id: recipeId, icon: recipe.icon },
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, ruleId: data.id }
}

export async function installAllRecipes(orgId: string, category?: string): Promise<{ installed: number; errors: string[] }> {
  const recipes = category
    ? AUTOMATION_RECIPES.filter(r => r.category === category)
    : AUTOMATION_RECIPES

  let installed = 0
  const errors: string[] = []

  for (const recipe of recipes) {
    const result = await installRecipe(orgId, recipe.id)
    if (result.success) {
      installed++
    } else {
      errors.push(`${recipe.name}: ${result.error}`)
    }
  }

  return { installed, errors }
}

export function getRecipesByCategory() {
  const categories: Record<string, Recipe[]> = {}
  for (const recipe of AUTOMATION_RECIPES) {
    if (!categories[recipe.category]) {
      categories[recipe.category] = []
    }
    categories[recipe.category].push(recipe)
  }
  return categories
}
