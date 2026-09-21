import { beforeEach, describe, expect, it, vi } from 'vitest'

import { exchangeCodeForSession } from './session'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  exchangeCodeForSession: vi.fn<(code: string) => Promise<{ error: { message: string } | null }>>(),
}))

vi.mock('../supabase/server', () => ({
  createClient: mocks.createClient,
}))

describe('exchangeCodeForSession', () => {
  beforeEach(() => {
    mocks.exchangeCodeForSession.mockReset()
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null })
    mocks.createClient.mockReset()
    mocks.createClient.mockResolvedValue({
      auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
    })
  })

  it('returns true when the code is exchanged', async () => {
    await expect(exchangeCodeForSession('a-code')).resolves.toBe(true)
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith('a-code')
  })

  it('returns false when supabase rejects the code', async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: { message: 'expired' } })
    await expect(exchangeCodeForSession('a-code')).resolves.toBe(false)
  })

  it('returns false instead of throwing when the supabase keys are missing', async () => {
    mocks.createClient.mockRejectedValue(new Error('NEXT_PUBLIC_SUPABASE_URL is missing'))
    await expect(exchangeCodeForSession('a-code')).resolves.toBe(false)
  })
})
