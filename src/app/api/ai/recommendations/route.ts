import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateEmbedding } from '@/lib/ai'

export async function GET(req: Request) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('member_id')
  const type = searchParams.get('type') || 'resources'

  if (!memberId) {
    return NextResponse.json({ error: 'member_id required' }, { status: 400 })
  }

  try {
    const { data: activities } = await supabase
      .from('member_activities')
      .select('activity_type, metadata')
      .eq('member_organization_id', memberId)
      .order('activity_date', { ascending: false })
      .limit(50)

    const interestText = activities
      ?.map(a => `${a.activity_type}: ${JSON.stringify(a.metadata || {})}`)
      .join(' ') || 'general nonprofit member'

    if (type === 'resources') {
      const embedding = await generateEmbedding(interestText)
      
      if (embedding) {
        const { data: recommendations } = await supabase.rpc('match_resources', {
          query_embedding: embedding,
          match_count: 5,
        })
        return NextResponse.json({ recommendations })
      }

      const { data: popular } = await supabase
        .from('resources')
        .select('id, title, description, download_count')
        .eq('is_published', true)
        .order('download_count', { ascending: false })
        .limit(5)

      return NextResponse.json({ recommendations: popular })
    }

    if (type === 'events') {
      const { data: upcoming } = await supabase
        .from('events')
        .select('id, title, start_date, event_type')
        .gte('start_date', new Date().toISOString())
        .eq('is_published', true)
        .order('start_date', { ascending: true })
        .limit(5)

      return NextResponse.json({ recommendations: upcoming })
    }

    return NextResponse.json({ recommendations: [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
