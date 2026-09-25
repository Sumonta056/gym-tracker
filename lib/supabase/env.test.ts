import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { publicEnv, readSupabaseEnv } from './env'

describe('readSupabaseEnv', () => {
  it('returns the url and the anon key', () => {
    expect(
      readSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      }),
    ).toEqual({ url: 'https://example.supabase.co', anonKey: 'anon-key' })
  })

  it('throws when the url is missing', () => {
    expect(() => readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key' })).toThrow(
      'NEXT_PUBLIC_SUPABASE_URL is missing',
    )
  })

  it('throws when the url is an empty string', () => {
    expect(() =>
      readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key' }),
    ).toThrow('NEXT_PUBLIC_SUPABASE_URL is missing')
  })

  it('throws when the anon key is missing', () => {
    expect(() =>
      readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }),
    ).toThrow('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing')
  })

  it('throws when the anon key is an empty string', () => {
    expect(() =>
      readSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
      }),
    ).toThrow('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing')
  })

  it('reads process.env when no source is given', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://from-process.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'from-process'
    expect(readSupabaseEnv()).toEqual({
      url: 'https://from-process.supabase.co',
      anonKey: 'from-process',
    })
  })

  it('names each public variable in full, so Next inlines it into the browser bundle', () => {
    const source = readFileSync(new URL('./env.ts', import.meta.url), 'utf8')

    expect(source).toContain('process.env.NEXT_PUBLIC_SUPABASE_URL')
    expect(source).toContain('process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY')
    expect(source).not.toMatch(/=\s*process\.env,/)
  })
})

describe('publicEnv', () => {
  it('holds only the two public Supabase variables', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://from-process.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'from-process'

    expect(publicEnv()).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: 'https://from-process.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'from-process',
    })
  })
})
