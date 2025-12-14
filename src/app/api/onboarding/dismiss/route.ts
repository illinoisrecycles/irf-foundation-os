import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext } from '@/lib/auth/org-context'

export async function POST(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)

    // Get current settings
    const { data: org } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', ctx.organizationId)
      .single()

    const settings = (org?.settings as Record<string, any>) || {}
    const onboarding = settings.onboarding || { completed: [], dismissed: false }
    onboarding.dismissed = true

    // Update organization settings
    const { error } = await supabase
      .from('organizations')
      .update({
        settings: { ...settings, onboarding },
        updated_at: new Date().toISOString(),
      })
      .eq('id', ctx.organizationId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
