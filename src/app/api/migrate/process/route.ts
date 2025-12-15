import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { multiLlmFieldMapper, saveMappingLearning } from '@/lib/migration/multiLlmMapper'

/**
 * Migration Process API
 * 
 * Background job that runs the multi-LLM ensemble mapping
 * Called after file upload to analyze and map fields
 */

export const maxDuration = 300 // 5 minutes for complex files

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Get session
    const { data: session, error: fetchError } = await supabase
      .from('data_migrations')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (fetchError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Update status
    await supabase.from('data_migrations').update({
      status: 'mapping',
      current_step: 'Running multi-LLM ensemble mapping',
      progress_percent: 30,
    }).eq('id', sessionId)

    // Run the multi-LLM ensemble mapper
    const result = await multiLlmFieldMapper(
      session.parsed_sample,
      session.source_system
    )

    // Update status
    await supabase.from('data_migrations').update({
      current_step: 'Analyzing conflicts and confidence',
      progress_percent: 70,
    }).eq('id', sessionId)

    // Determine final status
    const hasHighConfidenceConflicts = result.conflicts.length > 0
    const lowConfidenceFields = Object.entries(result.confidenceByField)
      .filter(([_, conf]) => conf < 0.7)
      .length

    const needsReview = hasHighConfidenceConflicts || lowConfidenceFields > 3
    const finalStatus = needsReview ? 'needs_review' : 'ready_to_import'

    // Save results
    await supabase.from('data_migrations').update({
      mapping: result.mapping,
      confidence_by_field: result.confidenceByField,
      conflicts: result.conflicts,
      ai_confidence: result.overallConfidence,
      ensemble_proposals: result.modelProposals,
      status: finalStatus,
      current_step: needsReview 
        ? `Review ${result.conflicts.length} conflicts before import`
        : 'Ready to import',
      progress_percent: 100,
    }).eq('id', sessionId)

    return NextResponse.json({
      success: true,
      status: finalStatus,
      mapping: result.mapping,
      confidence: result.overallConfidence,
      conflicts: result.conflicts.length,
      unmapped: result.unmappedFields.length,
    })

  } catch (error: any) {
    console.error('Migration process error:', error)

    // Try to update session with error
    try {
      const { sessionId } = await req.json()
      if (sessionId) {
        await supabase.from('data_migrations').update({
          status: 'failed',
          error_log: error.message,
          current_step: 'Processing failed',
        }).eq('id', sessionId)
      }
    } catch {}

    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
