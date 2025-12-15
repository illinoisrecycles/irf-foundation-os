import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { requireOrgContext } from '@/lib/auth/org-context'

/**
 * Migration Status API
 * 
 * Returns current processing status for polling
 */

export async function GET(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {}
          },
        },
      }
    )

    const ctx = await requireOrgContext(supabase, req)

    const { data: session, error } = await supabase
      .from('data_migrations')
      .select('id, status, current_step, progress_percent, error_log, stats')
      .eq('id', params.sessionId)
      .eq('organization_id', ctx.organizationId)
      .single()

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: session.id,
      status: session.status,
      current_step: session.current_step,
      progress_percent: session.progress_percent,
      error: session.error_log,
      stats: session.stats,
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
