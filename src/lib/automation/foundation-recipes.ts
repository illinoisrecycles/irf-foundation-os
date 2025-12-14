import { createAdminClient } from '@/lib/supabase/admin'
import { executeActions } from './enhanced-runner'

// ============================================================================
// RETENTION AUTOMATIONS
// The "Churn Killer" - detect and re-engage at-risk members
// ============================================================================

export async function detectAtRiskMembers(orgId: string): Promise<{
  flagged: number
  errors: string[]
}> {
  const supabase = createAdminClient()
  const errors: string[] = []
  let flagged = 0

  // Find inactive members (no activity for 90 days)
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const { data: atRiskMembers } = await supabase
    .from('member_organizations')
    .select('id, name, primary_contact_email, membership_status, last_activity_at')
    .eq('organization_id', orgId)
    .eq('membership_status', 'active')
    .or(`last_activity_at.lt.${ninetyDaysAgo.toISOString()},last_activity_at.is.null`)
    .is('risk_flag', null)
    .limit(100)

  if (!atRiskMembers?.length) {
    return { flagged: 0, errors: [] }
  }

  for (const member of atRiskMembers) {
    try {
      // Flag the member
      await supabase
        .from('member_organizations')
        .update({ 
          risk_flag: 'high',
          risk_flagged_at: new Date().toISOString()
        })
        .eq('id', member.id)

      // Queue re-engagement email
      if (member.primary_contact_email) {
        await supabase.from('email_outbox').insert({
          organization_id: orgId,
          to_email: member.primary_contact_email,
          subject: "We miss you! Here's what you've been missing...",
          template_type: 'member_reengagement',
          merge_data: {
            member_name: member.name,
            member_id: member.id,
          },
          status: 'pending',
        })
      }

      // Create task for membership director
      await supabase.from('work_items').insert({
        organization_id: orgId,
        item_type: 'retention',
        title: `Call ${member.name} (At Risk)`,
        description: `Member has been inactive for 90+ days. Personal outreach recommended.`,
        priority: 'high',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: { member_id: member.id },
      })

      // Queue automation event
      await supabase.from('automation_queue').insert({
        organization_id: orgId,
        event_type: 'member.at_risk',
        payload: { 
          member_id: member.id,
          member_name: member.name,
          email: member.primary_contact_email,
        },
      })

      flagged++
    } catch (err: any) {
      errors.push(`Member ${member.id}: ${err.message}`)
    }
  }

  return { flagged, errors }
}

// ============================================================================
// FUNDRAISING AUTOMATIONS  
// The "Donor Elevator" - auto-upgrade donor tiers based on giving
// ============================================================================

