import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================================
// APPROVALS API
// Multi-step approval workflow management
// ============================================================================

export async function GET(req: Request) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  
  const orgId = searchParams.get('organization_id')
  const status = searchParams.get('status') || 'pending'
  const type = searchParams.get('type')
  const myApprovals = searchParams.get('my_approvals') === 'true'
  const profileId = searchParams.get('profile_id')

  if (!orgId) {
    return NextResponse.json({ error: 'organization_id required' }, { status: 400 })
  }

  let query = supabase
    .from('approval_requests')
    .select(`
      *,
      approval_steps (
        id, step_order, step_name, role_required, profile_id, status, decided_at, decided_by, decision_note
      ),
      created_by_profile:profiles!approval_requests_created_by_fkey (
        id, full_name, email
      )
    `)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  if (type) {
    query = query.eq('approval_type', type)
  }

  // Filter to approvals where user is an approver on a pending step
  if (myApprovals && profileId) {
    const { data: mySteps } = await supabase
      .from('approval_steps')
      .select('approval_request_id')
      .eq('profile_id', profileId)
      .eq('status', 'pending')

    const requestIds = mySteps?.map(s => s.approval_request_id) || []
    
    if (requestIds.length > 0) {
      query = query.in('id', requestIds)
    } else {
      return NextResponse.json({ approvals: [] })
    }
  }

  const { data, error } = await query.limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ approvals: data })
}

export async function POST(req: Request) {
  const supabase = createAdminClient()
  const body = await req.json()

  const {
    organization_id,
    created_by,
    approval_type,
    entity_table,
    entity_id,
    amount_cents,
    currency = 'usd',
    title,
    description,
    urgency = 'normal',
    due_date,
    steps = [],
    metadata = {},
  } = body

  if (!organization_id || !approval_type || !entity_table || !entity_id || !title) {
    return NextResponse.json({ 
      error: 'organization_id, approval_type, entity_table, entity_id, and title required' 
    }, { status: 400 })
  }

  // Check for applicable policy
  let policySteps = steps
  if (steps.length === 0) {
    const { data: policy } = await supabase
      .from('approval_policies')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('approval_type', approval_type)
      .eq('is_active', true)
      .single()

    if (policy) {
      // Check if auto-approve applies
      if (policy.auto_approve_below_cents && amount_cents && amount_cents < policy.auto_approve_below_cents) {
        // Auto-approve small amounts
        const { data: autoApproved, error } = await supabase
          .from('approval_requests')
          .insert({
            organization_id,
            created_by,
            approval_type,
            entity_table,
            entity_id,
            amount_cents,
            currency,
            title,
            description,
            status: 'approved',
            completed_at: new Date().toISOString(),
            policy_snapshot: policy,
            metadata: { ...metadata, auto_approved: true },
          })
          .select()
          .single()

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ approval: autoApproved, auto_approved: true })
      }

      policySteps = policy.steps || []
    }
  }

  // Create the approval request
  const { data: request, error: reqError } = await supabase
    .from('approval_requests')
    .insert({
      organization_id,
      created_by,
      approval_type,
      entity_table,
      entity_id,
      amount_cents,
      currency,
      title,
      description,
      urgency,
      due_date,
      policy_snapshot: {},
      metadata,
    })
    .select()
    .single()

  if (reqError) {
    return NextResponse.json({ error: reqError.message }, { status: 500 })
  }

  // Create approval steps
  if (policySteps.length > 0) {
    const stepsToInsert = policySteps.map((step: any, idx: number) => ({
      organization_id,
      approval_request_id: request.id,
      step_order: step.step_order || idx + 1,
      step_name: step.step_name,
      role_required: step.role_required,
      profile_id: step.profile_id,
    }))

    const { error: stepsError } = await supabase
      .from('approval_steps')
      .insert(stepsToInsert)

    if (stepsError) {
      return NextResponse.json({ error: stepsError.message }, { status: 500 })
    }
  }

  // Create work item for first approver
  await supabase.from('work_items').insert({
    organization_id,
    item_type: 'approval',
    title: `Approval needed: ${title}`,
    description: description,
    reference_type: 'approval_request',
    reference_id: request.id,
    priority: urgency === 'critical' ? 'urgent' : urgency === 'high' ? 'high' : 'medium',
    due_date,
  })

  return NextResponse.json({ approval: request })
}
