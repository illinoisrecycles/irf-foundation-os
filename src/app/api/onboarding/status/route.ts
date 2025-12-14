import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext } from '@/lib/auth/org-context'

export async function GET(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)

    // Get onboarding status from organization settings
    const { data: org } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', ctx.organizationId)
      .single()

    const settings = org?.settings as Record<string, any> || {}
    const onboarding = settings.onboarding || {}

    return NextResponse.json({
      completed: onboarding.completed || [],
      dismissed: onboarding.dismissed || false,
    })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ completed: [], dismissed: false })
  }
}
