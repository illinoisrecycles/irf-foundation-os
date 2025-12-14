import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext, requireFinanceRole } from '@/lib/auth/org-context'

export async function GET(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)

    // Get import history
    const { data, error } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ imports: data || [] })
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = createAuthedServerClient()
    const ctx = await requireOrgContext(supabase, req)
    requireFinanceRole(ctx) // Imports require admin access

    const body = await req.json()
    const { import_type, data, options } = body

    if (!import_type || !data) {
      return NextResponse.json({ error: 'import_type and data required' }, { status: 400 })
    }

    // Create import job
    const { data: job, error: jobErr } = await supabase
      .from('import_jobs')
      .insert({
        organization_id: ctx.organizationId,
        import_type,
        status: 'pending',
        total_rows: Array.isArray(data) ? data.length : 0,
        options,
        created_by_profile_id: ctx.userId,
      })
      .select()
      .single()

    if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 })

    // Process import based on type
    let processed = 0
    let errors: string[] = []

    try {
      switch (import_type) {
        case 'members':
          for (const row of data) {
            const { error } = await supabase.from('members').insert({
              organization_id: ctx.organizationId,
              email: row.email,
              first_name: row.first_name,
              last_name: row.last_name,
              company: row.company,
              title: row.title,
              member_type: row.member_type || 'individual',
              status: row.status || 'active',
            })
            if (error) errors.push(`Row ${processed + 1}: ${error.message}`)
            else processed++
          }
          break

        case 'transactions':
          for (const row of data) {
            const { error } = await supabase.from('bank_transactions').insert({
              organization_id: ctx.organizationId,
              date: row.date,
              amount_cents: Math.round(parseFloat(row.amount) * 100),
              name: row.description || row.name,
              merchant_name: row.merchant || row.payee,
              status: 'pending',
            })
            if (error) errors.push(`Row ${processed + 1}: ${error.message}`)
            else processed++
          }
          break

        default:
          return NextResponse.json({ error: `Unknown import type: ${import_type}` }, { status: 400 })
      }

      // Update job status
      await supabase
        .from('import_jobs')
        .update({
          status: errors.length > 0 ? 'completed_with_errors' : 'completed',
          processed_rows: processed,
          error_rows: errors.length,
          errors: errors.length > 0 ? errors : null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id)

      return NextResponse.json({ 
        job_id: job.id, 
        processed, 
        errors: errors.length,
        error_details: errors.slice(0, 10) // First 10 errors
      })
    } catch (err: any) {
      await supabase
        .from('import_jobs')
        .update({ status: 'failed', errors: [err.message] })
        .eq('id', job.id)

      return NextResponse.json({ error: err.message }, { status: 500 })
    }
  } catch (err: any) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
