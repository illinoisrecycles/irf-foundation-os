import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireOrgContext } from '@/lib/auth/org-context'

// Default templates for new organizations
const DEFAULT_TEMPLATES = [
  {
    slug: 'welcome',
    name: 'Welcome Email',
    description: 'Sent when a new member joins',
    subject: 'Welcome to {{organization_name}}!',
    body_html: `
      <h1>Welcome, {{member_name}}!</h1>
      <p>Thank you for joining {{organization_name}}. We're excited to have you as a member.</p>
      <p>Your membership details:</p>
      <ul>
        <li>Membership Type: {{membership_type}}</li>
        <li>Start Date: {{start_date}}</li>
        <li>Expiration: {{end_date}}</li>
      </ul>
      <p><a href="{{portal_link}}">Access your member portal</a></p>
    `,
    available_variables: [
      { name: 'member_name', description: 'Member\'s full name' },
      { name: 'organization_name', description: 'Your organization name' },
      { name: 'membership_type', description: 'Type of membership' },
      { name: 'start_date', description: 'Membership start date' },
      { name: 'end_date', description: 'Membership expiration date' },
      { name: 'portal_link', description: 'Link to member portal' },
    ],
    is_system: true
  },
  {
    slug: 'renewal_reminder',
    name: 'Renewal Reminder',
    description: 'Sent before membership expires',
    subject: 'Your membership expires soon',
    body_html: `
      <h1>Time to Renew, {{member_name}}</h1>
      <p>Your {{organization_name}} membership will expire on {{end_date}}.</p>
      <p>Renew now to continue enjoying member benefits:</p>
      <p><a href="{{renewal_link}}" style="background: #166534; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Renew Membership</a></p>
    `,
    available_variables: [
      { name: 'member_name', description: 'Member\'s full name' },
      { name: 'organization_name', description: 'Your organization name' },
      { name: 'end_date', description: 'Membership expiration date' },
      { name: 'renewal_link', description: 'Link to renew membership' },
    ],
    is_system: true
  },
  {
    slug: 'event_confirmation',
    name: 'Event Registration Confirmation',
    description: 'Sent after event registration',
    subject: 'You\'re registered for {{event_name}}',
    body_html: `
      <h1>See you there, {{attendee_name}}!</h1>
      <p>You're registered for <strong>{{event_name}}</strong>.</p>
      <p><strong>When:</strong> {{event_date}}<br>
      <strong>Where:</strong> {{event_location}}</p>
      <p><a href="{{calendar_link}}">Add to Calendar</a></p>
    `,
    available_variables: [
      { name: 'attendee_name', description: 'Attendee\'s name' },
      { name: 'event_name', description: 'Name of the event' },
      { name: 'event_date', description: 'Date and time' },
      { name: 'event_location', description: 'Event location' },
      { name: 'calendar_link', description: 'Add to calendar link' },
    ],
    is_system: true
  },
  {
    slug: 'donation_receipt',
    name: 'Donation Receipt',
    description: 'Sent after donation',
    subject: 'Thank you for your donation',
    body_html: `
      <h1>Thank You, {{donor_name}}!</h1>
      <p>We have received your generous donation of <strong>{{amount}}</strong>.</p>
      <p>This letter serves as your tax receipt. {{organization_name}} is a 501(c)(3) organization. Tax ID: {{tax_id}}</p>
      <p>No goods or services were provided in exchange for this contribution.</p>
      <p>Date: {{donation_date}}<br>
      Amount: {{amount}}</p>
    `,
    available_variables: [
      { name: 'donor_name', description: 'Donor\'s name' },
      { name: 'amount', description: 'Donation amount' },
      { name: 'organization_name', description: 'Your organization name' },
      { name: 'tax_id', description: 'Your EIN' },
      { name: 'donation_date', description: 'Date of donation' },
    ],
    is_system: true
  }
]

// GET /api/email-templates
export async function GET(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)

  const { data: templates, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('organization_id', org.id)
    .order('is_system', { ascending: false })
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If no templates, seed defaults
  if (!templates || templates.length === 0) {
    const defaultsWithOrg = DEFAULT_TEMPLATES.map(t => ({
      ...t,
      organization_id: org.id
    }))

    const { data: seeded, error: seedError } = await supabase
      .from('email_templates')
      .insert(defaultsWithOrg)
      .select()

    if (seedError) {
      return NextResponse.json({ error: seedError.message }, { status: 500 })
    }

    return NextResponse.json({ templates: seeded })
  }

  return NextResponse.json({ templates })
}

// POST /api/email-templates - Create template
export async function POST(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const body = await req.json()

  const { name, slug, description, subject, body_html, body_text, available_variables } = body

  if (!name || !slug || !subject || !body_html) {
    return NextResponse.json({ error: 'Name, slug, subject, and body required' }, { status: 400 })
  }

  const { data: template, error } = await supabase
    .from('email_templates')
    .insert({
      organization_id: org.id,
      name,
      slug,
      description,
      subject,
      body_html,
      body_text,
      available_variables: available_variables || [],
      is_system: false
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ template })
}

// PATCH /api/email-templates - Update template
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const body = await req.json()
  const { id, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: 'Template ID required' }, { status: 400 })
  }

  const { data: template, error } = await supabase
    .from('email_templates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', org.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ template })
}

// DELETE /api/email-templates - Delete custom template
export async function DELETE(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Template ID required' }, { status: 400 })
  }

  // Can't delete system templates
  const { error } = await supabase
    .from('email_templates')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)
    .eq('is_system', false)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
