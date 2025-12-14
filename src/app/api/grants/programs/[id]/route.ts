import { NextResponse } from 'next/server'
import { createAuthedServerClient } from '@/lib/supabase/server-authed'
import { requireOrgContext } from '@/lib/auth/org-context'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createAuthedServerClient()
    // Note: This endpoint is also used by public portal, so we check org differently
    const { id } = await params

    const { data, error } = await supabase
      .from('grant_programs')
      .select('*')
      .eq('id', id)
      .eq('status', 'open') // Only return open programs publicly
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    return NextResponse.json({ program: data })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
