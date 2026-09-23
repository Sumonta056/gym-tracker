import { beforeEach, describe, expect, it, vi } from 'vitest'

import { readSignedInEmail, SIGN_OUT_FAILED, signOut } from './browser'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('../supabase/client', () => ({
  createClient: mocks.createClient,
}))

beforeEach(() => {
  mocks.getSession.mockReset()
  mocks.signOut.mockReset()
  mocks.createClient.mockReset()
  mocks.createClient.mockReturnValue({
    auth: { getSession: mocks.getSession, signOut: mocks.signOut },
  })
})

describe('readSignedInEmail', () => {
  it('returns the email of the stored session', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { email: 'sam@example.com' } } },
    })

    await expect(readSignedInEmail()).resolves.toBe('sam@example.com')
  })

  it('returns null when no session is stored', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } })

    await expect(readSignedInEmail()).resolves.toBeNull()
  })

  it('returns null when the session user has no email', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: {} } } })

    await expect(readSignedInEmail()).resolves.toBeNull()
  })

  it('returns null when the client cannot be built', async () => {
    mocks.createClient.mockImplementation(() => {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing')
    })

    await expect(readSignedInEmail()).resolves.toBeNull()
  })
})

describe('signOut', () => {
  it('ends the session on this device only', async () => {
    mocks.signOut.mockResolvedValue({ error: null })

    await expect(signOut()).resolves.toEqual({ status: 'signed-out' })
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('reports a failure when the server refuses', async () => {
    mocks.signOut.mockResolvedValue({ error: { message: 'network down' } })

    await expect(signOut()).resolves.toEqual({ status: 'error', message: SIGN_OUT_FAILED })
  })

  it('reports a failure when the call throws', async () => {
    mocks.signOut.mockRejectedValue(new Error('the fetch was aborted'))

    await expect(signOut()).resolves.toEqual({ status: 'error', message: SIGN_OUT_FAILED })
  })
})