export async function checkDonorTier(
  orgId: string,
  donation: {
    id: string
    donor_member_id: string
    amount_cents: number
    donor_email?: string
  }
): Promise<{
  previous_tier: string | null
  new_tier: string | null
  upgraded: boolean
  ltv: number
}> {
  const supabase = createAdminClient()

  // Get member and calculate LTV
  const { data: member } = await supabase
    .from('member_organizations')
    .select('id, name, donor_tier, lifetime_value_cents, primary_contact_email')
    .eq('id', donation.donor_member_id)
    .single()

  if (!member) {
    return { previous_tier: null, new_tier: null, upgraded: false, ltv: 0 }
  }

  // Calculate total lifetime value
  const { data: donations } = await supabase
    .from('donations')
    .select('amount_cents')
    .eq('donor_member_id', donation.donor_member_id)

  const ltv = donations?.reduce((sum, d) => sum + (d.amount_cents || 0), 0) || 0

  // Determine new tier
  let newTier: string | null = null
  if (ltv >= 500000) newTier = 'platinum'      // $5,000+
  else if (ltv >= 100000) newTier = 'gold'     // $1,000+
  else if (ltv >= 50000) newTier = 'silver'    // $500+
  else if (ltv >= 10000) newTier = 'bronze'    // $100+

  const previousTier = member.donor_tier
  const upgraded = newTier && newTier !== previousTier

  if (upgraded) {
    // Update member
    await supabase
      .from('member_organizations')
      .update({ 
        donor_tier: newTier,
        lifetime_value_cents: ltv
      })
      .eq('id', member.id)

    // Send upgrade celebration email
    const tierNames: Record<string, string> = {
      bronze: 'Bronze',
      silver: 'Silver', 
      gold: 'Gold Circle',
      platinum: 'Platinum Partner'
    }

    if (member.primary_contact_email) {
      await supabase.from('email_outbox').insert({
        organization_id: orgId,
        to_email: member.primary_contact_email,
        subject: `Welcome to the ${tierNames[newTier!]} giving level!`,
        template_type: 'donor_tier_upgrade',
        merge_data: {
          member_name: member.name,
          new_tier: newTier,
          tier_name: tierNames[newTier!],
          ltv_formatted: `$${(ltv / 100).toFixed(2)}`,
        },
        status: 'pending',
      })
    }

    // Queue automation event
    await supabase.from('automation_queue').insert({
      organization_id: orgId,
      event_type: 'donor.upgraded',
      payload: {
        member_id: member.id,
        previous_tier: previousTier,
        new_tier: newTier,
        ltv,
      },
    })
  } else {
    // Just update LTV
    await supabase
      .from('member_organizations')
      .update({ lifetime_value_cents: ltv })
      .eq('id', member.id)
  }

  return { previous_tier: previousTier, new_tier: newTier, upgraded: !!upgraded, ltv }
}

// ============================================================================
// OPERATIONS AUTOMATIONS
// The "Smart Router" - auto-assign chapters based on location
// ============================================================================

export async function assignChapterByLocation(
  orgId: string,
  memberId: string,
  state?: string,
  zipCode?: string
): Promise<{
  chapter_id: string | null
  chapter_name: string | null
  notified_president: boolean
}> {
  const supabase = createAdminClient()

  // Get chapters for this org
  const { data: chapters } = await supabase
    .from('chapters')
    .select('id, name, states, zip_prefixes, president_id')
    .eq('organization_id', orgId)
    .eq('is_active', true)

  if (!chapters?.length) {
    return { chapter_id: null, chapter_name: null, notified_president: false }
  }

  // Find matching chapter
  let matchedChapter = null

  for (const chapter of chapters) {
    // Check state match
    if (state && chapter.states?.includes(state)) {
      matchedChapter = chapter
      break
    }

    // Check zip prefix match
    if (zipCode && chapter.zip_prefixes) {
      for (const prefix of chapter.zip_prefixes) {
        if (zipCode.startsWith(prefix)) {
          matchedChapter = chapter
          break
        }
      }
      if (matchedChapter) break
    }
  }

  // Default to first chapter if no match
  if (!matchedChapter) {
    matchedChapter = chapters.find(c => c.name?.toLowerCase().includes('national')) || chapters[0]
  }

  // Assign member to chapter
  await supabase
    .from('member_organizations')
    .update({ chapter_id: matchedChapter.id })
    .eq('id', memberId)

  // Increment chapter member count
  await supabase.rpc('increment_chapter_member_count', { chapter_id: matchedChapter.id })

  // Notify chapter president
  let notifiedPresident = false
  if (matchedChapter.president_id) {
    const { data: president } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', matchedChapter.president_id)
      .single()

    const { data: member } = await supabase
      .from('member_organizations')
      .select('name, primary_contact_email')
      .eq('id', memberId)
      .single()

    if (president?.email && member) {
      await supabase.from('email_outbox').insert({
        organization_id: orgId,
        to_email: president.email,
        subject: `New member in ${matchedChapter.name}`,
        body_html: `
          <p>Hi ${president.full_name},</p>
          <p>A new member has been assigned to your chapter:</p>
          <ul>
            <li><strong>Organization:</strong> ${member.name}</li>
            <li><strong>Contact:</strong> ${member.primary_contact_email}</li>
          </ul>
          <p>Please welcome them to the chapter!</p>
        `,
        status: 'pending',
      })
      notifiedPresident = true
    }
  }

  return { 
    chapter_id: matchedChapter.id, 
    chapter_name: matchedChapter.name,
    notified_president: notifiedPresident
  }
}

