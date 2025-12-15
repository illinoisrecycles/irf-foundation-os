import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

/**
 * AI Suggest API
 * 
 * Asks AI to help resolve a mapping conflict
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: Request) {
  try {
    const { sessionId, sourceField } = await req.json()

    if (!sessionId || !sourceField) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    // Get session
    const { data: session } = await supabase
      .from('data_migrations')
      .select('parsed_sample, conflicts')
      .eq('id', sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Get sample values for this field
    const sampleValues = session.parsed_sample
      .slice(0, 10)
      .map((row: any) => row[sourceField])
      .filter(Boolean)

    // Find the conflict
    const conflict = session.conflicts?.find((c: any) => c.field === sourceField)
    const options = conflict?.proposals?.map((p: any) => p.targetPath) || []

    if (options.length === 0) {
      return NextResponse.json({ error: 'No conflict found for this field' }, { status: 400 })
    }

    // Ask AI
    const prompt = `You are a nonprofit data migration expert.

Given this source field "${sourceField}" with sample values:
${JSON.stringify(sampleValues)}

Which of these FoundationOS targets is the BEST match?
${options.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n')}

Consider:
- Semantic meaning of the field name
- Data patterns in the sample values
- Common nonprofit database conventions

Respond with ONLY the number of the best match (e.g., "1" or "2").`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 10,
    })

    const response = completion.choices[0].message.content?.trim() || '1'
    const index = parseInt(response) - 1
    const suggestion = options[index] || options[0]

    return NextResponse.json({
      sourceField,
      suggestion,
      reasoning: `AI analyzed ${sampleValues.length} sample values and determined "${suggestion}" is the best match.`,
    })

  } catch (error: any) {
    console.error('AI suggest error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
