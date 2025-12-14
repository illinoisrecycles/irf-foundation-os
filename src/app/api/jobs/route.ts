import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const orgId = url.searchParams.get('orgId') || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || ''
  const status = url.searchParams.get('status')
  const isPublic = url.searchParams.get('public') === 'true'

  const supabase = createAdminClient()

  let query = supabase
    .from('job_postings')
    .select('*')
    .order('created_at', { ascending: false })

  if (!isPublic && orgId) {
    query = query.eq('organization_id', orgId)
  }

  if (status) {
    query = query.eq('status', status)
  } else if (isPublic) {
    query = query.eq('status', 'published')
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ jobs: [], error: error.message }, { status: 500 })
  }

  return NextResponse.json({ jobs: data || [] })
}

export async function POST(req: Request) {
  const body = await req.json()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('job_postings')
    .insert({
      organization_id: body.organization_id || process.env.NEXT_PUBLIC_DEFAULT_ORG_ID,
      posted_by_member_id: body.posted_by_member_id || null,
      title: body.title,
      company_name: body.company_name,
      company_logo_url: body.company_logo_url || null,
      description: body.description,
      requirements: body.requirements || null,
      responsibilities: body.responsibilities || null,
      job_type: body.job_type || 'full_time',
      experience_level: body.experience_level || null,
      category: body.category || null,
      location: body.location || null,
      city: body.city || null,
      state: body.state || null,
      is_remote: body.is_remote || false,
      remote_type: body.remote_type || null,
      salary_min: body.salary_min || null,
      salary_max: body.salary_max || null,
      salary_type: body.salary_type || 'annual',
      show_salary: body.show_salary ?? true,
      benefits: body.benefits || null,
      application_url: body.application_url || null,
      application_email: body.application_email || null,
      application_instructions: body.application_instructions || null,
      status: body.status || 'draft',
      expires_at: body.expires_at || null,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ job: data })
}
