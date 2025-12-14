import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processEventBus } from '@/lib/automation'

// Vercel Cron: runs every 5 minutes
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const result = await processEventBus(supabase, 100)

    return NextResponse.json({
      success: true,
      processed: result.processed,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('[Cron] Event processing error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
