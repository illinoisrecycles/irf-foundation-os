import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================================
// APPROVAL ACTIONS API
// Approve, reject, or take action on specific approval requests
// ============================================================================

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('approval_requests')
    .select(`
      *,
      approval_steps (
        id, step_order, step_name, role_required, profile_id, status, 
        decided_at, decided_by, decision_note,
        decider:profiles!approval_steps_decided_by_fkey (id, full_name, email)
      ),
      creator:profiles!approval_requests_created_by_fkey (id, full_name, email)
    `)
    .eq('id', params.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json({ approval: data })
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient()
  const body = await req.json()

  const { action, profile_id, note, step_id } = body

  if (!action || !profile_id) {
    return NextResponse.json({ error: 'action and profile_id required' }, { status: 400 })
  }

  // Get the approval request with its steps
  const { data: request, error: fetchError } = await supabase
    .from('approval_requests')
    .select(`
      *,
      approval_steps (*)
    `)
    .eq('id', params.id)
    .single()

  if (fetchError || !request) {
    return NextResponse.json({ error: 'Approval request not found' }, { status: 404 })
  }

  if (request.status !== 'pending') {
    return NextResponse.json({ error: 'Approval request is not pending' }, { status: 400 })
  }

  const steps = request.approval_steps || []
  const sortedSteps = steps.sort((a: any, b: any) => a.step_order - b.step_order)

  // Find the current pending step
  const currentStep = step_id 
    ? sortedSteps.find((s: any) => s.id === step_id && s.status === 'pending')
    : sortedSteps.find((s: any) => s.status === 'pending')

  if (!currentStep) {
    return NextResponse.json({ error: 'No pending step found' }, { status: 400 })
  }

  // Check if user can approve this step
  const canApprove = 
    currentStep.profile_id === profile_id || 
    !currentStep.profile_id // If no specific approver, anyone with the role can approve

  // Check for delegates
  if (!canApprove && currentStep.profile_id) {
    const { data: delegate } = await supabase
      .from('approval_delegates')
      .select('*')
      .eq('delegator_id', currentStep.profile_id)
      .eq('delegate_id', profile_id)
      .eq('is_active', true)
      .lte('start_date', new Date().toISOString().split('T')[0])
      .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split('T')[0]}`)
      .single()

    if (!delegate) {
      return NextResponse.json({ error: 'Not authorized to approve this step' }, { status: 403 })
    }
  }

  // Check segregation of duties (preparer cannot be approver)
  if (request.created_by === profile_id) {
    // Check if policy allows self-approval
    const policy = request.policy_snapshot as any
    if (policy?.require_segregation !== false) {
      return NextResponse.json({ 
        error: 'Segregation of duties: preparer cannot approve their own request' 
      }, { status: 403 })
    }
  }

  if (action === 'approve') {
    // Update the current step
    await supabase
      .from('approval_steps')
      .update({
        status: 'approved',
        decided_at: new Date().toISOString(),
        decided_by: profile_id,
        decision_note: note,
      })
      .eq('id', currentStep.id)

    // Check if this was the last step
    const remainingSteps = sortedSteps.filter(
      (s: any) => s.step_order > currentStep.step_order && s.status === 'pending'
    )

    if (remainingSteps.length === 0) {
      // All steps approved - complete the request
      await supabase
        .from('approval_requests')
        .update({
          status: 'approved',
          completed_at: new Date().toISOString(),
          completed_by: profile_id,
        })
        .eq('id', params.id)

      // Trigger automation for approved request
      await supabase.from('automation_queue').insert({
        organization_id: request.organization_id,
        event_type: `approval.${request.approval_type}.approved`,
        payload: {
          approval_request_id: request.id,
          entity_table: request.entity_table,
          entity_id: request.entity_id,
          amount_cents: request.amount_cents,
        },
      })

      // Complete the work item
      await supabase
        .from('work_items')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('reference_type', 'approval_request')
        .eq('reference_id', params.id)

      return NextResponse.json({ 
        success: true, 
        message: 'Approval request fully approved',
        status: 'approved'
      })
    } else {
      // Move to next step - create work item for next approver
      const nextStep = remainingSteps[0]
      
      await supabase.from('work_items').insert({
        organization_id: request.organization_id,
        item_type: 'approval',
        title: `Approval needed (Step ${nextStep.step_order}): ${request.title}`,
        reference_type: 'approval_request',
        reference_id: request.id,
        assigned_to: nextStep.profile_id,
        priority: request.urgency === 'critical' ? 'urgent' : 'medium',
      })

      return NextResponse.json({ 
        success: true, 
        message: `Step ${currentStep.step_order} approved, moved to step ${nextStep.step_order}`,
        status: 'pending',
        next_step: nextStep.step_order
      })
    }

  } else if (action === 'reject') {
    // Reject the step and the entire request
    await supabase
      .from('approval_steps')
      .update({
        status: 'rejected',
        decided_at: new Date().toISOString(),
        decided_by: profile_id,
        decision_note: note,
      })
      .eq('id', currentStep.id)

    await supabase
      .from('approval_requests')
      .update({
        status: 'rejected',
        completed_at: new Date().toISOString(),
        completed_by: profile_id,
      })
      .eq('id', params.id)

    // Trigger automation for rejected request
    await supabase.from('automation_queue').insert({
      organization_id: request.organization_id,
      event_type: `approval.${request.approval_type}.rejected`,
      payload: {
        approval_request_id: request.id,
        entity_table: request.entity_table,
        entity_id: request.entity_id,
        rejection_note: note,
      },
    })

    // Complete the work item
    await supabase
      .from('work_items')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('reference_type', 'approval_request')
      .eq('reference_id', params.id)

    return NextResponse.json({ 
      success: true, 
      message: 'Approval request rejected',
      status: 'rejected'
    })

  } else if (action === 'cancel') {
    await supabase
      .from('approval_requests')
      .update({
        status: 'canceled',
        completed_at: new Date().toISOString(),
      })
      .eq('id', params.id)

    return NextResponse.json({ success: true, status: 'canceled' })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient()

  // Can only delete pending requests
  const { error } = await supabase
    .from('approval_requests')
    .delete()
    .eq('id', params.id)
    .eq('status', 'pending')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
