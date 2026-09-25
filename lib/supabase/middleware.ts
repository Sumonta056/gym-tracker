import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

import { readSupabaseEnv } from './env'

import type { Database } from './database.types'
import type { SupabaseEnv } from './env'
import type { User } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

export type SessionResult = {
  response: NextResponse
  user: User | null
}

function readEnvOrNull(): SupabaseEnv | null {
  try {
    return readSupabaseEnv()
  } catch {
    return null
  }
}

export async function updateSession(request: NextRequest): Promise<SessionResult> {
  const env = readEnvOrNull()

  if (env === null) {
    return { response: NextResponse.next({ request }), user: null }
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  const { data } = await supabase.auth.getUser()

  return { response, user: data.user }
}
