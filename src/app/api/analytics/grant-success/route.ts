import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { predictGrantSuccess, analyzePendingApplications } from '@/lib/analytics/grantSuccessPredictor'

/**
 * GET /api/analytics/grant-success
 * Get grant success predictions
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
    const applicationId = searchParams.get('application_id')

    // Get org context
    const { data: member } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'No organization' }, { status: 404 })
    }

    if (applicationId) {
      // Get specific prediction
      const { data: app } = await supabase
        .from('grant_applications')
        .select('success_probability, prediction_factors, ai_improvement_suggestions')
        .eq('id', applicationId)
        .single()

      return NextResponse.json({
        application_id: applicationId,
        probability: app?.success_probability,
        factors: app?.prediction_factors,
        improvements: app?.ai_improvement_suggestions,
      })
    }

    // Get all predictions for org
    const { data: applications } = await supabase
      .from('grant_applications')
      .select(`
        id, 
        organization_name, 
        requested_amount_cents,
        status,
        success_probability,
        prediction_factors,
        program:grant_programs(title)
      `)
      .not('success_probability', 'is', null)
      .order('success_probability', { ascending: false })
      .limit(50)

    return NextResponse.json({
      applications,
    })

  } catch (error: any) {
    console.error('Grant success API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch predictions' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/analytics/grant-success
 * Run prediction for an application
 */
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { application_id, analyze_all } = await req.json()

    // Get org context
    const { data: member } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'No organization' }, { status: 404 })
    }

    if (analyze_all) {
      // Analyze all pending applications
      const results = await analyzePendingApplications(member.organization_id)
      return NextResponse.json({
        success: true,
        ...results,
      })
    }

    if (!application_id) {
      return NextResponse.json({ error: 'application_id required' }, { status: 400 })
    }

    // Run prediction for single application
    const prediction = await predictGrantSuccess(application_id)

    return NextResponse.json({
      success: true,
      prediction,
    })

  } catch (error: any) {
    console.error('Grant prediction error:', error)
    return NextResponse.json(
      { error: error.message || 'Prediction failed' },
      { status: 500 }
    )
  }
}
