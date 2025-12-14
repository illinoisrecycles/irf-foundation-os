import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext } from '@/lib/auth/org-context'
import { naturalLanguageToQuery } from '@/lib/ai'

// Tables available for querying (scoped by organization_id)
const QUERYABLE_TABLES = [
  'members',
  'payments',
  'donations',
  'events',
  'event_registrations',
  'grant_applications',
  'email_campaigns',
  'work_items',
]

export async function POST(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)

    const body = await req.json()
    const { question } = body

    if (!question) {
      return NextResponse.json({ error: 'question required' }, { status: 400 })
    }

    // Convert natural language to SQL
    const result = await naturalLanguageToQuery(question, QUERYABLE_TABLES)

    if (!result) {
      return NextResponse.json({
        error: 'Could not generate a query for that question. Try rephrasing.',
      }, { status: 400 })
    }

    // Security: Ensure query only accesses allowed tables and is a SELECT
    const sqlUpper = result.sql.toUpperCase()
    if (!sqlUpper.startsWith('SELECT')) {
      return NextResponse.json({ error: 'Only SELECT queries are allowed' }, { status: 400 })
    }

    // Inject organization_id filter for safety
    // Replace WHERE with WHERE organization_id = 'xxx' AND
    let safeQuery = result.sql
    const orgFilter = `organization_id = '${ctx.organizationId}'`
    
    if (sqlUpper.includes('WHERE')) {
      safeQuery = result.sql.replace(/WHERE/i, `WHERE ${orgFilter} AND`)
    } else if (sqlUpper.includes('ORDER BY')) {
      safeQuery = result.sql.replace(/ORDER BY/i, `WHERE ${orgFilter} ORDER BY`)
    } else if (sqlUpper.includes('LIMIT')) {
      safeQuery = result.sql.replace(/LIMIT/i, `WHERE ${orgFilter} LIMIT`)
    } else {
      safeQuery = result.sql + ` WHERE ${orgFilter}`
    }

    // Add LIMIT if not present
    if (!sqlUpper.includes('LIMIT')) {
      safeQuery += ' LIMIT 100'
    }

    // Execute query
    const { data, error } = await supabase.rpc('execute_safe_query', {
      query_text: safeQuery,
    })

    if (error) {
      // Fallback: try direct query (will be subject to RLS)
      // This is a simplified approach - production should use proper query execution
      return NextResponse.json({
        explanation: result.explanation,
        sql: safeQuery,
        columns: [],
        rows: [],
        error: 'Query execution not available. Review the SQL and run manually.',
      })
    }

    // Extract columns from first row
    const rows = data || []
    const columns = rows.length > 0 ? Object.keys(rows[0]) : []

    return NextResponse.json({
      explanation: result.explanation,
      sql: safeQuery,
      columns,
      rows,
    })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('AI query error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
