import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createClient } from './server'

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> }

type CookieHandlers = {
  getAll: () => { name: string; value: string }[]
  setAll: (cookiesToSet: CookieToSet[]) => void
}

type ServerClientOptions = { cookies: CookieHandlers }

const mocks = vi.hoisted(() => ({
  createServerClient:
    vi.fn<(url: string, key: string, options: ServerClientOptions) => { tag: string }>(),
  getAll: vi.fn<() => { name: string; value: string }[]>(),
  set: vi.fn<(name: string, value: string, options?: Record<string, unknown>) => void>(),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: mocks.createServerClient,
}))

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ getAll: mocks.getAll, set: mocks.set }),
}))

function handlers(): CookieHandlers {
  const call = mocks.createServerClient.mock.calls[0]
  if (call === undefined) throw new Error('createServerClient was not called')
  return call[2].cookies
}

describe('createClient', () => {
  beforeEach(() => {
    mocks.createServerClient.mockReset()
    mocks.createServerClient.mockReturnValue({ tag: 'server' })
    mocks.getAll.mockReset()
    mocks.getAll.mockReturnValue([{ name: 'sb-access-token', value: 'token' }])
    mocks.set.mockReset()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  })

  it('builds a server client from the public environment', async () => {
    const client = await createClient()
    expect(mocks.createServerClient.mock.calls[0]?.[0]).toBe('https://example.supabase.co')
    expect(mocks.createServerClient.mock.calls[0]?.[1]).toBe('anon-key')
    expect(client).toEqual({ tag: 'server' })
  })

  it('reads every cookie from the request store', async () => {
    await createClient()
    expect(handlers().getAll()).toEqual([{ name: 'sb-access-token', value: 'token' }])
  })

  it('writes every cookie back to the request store', async () => {
    await createClient()
    handlers().setAll([{ name: 'sb-access-token', value: 'fresh', options: { path: '/' } }])
    expect(mocks.set).toHaveBeenCalledWith('sb-access-token', 'fresh', { path: '/' })
  })

  it('swallows a write from a server component', async () => {
    await createClient()
    mocks.set.mockImplementation(() => {
      throw new Error('Cookies can only be modified in a Server Action or Route Handler')
    })
    expect(() => {
      handlers().setAll([{ name: 'sb-access-token', value: 'fresh' }])
    }).not.toThrow()
  })

  it('throws when the url is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    await expect(createClient()).rejects.toThrow('NEXT_PUBLIC_SUPABASE_URL is missing')
  })
})
