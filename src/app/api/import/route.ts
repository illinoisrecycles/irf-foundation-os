import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Column mapping suggestions based on common patterns
const COLUMN_MAPPINGS: Record<string, string[]> = {
  name: ['name', 'organization', 'company', 'org_name', 'company_name', 'organization_name'],
  email: ['email', 'email_address', 'e-mail', 'contact_email', 'primary_email'],
  phone: ['phone', 'telephone', 'phone_number', 'tel', 'mobile'],
  address: ['address', 'street', 'street_address', 'address1', 'address_line_1'],
  city: ['city', 'town'],
  state: ['state', 'province', 'region', 'state_province'],
  zip: ['zip', 'postal', 'zip_code', 'postal_code', 'zipcode'],
  membership_type: ['type', 'membership', 'plan', 'membership_type', 'member_type'],
  joined_date: ['joined', 'join_date', 'joined_date', 'member_since', 'start_date'],
  expires_date: ['expires', 'expiry', 'expiration', 'expires_at', 'expiration_date', 'renewal_date'],
  amount: ['amount', 'dues', 'fee', 'price', 'payment'],
}

function suggestMapping(header: string): string | null {
  const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, '_')
  
  for (const [field, patterns] of Object.entries(COLUMN_MAPPINGS)) {
    if (patterns.some(p => normalized.includes(p) || p.includes(normalized))) {
      return field
    }
  }
  return null
}

// POST - Start import job
export async function POST(req: Request) {
  const supabase = createAdminClient()
  
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const orgId = formData.get('organization_id') as string
    const importType = formData.get('import_type') as string || 'members'

    if (!file || !orgId) {
      return NextResponse.json({ error: 'File and organization_id required' }, { status: 400 })
    }

    // Parse CSV
    const text = await file.text()
    const lines = text.split('\n').filter(l => l.trim())
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
    
    // Generate column mapping suggestions
    const suggestedMappings: Record<string, string | null> = {}
    headers.forEach(header => {
      suggestedMappings[header] = suggestMapping(header)
    })

    // Create import job
    const { data: job, error } = await supabase
      .from('import_jobs')
      .insert({
        organization_id: orgId,
        import_type: importType,
        file_name: file.name,
        total_rows: lines.length - 1,
        status: 'pending',
        column_mapping: suggestedMappings,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      job_id: job.id,
      headers,
      suggested_mappings: suggestedMappings,
      total_rows: lines.length - 1,
      preview: lines.slice(1, 6).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        return Object.fromEntries(headers.map((h, i) => [h, values[i] || '']))
      }),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PUT - Execute import with confirmed mappings
export async function PUT(req: Request) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { job_id, column_mapping, data } = body

  if (!job_id || !column_mapping || !data) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    // Update job status
    await supabase
      .from('import_jobs')
      .update({ status: 'processing', column_mapping, started_at: new Date().toISOString() })
      .eq('id', job_id)

    let successCount = 0
    let errorCount = 0
    const errors: any[] = []

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      
      try {
        // Map columns to fields
        const mapped: Record<string, any> = {}
        for (const [sourceCol, targetField] of Object.entries(column_mapping)) {
          if (targetField && row[sourceCol] !== undefined) {
            mapped[targetField as string] = row[sourceCol]
          }
        }

        // Get organization_id from job
        const { data: job } = await supabase
          .from('import_jobs')
          .select('organization_id')
          .eq('id', job_id)
          .single()

        // Insert member
        const { error: insertError } = await supabase
          .from('member_organizations')
          .insert({
            organization_id: job.organization_id,
            name: mapped.name || 'Unknown',
            primary_email: mapped.email,
            phone: mapped.phone,
            billing_address: mapped.address,
            billing_city: mapped.city,
            billing_state: mapped.state,
            billing_zip: mapped.zip,
            membership_status: 'active',
            joined_at: mapped.joined_date ? new Date(mapped.joined_date).toISOString() : new Date().toISOString(),
            expires_at: mapped.expires_date ? new Date(mapped.expires_date).toISOString() : null,
          })

        if (insertError) throw insertError
        successCount++
      } catch (err: any) {
        errorCount++
        errors.push({ row: i + 1, error: err.message })
      }

      // Update progress
      await supabase
        .from('import_jobs')
        .update({ processed_rows: i + 1, success_count: successCount, error_count: errorCount })
        .eq('id', job_id)
    }

    // Complete job
    await supabase
      .from('import_jobs')
      .update({
        status: errorCount > 0 ? 'completed_with_errors' : 'completed',
        completed_at: new Date().toISOString(),
        errors,
      })
      .eq('id', job_id)

    return NextResponse.json({ success_count: successCount, error_count: errorCount, errors })
  } catch (err: any) {
    await supabase.from('import_jobs').update({ status: 'failed' }).eq('id', job_id)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
