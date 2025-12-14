import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Create a Supabase admin client (bypasses RLS)
 * Only use in trusted server-side code!
 * This module can only be imported from server-side code.
 */
export function createAdminSupabase() {
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Alias for backwards compatibility
export const createAdminClient = createAdminSupabase
