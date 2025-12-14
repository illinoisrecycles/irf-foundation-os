import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { application_id } = await req.json()

    if (!application_id) {
      return NextResponse.json({ error: 'Application ID required' }, { status: 400 })
    }

    // Fetch application with program details
    const { data: application, error } = await supabase
      .from('grant_applications')
      .select(`
        *,
        program:grant_programs(title, description, budget_cents)
      `)
      .eq('id', application_id)
      .single()

    if (error || !application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // Build prompt for AI analysis
    const prompt = `You are an expert grant reviewer for a nonprofit foundation. Analyze this grant application and provide a comprehensive executive summary for the review committee.

## Application Details

**Applicant Organization:** ${application.organization_name}
**Contact Email:** ${application.contact_email}
**Amount Requested:** $${((application.requested_amount_cents || 0) / 100).toLocaleString()}
**Grant Program:** ${application.program?.title || 'General'}
**Program Budget:** $${((application.program?.budget_cents || 0) / 100).toLocaleString()}

**Application Data:**
${JSON.stringify(application.data, null, 2)}

## Your Analysis Should Include:

1. **Executive Summary** (2-3 sentences)
2. **Key Strengths** (3-5 bullet points)
3. **Potential Concerns/Risks** (2-4 bullet points)
4. **Mission Alignment** (How well does this align with typical foundation priorities?)
5. **Budget Assessment** (Is the request reasonable and well-justified?)
6. **Recommendation** (Strong Consider / Consider / Needs Discussion / Decline)

Be objective, professional, and constructive. Focus on facts from the application.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: 'You are a professional grant reviewer providing objective analysis to help foundation staff make informed decisions. Be thorough but concise.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1500,
      temperature: 0.3,
    })

    const summary = completion.choices[0].message.content

    // Extract structured data for quick reference
    const structuredAnalysis = await extractStructuredAnalysis(summary || '')

    // Update application with AI summary
    await supabase
      .from('grant_applications')
      .update({
        ai_summary: summary,
        ai_summary_generated_at: new Date().toISOString(),
        ai_risk_flags: structuredAnalysis.risks,
        ai_strength_highlights: structuredAnalysis.strengths,
      })
      .eq('id', application_id)

    return NextResponse.json({
      summary,
      strengths: structuredAnalysis.strengths,
      risks: structuredAnalysis.risks,
      recommendation: structuredAnalysis.recommendation,
      generated_at: new Date().toISOString(),
    })

  } catch (error: any) {
    console.error('AI summarize error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate summary' },
      { status: 500 }
    )
  }
}

async function extractStructuredAnalysis(summary: string): Promise<{
  strengths: string[]
  risks: string[]
  recommendation: string
}> {
  // Simple extraction - in production, could use another AI call for structured output
  const strengths: string[] = []
  const risks: string[] = []
  let recommendation = ''

  const lines = summary.split('\n')
  let currentSection = ''

  for (const line of lines) {
    const trimmed = line.trim()
    
    if (trimmed.toLowerCase().includes('strength') || trimmed.toLowerCase().includes('key strength')) {
      currentSection = 'strengths'
    } else if (trimmed.toLowerCase().includes('concern') || trimmed.toLowerCase().includes('risk')) {
      currentSection = 'risks'
    } else if (trimmed.toLowerCase().includes('recommendation')) {
      currentSection = 'recommendation'
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.match(/^\d+\./)) {
      const content = trimmed.replace(/^[-•\d.]\s*/, '')
      if (currentSection === 'strengths' && content) {
        strengths.push(content)
      } else if (currentSection === 'risks' && content) {
        risks.push(content)
      }
    }

    if (currentSection === 'recommendation' && trimmed && !trimmed.includes('Recommendation')) {
      recommendation = trimmed
    }
  }

  return { strengths, risks, recommendation }
}
