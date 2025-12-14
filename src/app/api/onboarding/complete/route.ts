import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext } from '@/lib/auth/org-context'

export async function POST(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)

    const body = await req.json()
    const { stepId } = body

    if (!stepId) {
      return NextResponse.json({ error: 'stepId required' }, { status: 400 })
    }

    // Get current settings
    const { data: org } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', ctx.organizationId)
      .single()

    const settings = (org?.settings as Record<string, any>) || {}
    const onboarding = settings.onboarding || { completed: [], dismissed: false }

    // Add step if not already completed
    if (!onboarding.completed.includes(stepId)) {
      onboarding.completed.push(stepId)
    }

    // Update organization settings
    const { error } = await supabase
      .from('organizations')
      .update({
        settings: { ...settings, onboarding },
        updated_at: new Date().toISOString(),
      })
      .eq('id', ctx.organizationId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, completed: onboarding.completed })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