// ============================================================================
// FINANCE AUTOMATIONS
// Year-end tax receipt generation
// ============================================================================

export async function generateYearEndReceipts(
  orgId: string,
  year: number
): Promise<{
  generated: number
  emailed: number
  errors: string[]
}> {
  const supabase = createAdminClient()
  const errors: string[] = []
  let generated = 0
  let emailed = 0

  const startOfYear = `${year}-01-01T00:00:00Z`
  const endOfYear = `${year}-12-31T23:59:59Z`

  // Get all donors for the year
  const { data: donations } = await supabase
    .from('donations')
    .select(`
      id, amount_cents, created_at, purpose,
      donor:member_organizations!donor_member_id (
        id, name, primary_contact_email, address_line_1, address_city, address_state, address_zip
      )
    `)
    .eq('organization_id', orgId)
    .gte('created_at', startOfYear)
    .lte('created_at', endOfYear)

  if (!donations?.length) {
    return { generated: 0, emailed: 0, errors: [] }
  }

  // Group by donor
  const donorTotals = new Map<string, {
    donor: any
    donations: any[]
    total_cents: number
  }>()

  for (const donation of donations) {
    const donor = donation.donor as any
    if (!donor?.id) continue

    const existing = donorTotals.get(donor.id)
    if (existing) {
      existing.donations.push(donation)
      existing.total_cents += donation.amount_cents
    } else {
      donorTotals.set(donor.id, {
        donor,
        donations: [donation],
        total_cents: donation.amount_cents,
      })
    }
  }

  // Generate receipt for each donor
  for (const [donorId, data] of donorTotals) {
    if (data.total_cents <= 0) continue

    try {
      // Create document record
      const { data: doc } = await supabase
        .from('generated_documents')
        .insert({
          organization_id: orgId,
          document_type: 'tax_receipt',
          entity_table: 'member_organizations',
          entity_id: donorId,
          title: `${year} Tax Receipt - ${data.donor.name}`,
          merge_data: {
            year,
            donor_name: data.donor.name,
            donor_address: [
              data.donor.address_line_1,
              `${data.donor.address_city}, ${data.donor.address_state} ${data.donor.address_zip}`
            ].filter(Boolean).join('\n'),
            total_amount: `$${(data.total_cents / 100).toFixed(2)}`,
            donations: data.donations.map(d => ({
              date: new Date(d.created_at).toLocaleDateString(),
              amount: `$${(d.amount_cents / 100).toFixed(2)}`,
              purpose: d.purpose || 'General Support',
            })),
          },
        })
        .select()
        .single()

      generated++

      // Queue email with receipt
      if (data.donor.primary_contact_email && doc) {
        await supabase.from('email_outbox').insert({
          organization_id: orgId,
          to_email: data.donor.primary_contact_email,
          subject: `Your ${year} Donation Receipt`,
          template_type: 'tax_receipt',
          merge_data: {
            donor_name: data.donor.name,
            year,
            total_amount: `$${(data.total_cents / 100).toFixed(2)}`,
            document_id: doc.id,
          },
          status: 'pending',
        })
        emailed++
      }

    } catch (err: any) {
      errors.push(`Donor ${donorId}: ${err.message}`)
    }
  }

  return { generated, emailed, errors }
}

// ============================================================================
// GRANT LIFECYCLE AUTOMATIONS
// ============================================================================

