import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

import type { Database, Tables, TablesInsert } from '../../../lib/supabase/database.types'
import type { Cookie } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'

export const AUTH_FILE = 'playwright/.auth/session.json'

const COOKIE_DAYS = 400

const CLEAR_ROUNDS = 5

const LATE_WRITE_MS = 750

const CREDENTIALS_HELP =
  'The signed-in end-to-end tests sign in as the test account. Put E2E_EMAIL and E2E_PASSWORD in .env.test.local, or set them in the environment. CI reads them from the repository secrets.'

const SUPABASE_HELP =
  'Put NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, or set them in the environment. CI reads them from the repository secrets.'

export type DailyRow = Tables<'daily_entries'>

export type SeedRow = Omit<TablesInsert<'daily_entries'>, 'id' | 'user_id'>

type Client = SupabaseClient<Database>

type StoredState = { cookies: Cookie[]; origins: unknown[] }

type Session = { access_token: string; user: { id: string } }

function required(name: string, help: string): string {
  const value = process.env[name]

  if (value === undefined || value.trim() === '') {
    throw new Error(`${name} is missing. ${help}`)
  }

  return value
}

function supabaseEnv(): { url: string; anonKey: string } {
  return {
    url: required('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_HELP),
    anonKey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY', SUPABASE_HELP),
  }
}

function credentials(): { email: string; password: string } {
  return {
    email: required('E2E_EMAIL', CREDENTIALS_HELP),
    password: required('E2E_PASSWORD', CREDENTIALS_HELP),
  }
}

export async function signIn(host: string): Promise<Cookie[]> {
  const { url, anonKey } = supabaseEnv()
  const { email, password } = credentials()
  const jar = new Map<string, string>()
  const client = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return [...jar].map(([name, value]) => ({ name, value }))
      },
      setAll(cookies) {
        for (const { name, value } of cookies) {
          if (value === '') {
            jar.delete(name)
          } else {
            jar.set(name, value)
          }
        }
      },
    },
  })

  const { error } = await client.auth.signInWithPassword({ email, password })

  if (error !== null) {
    throw new Error(`The test account could not sign in: ${error.message}. ${CREDENTIALS_HELP}`)
  }

  if (jar.size === 0) {
    throw new Error('The sign in returned no session cookie.')
  }

  const expires = Math.floor(Date.now() / 1000) + COOKIE_DAYS * 86400

  return [...jar].map(([name, value]) => ({
    name,
    value,
    domain: host,
    path: '/',
    expires,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax' as const,
  }))
}

export function saveState(cookies: Cookie[]): void {
  mkdirSync(dirname(AUTH_FILE), { recursive: true })
  writeFileSync(AUTH_FILE, JSON.stringify({ cookies, origins: [] }, null, 2))
}

export function savedCookies(): Cookie[] {
  let text: string

  try {
    text = readFileSync(AUTH_FILE, 'utf8')
  } catch {
    throw new Error(`${AUTH_FILE} is missing. The setup project writes it. Run the full suite.`)
  }

  return (JSON.parse(text) as StoredState).cookies
}

function chunkIndex(name: string): number {
  const match = /\.(\d+)$/.exec(name)

  return match === null ? -1 : Number(match[1])
}

export function sessionOf(cookies: readonly Cookie[]): Session {
  const parts = cookies
    .filter((cookie) => cookie.name.startsWith('sb-') && /-auth-token(\.\d+)?$/.test(cookie.name))
    .sort((left, right) => chunkIndex(left.name) - chunkIndex(right.name))
    .map((cookie) => cookie.value)

  const joined = parts.join('')

  if (!joined.startsWith('base64-')) {
    throw new Error('The session cookie is not in the base64 format @supabase/ssr writes.')
  }

  return JSON.parse(
    Buffer.from(joined.slice('base64-'.length), 'base64url').toString('utf8'),
  ) as Session
}

export class Account {
  readonly userId: string

  private readonly client: Client

  constructor(cookies: readonly Cookie[]) {
    const { url, anonKey } = supabaseEnv()
    const session = sessionOf(cookies)

    this.userId = session.user.id
    this.client = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    })
  }

  async rowsBetween(from: string, to: string): Promise<DailyRow[]> {
    const { data, error } = await this.client
      .from('daily_entries')
      .select('*')
      .gte('entry_date', from)
      .lte('entry_date', to)
      .order('entry_date')

    if (error !== null) {
      throw new Error(`Reading the test rows failed: ${error.message}`)
    }

    return data
  }

  async rowsOn(date: string): Promise<DailyRow[]> {
    return this.rowsBetween(date, date)
  }

  async seed(rows: readonly SeedRow[]): Promise<DailyRow[]> {
    const { data, error } = await this.client
      .from('daily_entries')
      .insert(rows.map((row) => ({ ...row, id: randomUUID(), user_id: this.userId })))
      .select('*')

    if (error !== null) {
      throw new Error(`Seeding the test rows failed: ${error.message}`)
    }

    return data
  }

  async clear(from: string, to: string): Promise<void> {
    for (let round = 0; round < CLEAR_ROUNDS; round += 1) {
      const { error } = await this.client
        .from('daily_entries')
        .delete()
        .gte('entry_date', from)
        .lte('entry_date', to)

      if (error !== null) {
        throw new Error(`Removing the test rows failed: ${error.message}`)
      }

      await new Promise((resolve) => setTimeout(resolve, LATE_WRITE_MS))

      if ((await this.rowsBetween(from, to)).length === 0) {
        return
      }
    }

    throw new Error(`Test rows between ${from} and ${to} survived the teardown.`)
  }
}
