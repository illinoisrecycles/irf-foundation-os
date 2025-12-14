/**
 * Grant Success Prediction Algorithm
 * 
 * Hybrid approach combining rule-based scoring, historical analysis,
 * and AI evaluation to predict grant application success probability.
 * 
 * Target accuracy: 75-85% (industry benchmark)
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface GrantSuccessPrediction {
  applicationId: string
  probability: number // 0-100
  confidence: 'low' | 'medium' | 'high'
  factors: GrantSuccessFactors
  improvements: string[]
  explanation: string
}

export interface GrantSuccessFactors {
  historical: { rate: number; score: number; weight: number }
  alignment: { score: number; matchedKeywords: string[]; weight: number }
  budget: { requestedVsTypical: string; score: number; weight: number }
  quality: { completeness: number; score: number; weight: number }
  capacity: { score: number; indicators: string[]; weight: number }
  competition: { estimatedApplicants: number; score: number; weight: number }
  aiNarrative: { score: number; strengths: string[]; weaknesses: string[]; weight: number }
}

/**
 * Main prediction function
 */
export async function predictGrantSuccess(
  applicationId: string
): Promise<GrantSuccessPrediction> {
  // Fetch application and related data
  const { data: application } = await supabase
    .from('grant_applications')
    .select(`
      *,
      program:grant_programs(*, organization:organizations(*)),
      organization:organizations(*)
    `)
    .eq('id', applicationId)
    .single()

  if (!application) {
    throw new Error('Application not found')
  }

  const org = application.organization || application.program?.organization
  const program = application.program

  // Fetch historical outcomes
  const pastOutcomes = await fetchPastOutcomes(org.id)

  // Calculate each factor
  const factors: GrantSuccessFactors = {
    historical: await calculateHistoricalFactor(pastOutcomes),
    alignment: await calculateAlignmentFactor(org, application, program),
    budget: await calculateBudgetFactor(application, program),
    quality: await calculateQualityFactor(application),
    capacity: await calculateCapacityFactor(org),
    competition: await estimateCompetitionFactor(program),
    aiNarrative: await evaluateNarrativeQuality(application),
  }

  // Calculate weighted probability
  const totalWeight = Object.values(factors).reduce((sum, f) => sum + f.weight, 0)
  const weightedScore = Object.values(factors).reduce((sum, f) => 
    sum + (f.score * f.weight), 0
  ) / totalWeight

  const probability = Math.min(100, Math.max(0, Math.round(weightedScore)))
  const confidence = getConfidenceLevel(factors, pastOutcomes.length)
  const improvements = generateImprovements(factors)
  const explanation = await generateExplanation(factors, probability)

  // Save prediction
  await supabase.from('grant_applications').update({
    success_probability: probability / 100,
    prediction_factors: factors,
    ai_improvement_suggestions: improvements,
  }).eq('id', applicationId)

  return {
    applicationId,
    probability,
    confidence,
    factors,
    improvements,
    explanation,
  }
}

/**
 * Factor Calculations
 */

async function calculateHistoricalFactor(pastOutcomes: any[]): Promise<{
  rate: number
  score: number
  weight: number
}> {
  const weight = 0.25 // 25% of total

  if (pastOutcomes.length === 0) {
    return { rate: 0, score: 50, weight } // Neutral if no history
  }

  const awarded = pastOutcomes.filter(o => o.outcome === 'awarded').length
  const rate = awarded / pastOutcomes.length

  // Score: 80%+ win rate = 95 points, 50% = 75, 20% = 45, 0% = 25
  let score = 25 + (rate * 70)
  
  // Bonus for recent wins
  const recentWins = pastOutcomes
    .filter(o => o.outcome === 'awarded' && o.application_year >= new Date().getFullYear() - 2)
    .length
  score += Math.min(10, recentWins * 3)

  return { rate: Math.round(rate * 100), score: Math.min(100, score), weight }
}

