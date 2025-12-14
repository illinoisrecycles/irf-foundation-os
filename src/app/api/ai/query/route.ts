import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { naturalLanguageToQuery } from '@/lib/ai'

export async function POST(req: Request) {
  try {
    const { query, organization_id } = await req.json()

    if (!query || !organization_id) {
      return NextResponse.json({ error: 'Missing query or organization_id' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Convert natural language to SQL
    const sqlResult = await naturalLanguageToQuery(query, organization_id)

    if (sqlResult.error) {
      // Fall back to pattern matching for common queries
      const lowerQuery = query.toLowerCase()
      
      // Pattern matching for common questions
      if (lowerQuery.includes('member') && (lowerQuery.includes('joined') || lowerQuery.includes('new'))) {
        const timeframe = lowerQuery.includes('month') ? '1 month' 
          : lowerQuery.includes('week') ? '1 week'
          : lowerQuery.includes('year') ? '1 year'
          : '1 month'
        
        const { count } = await supabase
          .from('member_organizations')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organization_id)
          .gte('joined_at', new Date(Date.now() - (timeframe === '1 week' ? 7 : timeframe === '1 year' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString())

        return NextResponse.json({
          answer: `${count} members joined in the last ${timeframe.replace('1 ', '')}.`,
          data: [{ 'New Members': count, Period: timeframe }],
        })
      }

      if (lowerQuery.includes('retention')) {
        const { count: active } = await supabase
          .from('member_organizations')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organization_id)
          .eq('membership_status', 'active')

        const { count: total } = await supabase
          .from('member_organizations')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organization_id)

        const rate = total ? Math.round((active! / total) * 100) : 0

        return NextResponse.json({
          answer: `Your current retention rate is ${rate}% (${active} active out of ${total} total members).`,
          data: [{ 'Retention Rate': `${rate}%`, 'Active Members': active, 'Total Members': total }],
        })
      }

      if (lowerQuery.includes('donor') && (lowerQuery.includes('top') || lowerQuery.includes('largest'))) {
        const { data: donors } = await supabase
          .from('donations')
          .select('donor_name, amount_cents')
          .eq('organization_id', organization_id)
          .order('amount_cents', { ascending: false })
          .limit(10)

        // Aggregate by donor
        const totals: Record<string, number> = {}
        for (const d of donors || []) {
          const name = d.donor_name || 'Anonymous'
          totals[name] = (totals[name] || 0) + d.amount_cents
        }

        const sorted = Object.entries(totals)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([name, amount]) => ({ Donor: name, Total: `$${(amount / 100).toLocaleString()}` }))

        return NextResponse.json({
          answer: `Here are your top ${sorted.length} donors by total giving.`,
          data: sorted,
        })
      }

      if (lowerQuery.includes('event') && lowerQuery.includes('attendance')) {
        const { data: events } = await supabase
          .from('events')
          .select('title, start_date, event_registrations(count)')
          .eq('organization_id', organization_id)
          .order('start_date', { ascending: false })
          .limit(10)

        const formatted = events?.map(e => ({
          Event: e.title,
          Date: new Date(e.start_date).toLocaleDateString(),
          Attendees: e.event_registrations?.[0]?.count || 0,
        })) || []

        return NextResponse.json({
          answer: `Here are your recent events by attendance.`,
          data: formatted.sort((a, b) => b.Attendees - a.Attendees),
        })
      }

      // Generic fallback
      return NextResponse.json({
        answer: "I couldn't understand that query. Try asking about members, donors, events, or retention.",
        data: null,
      })
    }

    // Execute the generated SQL (with security restrictions already applied in naturalLanguageToQuery)
    if (sqlResult.sql) {
      const { data, error } = await supabase.rpc('exec_readonly_query', { 
        query_text: sqlResult.sql 
      })

      if (error) {
        return NextResponse.json({
          answer: "I found a query but couldn't execute it. Try rephrasing your question.",
          sql: sqlResult.sql,
        })
      }

      return NextResponse.json({
        answer: sqlResult.explanation || `Found ${data?.length || 0} results.`,
        data,
        sql: sqlResult.sql,
      })
    }

    return NextResponse.json({
      answer: sqlResult.explanation || "I processed your query but couldn't find specific data.",
      data: null,
    })
  } catch (err: any) {
    console.error('[AI Query]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
