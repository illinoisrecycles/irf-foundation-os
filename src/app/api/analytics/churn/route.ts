import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { predictChurnRisk, runChurnAnalysis } from '@/lib/analytics/churnPredictor'

/**
 * GET /api/analytics/churn
 * Get churn predictions for the organization
 */
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const riskLevel = searchParams.get('risk_level')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Get org context
    const { data: member } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'No organization' }, { status: 404 })
    }

    let query = supabase
      .from('donor_churn_predictions')
      .select(`
        *,
        profile:profiles(id, email, full_name)
      `)
      .eq('organization_id', member.organization_id)
      .order('risk_score', { ascending: false })
      .limit(limit)

    if (riskLevel) {
      query = query.eq('risk_level', riskLevel)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    // Summary stats
    const { data: stats } = await supabase
      .from('donor_churn_predictions')
      .select('risk_level')
      .eq('organization_id', member.organization_id)

    const summary = {
      total: stats?.length || 0,
      critical: stats?.filter(s => s.risk_level === 'critical').length || 0,
      high: stats?.filter(s => s.risk_level === 'high').length || 0,
      medium: stats?.filter(s => s.risk_level === 'medium').length || 0,
      low: stats?.filter(s => s.risk_level === 'low').length || 0,
    }

    return NextResponse.json({
      predictions: data,
      summary,
    })

  } catch (error: any) {
    console.error('Churn API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch predictions' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/analytics/churn
 * Run churn analysis for the organization
 */
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { profile_id } = await req.json().catch(() => ({}))

    // Get org context
    const { data: member } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'No organization' }, { status: 404 })
    }

    if (profile_id) {
      // Single donor prediction
      const prediction = await predictChurnRisk(profile_id, member.organization_id)
      return NextResponse.json({ prediction })
    } else {
      // Full organization analysis
      const results = await runChurnAnalysis(member.organization_id)
      return NextResponse.json({
        success: true,
        ...results,
      })
    }

  } catch (error: any) {
    console.error('Churn analysis error:', error)
    return NextResponse.json(
      { error: error.message || 'Analysis failed' },
      { status: 500 }
    )
  }
}
