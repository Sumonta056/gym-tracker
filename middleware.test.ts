import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { isPublicPath, middleware } from './middleware'

type FakeUser = { id: string }

const mocks = vi.hoisted(() => ({
  updateSession:
    vi.fn<(request: NextRequest) => Promise<{ response: NextResponse; user: FakeUser | null }>>(),
}))

vi.mock('./lib/supabase/middleware', () => ({
  updateSession: mocks.updateSession,
}))

function session(user: FakeUser | null, cookies: { name: string; value: string }[] = []) {
  const response = NextResponse.next()
  for (const cookie of cookies) {
    response.cookies.set(cookie.name, cookie.value)
  }
  return { response, user }
}

describe('isPublicPath', () => {
  it('lets an anonymous visitor reach the sign in screen', () => {
    expect(isPublicPath('/sign-in')).toBe(true)
  })

  it('lets an anonymous visitor reach the callback', () => {
    expect(isPublicPath('/auth/callback')).toBe(true)
  })

  it('lets an anonymous visitor reach a path under a public prefix', () => {
    expect(isPublicPath('/styleguide/extra')).toBe(true)
  })

  it('does not treat the dashboard as public', () => {
    expect(isPublicPath('/')).toBe(false)
  })

  it('does not treat a prefix collision as public', () => {
    expect(isPublicPath('/sign-in-secrets')).toBe(false)
  })
})

describe('middleware', () => {
  beforeEach(() => {
    mocks.updateSession.mockReset()
  })

  it('redirects an anonymous visitor from the dashboard to the sign in screen', async () => {
    mocks.updateSession.mockResolvedValue(session(null))
    const response = await middleware(new NextRequest('https://gym.example/'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://gym.example/sign-in')
  })

  it('carries the refreshed cookies onto the redirect', async () => {
    mocks.updateSession.mockResolvedValue(session(null, [{ name: 'sb-token', value: 'fresh' }]))
    const response = await middleware(new NextRequest('https://gym.example/'))
    expect(response.cookies.get('sb-token')?.value).toBe('fresh')
  })

  it('lets an anonymous visitor through to the sign in screen', async () => {
    mocks.updateSession.mockResolvedValue(session(null))
    const response = await middleware(new NextRequest('https://gym.example/sign-in'))
    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('lets a signed in user through to the dashboard', async () => {
    mocks.updateSession.mockResolvedValue(session({ id: 'user-1' }))
    const response = await middleware(new NextRequest('https://gym.example/'))
    expect(response.status).toBe(200)
  })

  it('sends a signed in user away from the sign in screen', async () => {
    mocks.updateSession.mockResolvedValue(session({ id: 'user-1' }))
    const response = await middleware(new NextRequest('https://gym.example/sign-in'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://gym.example/')
  })

  it('drops the query string when it redirects', async () => {
    mocks.updateSession.mockResolvedValue(session(null))
    const response = await middleware(new NextRequest('https://gym.example/analytics?range=week'))
    expect(response.headers.get('location')).toBe('https://gym.example/sign-in')
  })
})