async function calculateAlignmentFactor(
  org: any,
  application: any,
  program: any
): Promise<{ score: number; matchedKeywords: string[]; weight: number }> {
  const weight = 0.20 // 20% of total

  const orgKeywords = [
    ...(org.focus_areas || []),
    ...(org.mission_statement?.toLowerCase().split(/\s+/) || []),
  ].map(k => k.toLowerCase())

  const programKeywords = [
    program?.title?.toLowerCase() || '',
    program?.description?.toLowerCase() || '',
    ...(application.data?.project_summary?.toLowerCase().split(/\s+/) || []),
  ]

  // Find matches
  const matchedKeywords = orgKeywords.filter(kw => 
    kw.length > 4 && programKeywords.some(pk => pk.includes(kw))
  )

  // Score based on match density
  const matchRatio = matchedKeywords.length / Math.max(1, orgKeywords.length)
  const score = Math.min(100, 40 + (matchRatio * 60))

  return { score, matchedKeywords: matchedKeywords.slice(0, 5), weight }
}

async function calculateBudgetFactor(
  application: any,
  program: any
): Promise<{ requestedVsTypical: string; score: number; weight: number }> {
  const weight = 0.15 // 15% of total

  const requested = application.requested_amount_cents / 100
  const programBudget = (program?.budget_cents || 0) / 100

  // Typical range (would come from historical data or program settings)
  const typicalMin = programBudget * 0.02 || 5000
  const typicalMax = programBudget * 0.15 || 100000

  let score = 70 // Default reasonable
  let requestedVsTypical = 'within range'

  if (requested < typicalMin * 0.5) {
    score = 50
    requestedVsTypical = 'significantly below typical'
  } else if (requested > typicalMax * 1.5) {
    score = 40
    requestedVsTypical = 'significantly above typical'
  } else if (requested >= typicalMin && requested <= typicalMax) {
    score = 90
    requestedVsTypical = 'well within typical range'
  }

  return { requestedVsTypical, score, weight }
}

async function calculateQualityFactor(
  application: any
): Promise<{ completeness: number; score: number; weight: number }> {
  const weight = 0.15 // 15% of total

  const requiredFields = [
    'organization_name',
    'contact_email',
    'requested_amount_cents',
    'data.project_summary',
    'data.goals',
    'data.timeline',
    'data.budget_narrative',
  ]

  let filledCount = 0
  for (const field of requiredFields) {
    const value = field.includes('.') 
      ? application.data?.[field.split('.')[1]]
      : application[field]
    if (value && String(value).length > 10) {
      filledCount++
    }
  }

  const completeness = Math.round((filledCount / requiredFields.length) * 100)

  // Check narrative length/quality
  const narrativeLength = String(application.data?.project_summary || '').length
  let qualityBonus = 0
  if (narrativeLength > 2000) qualityBonus = 15
  else if (narrativeLength > 1000) qualityBonus = 10
  else if (narrativeLength > 500) qualityBonus = 5

  const score = Math.min(100, completeness + qualityBonus)

  return { completeness, score, weight }
}

async function calculateCapacityFactor(
  org: any
): Promise<{ score: number; indicators: string[]; weight: number }> {
  const weight = 0.10 // 10% of total

  const indicators: string[] = []
  let score = 50

  // Years operating
  const yearsOperating = org.founding_year 
    ? new Date().getFullYear() - org.founding_year 
    : 0

  if (yearsOperating >= 10) {
    score += 20
    indicators.push('10+ years operating')
  } else if (yearsOperating >= 5) {
    score += 15
    indicators.push('5+ years operating')
  } else if (yearsOperating >= 2) {
    score += 10
    indicators.push('Established organization')
  }

  // Staff size
  if (org.staff_count >= 20) {
    score += 15
    indicators.push('Large team capacity')
  } else if (org.staff_count >= 5) {
    score += 10
    indicators.push('Moderate team')
  }

  // Budget range
  const budgetRanges = ['5m+', '1m-5m', '500k-1m', '100k-500k']
  if (budgetRanges.indexOf(org.annual_budget_range) <= 1) {
    score += 15
    indicators.push('Strong financial base')
  }

  return { score: Math.min(100, score), indicators, weight }
}

async function estimateCompetitionFactor(
  program: any
): Promise<{ estimatedApplicants: number; score: number; weight: number }> {
  const weight = 0.05 // 5% of total

  // Estimate based on funding amount and program type
  const budget = (program?.budget_cents || 0) / 100
  let estimatedApplicants = 50 // Default medium

  if (budget > 1000000) {
    estimatedApplicants = 200 // High competition
  } else if (budget > 100000) {
    estimatedApplicants = 100
  } else if (budget < 25000) {
    estimatedApplicants = 25 // Lower competition
  }

  // Score inversely related to competition
  const score = Math.max(20, 100 - (estimatedApplicants / 3))

  return { estimatedApplicants, score, weight }
}