export async function processGrantApplication(
  orgId: string,
  applicationId: string
): Promise<{
  eligible: boolean
  assigned_reviewers: string[]
  work_item_id?: string
}> {
  const supabase = createAdminClient()

  // Get application details
  const { data: application } = await supabase
    .from('grant_applications')
    .select('*, program:grant_programs(*)')
    .eq('id', applicationId)
    .single()

  if (!application) {
    throw new Error('Application not found')
  }

  // Basic eligibility check (could be expanded with rules engine)
  const program = application.program as any
  let eligible = true
  const eligibilityNotes: string[] = []

  // Check requested amount vs program limits
  if (program?.max_amount_cents && application.amount_requested_cents > program.max_amount_cents) {
    eligible = false
    eligibilityNotes.push(`Requested amount exceeds program maximum of $${program.max_amount_cents / 100}`)
  }

  if (!eligible) {
    // Auto-decline ineligible applications
    await supabase
      .from('grant_applications')
      .update({ 
        status: 'declined',
        internal_notes: `Auto-declined: ${eligibilityNotes.join('; ')}`
      })
      .eq('id', applicationId)

    // Queue decline letter
    await supabase.from('automation_queue').insert({
      organization_id: orgId,
      event_type: 'grant.application_declined',
      payload: { application_id: applicationId, reasons: eligibilityNotes },
    })

    return { eligible: false, assigned_reviewers: [] }
  }

  // Assign reviewers
  const { data: reviewers } = await supabase
    .from('grant_reviewers')
    .select('profile_id')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .limit(3)

  const assignedReviewers = reviewers?.map(r => r.profile_id) || []

  for (const profileId of assignedReviewers) {
    await supabase.from('grant_review_assignments').insert({
      organization_id: orgId,
      application_id: applicationId,
      reviewer_id: profileId,
      status: 'assigned',
      assigned_at: new Date().toISOString(),
    })
  }

  // Create triage work item
  const { data: workItem } = await supabase
    .from('work_items')
    .insert({
      organization_id: orgId,
      item_type: 'grant_review',
      title: `Review Grant Application: ${application.applicant_name}`,
      description: `Amount requested: $${(application.amount_requested_cents / 100).toFixed(2)}`,
      reference_type: 'grant_application',
      reference_id: applicationId,
      priority: 'medium',
    })
    .select()
    .single()

  // Update application status
  await supabase
    .from('grant_applications')
    .update({ status: 'under_review' })
    .eq('id', applicationId)

  return { 
    eligible: true, 
    assigned_reviewers: assignedReviewers,
    work_item_id: workItem?.id
  }
}

export async function sendGrantReminders(orgId: string): Promise<{
  reminders_sent: number
  escalations: number
}> {
  const supabase = createAdminClient()
  let remindersSent = 0
  let escalations = 0

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  // Find overdue reviews
  const { data: assignments } = await supabase
    .from('grant_review_assignments')
    .select(`
      *,
      reviewer:profiles!reviewer_id (id, email, full_name),
      application:grant_applications!application_id (id, applicant_name)
    `)
    .eq('organization_id', orgId)
    .eq('status', 'assigned')

  for (const assignment of assignments || []) {
    const assignedAt = new Date(assignment.assigned_at)
    const reviewer = assignment.reviewer as any
    const application = assignment.application as any

    if (assignedAt < fourteenDaysAgo && !assignment.escalated_at) {
      // Escalate
      await supabase.from('work_items').insert({
        organization_id: orgId,
        item_type: 'escalation',
        title: `ESCALATION: Grant review overdue - ${application?.applicant_name}`,
        description: `Review by ${reviewer?.full_name} is 14+ days overdue`,
        priority: 'urgent',
      })

      await supabase
        .from('grant_review_assignments')
        .update({ escalated_at: now.toISOString() })
        .eq('id', assignment.id)

      escalations++

    } else if (assignedAt < sevenDaysAgo && !assignment.reminded_at) {
      // Send reminder
      if (reviewer?.email) {
        await supabase.from('email_outbox').insert({
          organization_id: orgId,
          to_email: reviewer.email,
          subject: `Reminder: Grant review due - ${application?.applicant_name}`,
          template_type: 'grant_review_reminder',
          merge_data: {
            reviewer_name: reviewer.full_name,
            applicant_name: application?.applicant_name,
            assignment_id: assignment.id,
          },
          status: 'pending',
        })
      }

      await supabase
        .from('grant_review_assignments')
        .update({ reminded_at: now.toISOString() })
        .eq('id', assignment.id)

      remindersSent++
    }
  }

  return { reminders_sent: remindersSent, escalations }
}
