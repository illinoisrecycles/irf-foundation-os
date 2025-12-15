import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { requireOrgContext } from '@/lib/auth/org-context'
import { emitEvents } from '@/lib/automation/event-emitter'

/**
 * Migration Import API
 * 
 * Executes the actual data import using the finalized mapping
 * Runs in background, updates progress
 */

export const maxDuration = 300

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
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

    const ctx = await requireOrgContext(supabase, req, { requireAdmin: true })
    const { sessionId, finalMapping } = await req.json()

    // Get session
    const { data: session, error } = await adminSupabase
      .from('data_migrations')
      .select('*')
      .eq('id', sessionId)
      .eq('organization_id', ctx.organizationId)
      .single()

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Update status
    await adminSupabase.from('data_migrations').update({
      status: 'importing',
      mapping: finalMapping || session.mapping,
      current_step: 'Starting import...',
      progress_percent: 0,
      import_started_at: new Date().toISOString(),
    }).eq('id', sessionId)

    // Get full data (re-parse from storage or use sample for now)
    const allRows = session.parsed_sample // In production, fetch from storage
    const mapping = finalMapping || session.mapping

    // Organize by target table
    const targetTables: Record<string, any[]> = {}

    for (const row of allRows) {
      const transformedRow: Record<string, any> = {
        organization_id: ctx.organizationId,
      }

      for (const [sourceField, targetPath] of Object.entries(mapping)) {
        if (targetPath === 'ignore' || !targetPath) continue

        const [table, field] = (targetPath as string).split('.')
        if (!table || !field) continue

        let value = row[sourceField]

        // Handle transformations
        if (field.endsWith('_cents') && value) {
          // Convert dollars to cents
          const numVal = parseFloat(String(value).replace(/[$,]/g, ''))
          value = Math.round(numVal * 100)
        }

        if (field === 'email' && value) {
          value = String(value).toLowerCase().trim()
        }

        if (!targetTables[table]) {
          targetTables[table] = []
        }

        // Find or create row for this table
        let tableRow = targetTables[table].find(r => r._sourceIndex === allRows.indexOf(row))
        if (!tableRow) {
          tableRow = { _sourceIndex: allRows.indexOf(row), organization_id: ctx.organizationId }
          targetTables[table].push(tableRow)
        }

        tableRow[field] = value
      }
    }

    // Import stats
    const stats = {
      total_rows: allRows.length,
      profiles_created: 0,
      members_created: 0,
      donations_created: 0,
      events_created: 0,
      duplicates_merged: 0,
      errors: 0,
    }

    // Import profiles first (they're the base)
    if (targetTables['profiles']?.length > 0) {
      const profiles = targetTables['profiles'].map(p => {
        const { _sourceIndex, ...data } = p
        return data
      }).filter(p => p.email) // Must have email

      // Dedupe by email
      const uniqueProfiles: Record<string, any> = {}
      for (const profile of profiles) {
        if (!uniqueProfiles[profile.email]) {
          uniqueProfiles[profile.email] = profile
        } else {
          stats.duplicates_merged++
        }
      }

      const profilesToInsert = Object.values(uniqueProfiles)

      // Upsert profiles
      for (const profile of profilesToInsert) {
        const { data, error } = await adminSupabase
          .from('profiles')
          .upsert(profile, { onConflict: 'email' })
          .select()
          .single()

        if (!error) {
          stats.profiles_created++
        } else {
          stats.errors++
        }
      }

      await adminSupabase.from('data_migrations').update({
        current_step: `Imported ${stats.profiles_created} profiles`,
        progress_percent: 40,
      }).eq('id', sessionId)
    }

    // Import member_organizations
    if (targetTables['member_organizations']?.length > 0) {
      const members = targetTables['member_organizations'].map(m => {
        const { _sourceIndex, ...data } = m
        return data
      }).filter(m => m.primary_contact_email || m.organization_name)

      for (const member of members) {
        const { error } = await adminSupabase
          .from('member_organizations')
          .upsert(member, { onConflict: 'organization_id,primary_contact_email' })

        if (!error) {
          stats.members_created++
          
          // Emit event for automation
          try {
            await emitEvents.memberCreated(ctx.organizationId, {
              member_email: member.primary_contact_email,
              member_name: member.organization_name,
            })
          } catch {}
        } else {
          stats.errors++
        }
      }

      await adminSupabase.from('data_migrations').update({
        current_step: `Imported ${stats.members_created} members`,
        progress_percent: 60,
      }).eq('id', sessionId)
    }

    // Import donations
    if (targetTables['donations']?.length > 0) {
      const donations = targetTables['donations'].map(d => {
        const { _sourceIndex, ...data } = d
        return data
      }).filter(d => d.amount_cents && d.donor_email)

      for (const donation of donations) {
        const { error } = await adminSupabase
          .from('donations')
          .insert(donation)

        if (!error) {
          stats.donations_created++
        } else {
          stats.errors++
        }
      }

      await adminSupabase.from('data_migrations').update({
        current_step: `Imported ${stats.donations_created} donations`,
        progress_percent: 80,
      }).eq('id', sessionId)
    }

    // Mark complete
    await adminSupabase.from('data_migrations').update({
      status: 'complete',
      current_step: 'Migration complete!',
      progress_percent: 100,
      stats,
      import_completed_at: new Date().toISOString(),
    }).eq('id', sessionId)

    // Trigger post-migration optimization
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/migrate/post-optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      stats,
    })

  } catch (error: any) {
    console.error('Import error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
