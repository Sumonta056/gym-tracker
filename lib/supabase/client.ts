import { createBrowserClient } from '@supabase/ssr'

import { readSupabaseEnv } from './env'

import type { Database } from './database.types'

export function createClient() {
  const { url, anonKey } = readSupabaseEnv()
  return createBrowserClient<Database>(url, anonKey)
}
