import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

// Environment variables for browser
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Create a Supabase client for use in the browser (Client Components)
 * This module is safe to import from client components.
 */
export function createBrowserSupabase() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}

// Alias for backwards compatibility
export const createClient = createBrowserSupabase
