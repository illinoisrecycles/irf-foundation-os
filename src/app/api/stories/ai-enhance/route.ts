import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * POST /api/stories/ai-enhance
 * Generate compelling story content from a quote/testimonial
 */
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { quote, beneficiary_name, program_id } = await req.json()

    // Get organization context
    const { data: member } = await supabase
      .from('organization_members')
      .select('organization:organizations(name, mission_statement, focus_areas)')
      .eq('user_id', user.id)
      .single()

    const org = member?.organization as any

    // Get program context if provided
    let program = null
    if (program_id) {
      const { data } = await supabase
        .from('programs')
        .select('title, description, goal')
        .eq('id', program_id)
        .single()
      program = data
    }

    const prompt = `You are an expert nonprofit storyteller. Generate a compelling impact story.

ORGANIZATION: ${org?.name || 'A nonprofit organization'}
MISSION: ${org?.mission_statement || 'Making communities better'}
FOCUS: ${org?.focus_areas?.join(', ') || 'Community development'}

${program ? `PROGRAM: ${program.title}
PROGRAM GOAL: ${program.goal || program.description}` : ''}

BENEFICIARY: ${beneficiary_name || 'A community member'}
QUOTE/TESTIMONIAL: "${quote || 'This program changed my life.'}"

Generate:
1. A compelling, attention-grabbing title (max 10 words)
2. A full story (200-300 words) that:
   - Opens with context/challenge faced
   - Describes the intervention/program involvement
   - Shows transformation/results
   - Ends with future outlook
   - Uses the beneficiary's voice authentically
   - Incorporates the quote naturally
   - Avoids generic nonprofit clichés

Respond in JSON:
{
  "title": "...",
  "story": "..."
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 600,
      temperature: 0.8,
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('Story enhancement error:', error)
    return NextResponse.json(
      { error: error.message || 'Enhancement failed' },
      { status: 500 }
    )
  }
}
