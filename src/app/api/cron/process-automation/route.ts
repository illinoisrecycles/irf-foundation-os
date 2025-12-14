import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runAutomationForQueueItem, type QueueItem } from '@/lib/automation/run'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 seconds max for Pro plan

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const workerId = `vercel-${process.env.VERCEL_REGION || 'local'}-${Date.now()}`

  // Claim queue items atomically
  const { data: items, error } = await supabase.rpc('claim_automation_queue', {
    p_limit: 25,
    p_worker: workerId,
  })

  if (error) {
    console.error('Failed to claim queue items:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!items?.length) {
    return NextResponse.json({ ok: true, processed: 0, message: 'No items to process' })
  }

  let processed = 0
  let succeeded = 0
  let failed = 0

  for (const item of items as QueueItem[]) {
    processed++
    try {
      await runAutomationForQueueItem(supabase, item)
      succeeded++
    } catch (err: any) {
      failed++
      console.error(`Failed to process queue item ${item.id}:`, err)
      
      // Mark as failed
      await supabase.rpc('fail_automation_queue', {
        p_id: item.id,
        p_error: String(err?.message || err),
      })
    }
  }

  return NextResponse.json({
    ok: true,
    processed,
    succeeded,
    failed,
    worker_id: workerId,
    timestamp: new Date().toISOString(),
  })
}
