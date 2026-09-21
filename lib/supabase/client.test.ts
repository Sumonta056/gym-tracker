import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createClient } from './client'

const mocks = vi.hoisted(() => ({
  createBrowserClient: vi.fn(() => ({ tag: 'browser' })),
}))

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: mocks.createBrowserClient,
}))

describe('createClient', () => {
  beforeEach(() => {
    mocks.createBrowserClient.mockClear()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  })

  it('builds a browser client from the public environment', () => {
    const client = createClient()
    expect(mocks.createBrowserClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
    )
    expect(client).toEqual({ tag: 'browser' })
  })

  it('throws when the anon key is missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    expect(() => createClient()).toThrow('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing')
  })
})
