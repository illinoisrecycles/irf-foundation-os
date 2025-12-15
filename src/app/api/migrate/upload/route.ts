import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { requireOrgContext } from '@/lib/auth/org-context'
import Papa from 'papaparse'

/**
 * Migration Upload API
 * 
 * Handles file upload, parses sample data, and kicks off AI analysis
 */

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {}
          },
        },
      }
    )

    const ctx = await requireOrgContext(supabase, req, { requireAdmin: true })

    const formData = await req.formData()
    const file = formData.get('file') as File
    const sourceSystem = formData.get('sourceSystem') as string || 'csv'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Read and parse file
    const text = await file.text()
    let parsedData: any[] = []
    let detectedColumns: string[] = []

    if (file.name.endsWith('.csv')) {
      const result = Papa.parse(text, { header: true, skipEmptyLines: true })
      parsedData = result.data as any[]
      detectedColumns = result.meta.fields || []
    } else if (file.name.endsWith('.json')) {
      const json = JSON.parse(text)
      parsedData = Array.isArray(json) ? json : [json]
      detectedColumns = Object.keys(parsedData[0] || {})
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      // For Excel, we'd need xlsx library - simplified for now
      return NextResponse.json({ 
        error: 'Excel files require server-side processing. Please export as CSV.' 
      }, { status: 400 })
    }

    if (parsedData.length === 0) {
      return NextResponse.json({ error: 'No data found in file' }, { status: 400 })
    }

    // Upload file to storage
    const fileName = `${ctx.organizationId}/${Date.now()}-${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('migrations')
      .upload(fileName, file)

    if (uploadError) {
      console.error('Upload error:', uploadError)
      // Continue without storage - we have the parsed data
    }

    // Create migration session
    const { data: session, error: sessionError } = await supabase
      .from('data_migrations')
      .insert({
        organization_id: ctx.organizationId,
        created_by: ctx.userId,
        source_system: sourceSystem,
        source_file_name: file.name,
        file_url: uploadData?.path || null,
        file_size_bytes: file.size,
        parsed_sample: parsedData.slice(0, 100), // First 100 rows for AI
        detected_columns: detectedColumns,
        detected_row_count: parsedData.length,
        status: 'analyzing',
        current_step: 'AI mapping in progress',
        progress_percent: 10,
      })
      .select()
      .single()

    if (sessionError) {
      console.error('Session creation error:', sessionError)
      return NextResponse.json({ error: sessionError.message }, { status: 500 })
    }

    // Trigger background AI processing
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/migrate/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id }),
    }).catch(err => console.error('Background process trigger failed:', err))

    return NextResponse.json({ 
      sessionId: session.id,
      rowCount: parsedData.length,
      columns: detectedColumns,
    })

  } catch (error: any) {
    console.error('Migration upload error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
