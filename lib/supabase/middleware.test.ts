import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { updateSession } from './middleware'

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> }

type CookieHandlers = {
  getAll: () => { name: string; value: string }[]
  setAll: (cookiesToSet: CookieToSet[]) => void
}

type ServerClientOptions = { cookies: CookieHandlers }

type FakeUser = { id: string }

type FakeClient = { auth: { getUser: () => Promise<{ data: { user: FakeUser | null } }> } }

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn<(url: string, key: string, options: ServerClientOptions) => unknown>(),
  getUser: vi.fn<() => Promise<{ data: { user: FakeUser | null } }>>(),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: mocks.createServerClient,
}))

function handlers(): CookieHandlers {
  const call = mocks.createServerClient.mock.calls[0]
  if (call === undefined) throw new Error('createServerClient was not called')
  return call[2].cookies
}

describe('updateSession', () => {
  beforeEach(() => {
    mocks.getUser.mockReset()
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    mocks.createServerClient.mockReset()
    mocks.createServerClient.mockImplementation((): FakeClient => ({
      auth: { getUser: mocks.getUser },
    }))
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  })

  it('refreshes the session on every request', async () => {
    const request = new NextRequest('https://gym.example/today')
    const { response } = await updateSession(request)
    expect(mocks.getUser).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
  })

  it('returns the signed in user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const request = new NextRequest('https://gym.example/today')
    const { user } = await updateSession(request)
    expect(user).toEqual({ id: 'user-1' })
  })

  it('returns no user when nobody is signed in', async () => {
    const request = new NextRequest('https://gym.example/today')
    const { user } = await updateSession(request)
    expect(user).toBeNull()
  })

  it('reads every cookie from the request', async () => {
    const request = new NextRequest('https://gym.example/today', {
      headers: { cookie: 'sb-access-token=token' },
    })
    await updateSession(request)
    expect(handlers().getAll()).toEqual([{ name: 'sb-access-token', value: 'token' }])
  })

  it('writes a refreshed cookie onto the request and the response', async () => {
    const request = new NextRequest('https://gym.example/today')
    await updateSession(request)
    handlers().setAll([{ name: 'sb-access-token', value: 'fresh', options: { path: '/' } }])
    expect(request.cookies.get('sb-access-token')?.value).toBe('fresh')
  })

  it('treats a missing anon key as no session instead of throwing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const request = new NextRequest('https://gym.example/today')
    const { response, user } = await updateSession(request)
    expect(user).toBeNull()
    expect(response.status).toBe(200)
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it('treats a missing url as no session instead of throwing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    const request = new NextRequest('https://gym.example/today')
    const { user } = await updateSession(request)
    expect(user).toBeNull()
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })
})
