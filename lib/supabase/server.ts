import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { readSupabaseEnv } from './env'

import type { Database } from './database.types'

export async function createClient() {
  const { url, anonKey } = readSupabaseEnv()
  const cookieStore = await cookies()

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          return
        }
      },
    },
  })
}
