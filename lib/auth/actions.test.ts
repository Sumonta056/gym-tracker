import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendMagicLink } from './actions'

type OtpArgs = {
  email: string
  options?: { emailRedirectTo?: string }
}

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  signInWithOtp: vi.fn<(args: OtpArgs) => Promise<{ error: { message: string } | null }>>(),
  get: vi.fn<(name: string) => string | null>(),
}))

vi.mock('../supabase/server', () => ({
  createClient: mocks.createClient,
}))

vi.mock('next/headers', () => ({
  headers: () => Promise.resolve({ get: mocks.get }),
}))

describe('sendMagicLink', () => {
  beforeEach(() => {
    mocks.signInWithOtp.mockReset()
    mocks.signInWithOtp.mockResolvedValue({ error: null })
    mocks.createClient.mockReset()
    mocks.createClient.mockResolvedValue({ auth: { signInWithOtp: mocks.signInWithOtp } })
    mocks.get.mockReset()
    mocks.get.mockReturnValue('https://gym.example')
  })

  it('reports an error and never calls supabase for an invalid address', async () => {
    const result = await sendMagicLink('not-an-email')
    expect(result).toEqual({
      status: 'error',
      message: 'Enter an email address like you@example.com.',
    })
    expect(mocks.signInWithOtp).not.toHaveBeenCalled()
  })

  it('sends the link to the normalised address', async () => {
    const result = await sendMagicLink('  You@Example.com ')
    expect(result).toEqual({ status: 'sent', email: 'you@example.com' })
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: 'you@example.com',
      options: { emailRedirectTo: 'https://gym.example/auth/callback' },
    })
  })

  it('omits the redirect when the request carries no origin', async () => {
    mocks.get.mockReturnValue(null)
    await sendMagicLink('you@example.com')
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: 'you@example.com',
      options: undefined,
    })
  })

  it('reports an error when supabase refuses the send', async () => {
    mocks.signInWithOtp.mockResolvedValue({ error: { message: 'rate limited' } })
    const result = await sendMagicLink('you@example.com')
    expect(result).toEqual({
      status: 'error',
      message: 'The link could not be sent. Check the address and try again.',
    })
  })

  it('reports an error instead of throwing when the supabase keys are missing', async () => {
    mocks.createClient.mockRejectedValue(new Error('NEXT_PUBLIC_SUPABASE_URL is missing'))
    const result = await sendMagicLink('you@example.com')
    expect(result).toEqual({
      status: 'error',
      message: 'The link could not be sent. Check the address and try again.',
    })
  })
})
