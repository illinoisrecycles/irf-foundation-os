import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/auth/password-reset - Request password reset
export async function POST(req: Request) {
  const supabase = await createClient()
  const { email } = await req.json()

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  })

  if (error) {
    // Don't reveal if email exists
    console.error('Password reset error:', error)
  }

  // Always return success to prevent email enumeration
  return NextResponse.json({ 
    success: true,
    message: 'If an account exists with this email, you will receive a reset link.'
  })
}
