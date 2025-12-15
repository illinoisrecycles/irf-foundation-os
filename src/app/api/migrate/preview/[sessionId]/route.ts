import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { requireOrgContext } from '@/lib/auth/org-context'

/**
 * Migration Preview API
 * 
 * Returns the AI mapping results for user review
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
      .select('*')
      .eq('id', params.sessionId)
      .eq('organization_id', ctx.organizationId)
      .single()

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    return NextResponse.json({
      session: {
        id: session.id,
        source_system: session.source_system,
        source_file_name: session.source_file_name,
        detected_row_count: session.detected_row_count,
        detected_columns: session.detected_columns,
        ai_confidence: session.ai_confidence,
        status: session.status,
        current_step: session.current_step,
        progress_percent: session.progress_percent,
        stats: session.stats,
        created_at: session.created_at,
      },
      mapping: session.mapping || {},
      confidenceByField: session.confidence_by_field || {},
      conflicts: session.conflicts || [],
      unmappedFields: session.detected_columns?.filter(
        (col: string) => !session.mapping?.[col] || session.mapping[col] === 'ignore'
      ) || [],
      sampleData: session.parsed_sample?.slice(0, 5) || [],
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
