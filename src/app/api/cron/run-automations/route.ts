import { NextResponse } from 'next/server'
import { runScheduledAutomations, runStateWatchers } from '@/lib/automation/enhanced-runner'
import { detectAtRiskMembers, sendGrantReminders } from '@/lib/automation/foundation-recipes'
import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================================
// CRON: RUN SCHEDULED AUTOMATIONS
// Called by Vercel cron every 15 minutes
// ============================================================================

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = {
    scheduled: { processed: 0, errors: [] as string[] },
    watchers: { processed: 0, triggered: 0, errors: [] as string[] },
    retention: { flagged: 0, errors: [] as string[] },
    grants: { reminders_sent: 0, escalations: 0 },
  }

  try {
    // 1. Run scheduled automations
    results.scheduled = await runScheduledAutomations()

    // 2. Run state watchers
    results.watchers = await runStateWatchers()

    // 3. Run built-in foundation automations for all orgs
    const supabase = createAdminClient()
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id')
      .limit(100)

    for (const org of orgs || []) {
      try {
        // Retention check (run weekly, but safe to call daily)
        const retention = await detectAtRiskMembers(org.id)
        results.retention.flagged += retention.flagged
        results.retention.errors.push(...retention.errors)

        // Grant reminders
        const grants = await sendGrantReminders(org.id)
        results.grants.reminders_sent += grants.reminders_sent
        results.grants.escalations += grants.escalations

      } catch (err: any) {
        results.retention.errors.push(`Org ${org.id}: ${err.message}`)
      }
    }

  } catch (err: any) {
    return NextResponse.json({ 
      error: err.message,
      partial_results: results 
    }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    results,
  })
}