async function evaluateNarrativeQuality(
  application: any
): Promise<{ score: number; strengths: string[]; weaknesses: string[]; weight: number }> {
  const weight = 0.10 // 10% bonus factor

  const narrative = [
    application.data?.project_summary,
    application.data?.goals,
    application.data?.impact_statement,
  ].filter(Boolean).join('\n\n')

  if (!narrative || narrative.length < 200) {
    return { score: 30, strengths: [], weaknesses: ['Insufficient narrative content'], weight }
  }

  const prompt = `Evaluate this grant application narrative (0-100 score). Respond in JSON:
{
  "score": <number>,
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"]
}

Focus on: clarity, measurable outcomes, innovation, feasibility, impact.

Narrative:
${narrative.slice(0, 4000)}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 300,
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')
    return {
      score: result.score || 50,
      strengths: result.strengths || [],
      weaknesses: result.weaknesses || [],
      weight,
    }
  } catch {
    return { score: 50, strengths: [], weaknesses: [], weight }
  }
}

/**
 * Helper Functions
 */

function getConfidenceLevel(factors: GrantSuccessFactors, historicalCount: number): 'low' | 'medium' | 'high' {
  // Confidence based on data quality
  if (historicalCount >= 10 && factors.quality.completeness >= 80) {
    return 'high'
  }
  if (historicalCount >= 3 || factors.quality.completeness >= 60) {
    return 'medium'
  }
  return 'low'
}

function generateImprovements(factors: GrantSuccessFactors): string[] {
  const improvements: string[] = []

  if (factors.quality.score < 70) {
    improvements.push('Complete all application sections with detailed responses')
  }

  if (factors.alignment.score < 60) {
    improvements.push('Strengthen connection between project and funder priorities')
  }

  if (factors.budget.requestedVsTypical.includes('above')) {
    improvements.push('Consider reducing budget request to typical range')
  }

  if (factors.aiNarrative.weaknesses.length > 0) {
    improvements.push(...factors.aiNarrative.weaknesses.slice(0, 2))
  }

  if (factors.historical.rate < 30) {
    improvements.push('Review successful applications for best practices')
  }

  return improvements.slice(0, 5)
}

async function generateExplanation(
  factors: GrantSuccessFactors,
  probability: number
): Promise<string> {
  const prompt = `Summarize this grant success prediction in 2-3 sentences.

Probability: ${probability}%
Historical win rate: ${factors.historical.rate}%
Alignment score: ${factors.alignment.score}/100
Budget assessment: ${factors.budget.requestedVsTypical}
Quality score: ${factors.quality.score}/100
Narrative strengths: ${factors.aiNarrative.strengths.join(', ') || 'None identified'}
Narrative weaknesses: ${factors.aiNarrative.weaknesses.join(', ') || 'None identified'}

Be encouraging but realistic. Focus on actionable insights.`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
    })

    return completion.choices[0].message.content || ''
  } catch {
    return `This application has a ${probability}% estimated success rate based on historical performance, alignment with funder priorities, and application quality.`
  }
}

async function fetchPastOutcomes(orgId: string): Promise<any[]> {
  const { data } = await supabase
    .from('grant_outcome_history')
    .select('*')
    .eq('organization_id', orgId)
    .order('application_year', { ascending: false })
    .limit(50)

  return data || []
}

/**
 * Batch analyze all pending applications
 */
export async function analyzePendingApplications(organizationId: string): Promise<{
  analyzed: number
  highProbability: number
  needsWork: number
}> {
  const { data: applications } = await supabase
    .from('grant_applications')
    .select('id')
    .eq('organization_id', organizationId)
    .in('status', ['draft', 'submitted', 'under_review'])

  const results = { analyzed: 0, highProbability: 0, needsWork: 0 }

  for (const app of applications || []) {
    try {
      const prediction = await predictGrantSuccess(app.id)
      results.analyzed++
      if (prediction.probability >= 70) {
        results.highProbability++
      } else if (prediction.probability < 50) {
        results.needsWork++
      }
    } catch (err) {
      console.error(`Grant prediction failed for ${app.id}:`, err)
    }
  }

  return results
}
