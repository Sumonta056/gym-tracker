import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from './route'

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn<(code: string) => Promise<boolean>>(),
}))

vi.mock('../../../lib/auth/session', () => ({
  exchangeCodeForSession: mocks.exchangeCodeForSession,
}))

describe('the auth callback route', () => {
  beforeEach(() => {
    mocks.exchangeCodeForSession.mockReset()
    mocks.exchangeCodeForSession.mockResolvedValue(true)
  })

  it('exchanges the code and redirects to the dashboard', async () => {
    const response = await GET(new NextRequest('https://gym.example/auth/callback?code=abc'))
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith('abc')
    expect(response.headers.get('location')).toBe('https://gym.example/')
  })

  it('returns to the sign in screen when the link carries no code', async () => {
    const response = await GET(new NextRequest('https://gym.example/auth/callback'))
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe('https://gym.example/sign-in?error=missing-code')
  })

  it('returns to the sign in screen when the exchange fails', async () => {
    mocks.exchangeCodeForSession.mockResolvedValue(false)
    const response = await GET(new NextRequest('https://gym.example/auth/callback?code=stale'))
    expect(response.headers.get('location')).toBe('https://gym.example/sign-in?error=link-expired')
  })
})
