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

    const { opportunity_id } = await req.json()

    if (!opportunity_id) {
      return NextResponse.json({ error: 'Opportunity ID required' }, { status: 400 })
    }

    // Fetch opportunity and org profile
    const { data: opportunity, error: oppError } = await supabase
      .from('external_grant_opportunities')
      .select('*, organization:organizations(*)')
      .eq('id', opportunity_id)
      .single()

    if (oppError || !opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }

    const org = opportunity.organization

    // Generate comprehensive application draft
    const prompt = `You are an expert grant writer. Create a comprehensive application outline for this federal grant opportunity.

## Organization Profile
- **Name:** ${org.name}
- **Mission:** ${org.mission_statement || org.description || 'Not provided'}
- **Focus Areas:** ${org.focus_areas?.join(', ') || 'General nonprofit'}
- **Service Area:** ${org.service_area || 'National'}
- **Annual Budget:** ${org.annual_budget_range || 'Not specified'}
- **Staff Size:** ${org.staff_count || 'Not specified'}

## Grant Opportunity
- **Title:** ${opportunity.title}
- **Agency:** ${opportunity.agency}
- **Synopsis:** ${opportunity.synopsis}
- **Eligibility:** ${opportunity.eligibility_notes || 'See full announcement'}
- **Estimated Funding:** $${opportunity.estimated_funding?.toLocaleString() || 'Varies'}
- **Award Range:** $${opportunity.min_award?.toLocaleString() || '?'} - $${opportunity.max_award?.toLocaleString() || '?'}
- **Deadline:** ${opportunity.deadline}

## Generate the Following Sections:

### 1. Executive Summary (150-200 words)
Write a compelling summary of the proposed project that aligns org mission with grant goals.

### 2. Statement of Need (200-250 words)
Describe the problem/opportunity being addressed with relevant data and context.

### 3. Project Description (300-400 words)
- Goals and objectives (SMART format)
- Key activities and timeline
- Target population and geographic scope
- Innovation/unique approach

### 4. Organizational Capacity (150-200 words)
Highlight qualifications, past successes, and relevant experience.

### 5. Budget Justification (150-200 words)
Provide a high-level budget breakdown and justification.

### 6. Evaluation Plan (100-150 words)
Describe how success will be measured.

### 7. Sustainability (100 words)
Explain how the project/impact will continue beyond the grant period.

Be specific, use professional grant-writing language, and make realistic assumptions based on the org profile. Mark areas needing additional input as [TO BE COMPLETED].`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: 'You are a professional grant writer with expertise in federal funding applications. Create detailed, actionable application drafts that nonprofits can refine and submit.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 3000,
      temperature: 0.4,
    })

    const draft = completion.choices[0].message.content

    // Update opportunity with draft
    const { error: updateError } = await supabase
      .from('external_grant_opportunities')
      .update({
        application_draft: {
          full_draft: draft,
          generated_at: new Date().toISOString(),
          generated_by: user.id,
          model: 'gpt-4o',
        },
        status: 'drafting',
        updated_at: new Date().toISOString(),
      })
      .eq('id', opportunity_id)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      success: true,
      draft,
      generated_at: new Date().toISOString(),
    })

  } catch (error: any) {
    console.error('Generate draft error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate draft' },
      { status: 500 }
    )
  }
}
