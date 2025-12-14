import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireContext, handleAuthError } from '@/lib/auth/context'

const PatchSchema = z.object({
  status: z.string().optional(),
  snoozed_until: z.string().datetime().nullable().optional(),
  assignee_profile_id: z.string().uuid().nullable().optional(),
  priority: z.string().optional(),
})

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireContext(req)
    const { id } = await params

    const { data, error } = await ctx.supabase
      .from('work_items')
      .select('*')
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ item: data })
  } catch (err) {
    return handleAuthError(err)
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireContext(req)
    const { id } = await params

    const parsed = PatchSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const { data, error } = await ctx.supabase
      .from('work_items')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', ctx.organizationId) // critical scoping
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ item: data })
  } catch (err) {
    return handleAuthError(err)
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireContext(req)
    const { id } = await params

    const { error } = await ctx.supabase
      .from('work_items')
      .delete()
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleAuthError(err)
  }
}
