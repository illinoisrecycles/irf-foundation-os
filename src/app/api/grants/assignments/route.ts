import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const applicationId = searchParams.get('application_id')
  const reviewerId = searchParams.get('reviewer_id')

  let query = supabase
    .from('grant_review_assignments')
    .select(`
      *,
      application:grant_applications(*),
      reviewer:grant_reviewers(*),
      review:grant_reviews(*)
    `)

  if (applicationId) query = query.eq('grant_application_id', applicationId)
  if (reviewerId) query = query.eq('reviewer_id', reviewerId)

  const { data, error } = await query.order('assigned_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { grant_application_id, reviewer_id, due_date } = body

  if (!grant_application_id || !reviewer_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Check for conflicts
  const { data: conflict } = await supabase.rpc('check_reviewer_conflicts', {
    p_application_id: grant_application_id,
    p_reviewer_id: reviewer_id,
  })

  const hasConflict = conflict?.[0]?.has_conflict || false
  const conflictReason = conflict?.[0]?.reason || null

  const { data, error } = await supabase
    .from('grant_review_assignments')
    .insert({
      grant_application_id,
      reviewer_id,
      due_date,
      has_conflict: hasConflict,
      conflict_reason: conflictReason,
      status: hasConflict ? 'pending' : 'pending', // Could auto-flag for review
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ...data, conflict_detected: hasConflict, conflict_reason: conflictReason })
}
