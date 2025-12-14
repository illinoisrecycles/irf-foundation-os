import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireOrgContext } from '@/lib/auth/org-context'

// GET /api/settings - Get organization settings
export async function GET(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)

  const { data: settings, error } = await supabase
    .from('organizations')
    .select(`
      id, name, slug, logo_url, brand_color, secondary_color,
      tax_id, fiscal_year_start, timezone, address,
      contact_email, contact_phone, website_url, social_links,
      features_enabled, email_settings,
      stripe_account_id, stripe_onboarding_complete
    `)
    .eq('id', org.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ settings })
}

// PATCH /api/settings - Update organization settings
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const org = await requireOrgContext(req)
  const body = await req.json()

  // Allowed fields to update
  const allowedFields = [
    'name', 'logo_url', 'brand_color', 'secondary_color',
    'tax_id', 'fiscal_year_start', 'timezone', 'address',
    'contact_email', 'contact_phone', 'website_url', 'social_links',
    'features_enabled', 'email_settings'
  ]

  const updates: Record<string, any> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', org.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ settings: data })
}
