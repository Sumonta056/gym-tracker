import { beforeEach, describe, expect, it, vi } from 'vitest'

import { signInWithPassword, signUp } from './actions'

type PasswordArgs = {
  email: string
  password: string
}

type AuthError = { message: string; code?: string; status?: number }

type SignUpArgs = {
  email: string
  password: string
  options?: { data?: { display_name?: string } }
}

type SignUpResponse = {
  data: { user: { id: string } | null; session: { access_token: string } | null }
  error: AuthError | null
}

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  signInWithPassword:
    vi.fn<(args: PasswordArgs) => Promise<{ error: { message: string } | null }>>(),
  signUp: vi.fn<(args: SignUpArgs) => Promise<SignUpResponse>>(),
}))

vi.mock('../supabase/server', () => ({
  createClient: mocks.createClient,
}))

describe('signInWithPassword', () => {
  beforeEach(() => {
    mocks.signInWithPassword.mockReset()
    mocks.signInWithPassword.mockResolvedValue({ error: null })
    mocks.createClient.mockReset()
    mocks.createClient.mockResolvedValue({
      auth: { signInWithPassword: mocks.signInWithPassword },
    })
  })

  it('signs in with the normalised address and the password as typed', async () => {
    const result = await signInWithPassword('  You@Example.com ', ' Secret 1 ')
    expect(result).toEqual({ status: 'signed-in' })
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'you@example.com',
      password: ' Secret 1 ',
    })
  })

  it('reports an error and never calls supabase for an invalid address', async () => {
    const result = await signInWithPassword('not-an-email', 'secret')
    expect(result).toEqual({
      status: 'error',
      message: 'Enter an email address like you@example.com.',
    })
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it('reports an error and never calls supabase for an empty password', async () => {
    const result = await signInWithPassword('you@example.com', '')
    expect(result).toEqual({ status: 'error', message: 'Enter your password.' })
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it('reports one generic message when supabase refuses the credentials', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    const result = await signInWithPassword('you@example.com', 'wrong')
    expect(result).toEqual({
      status: 'error',
      message: 'That email and password do not match.',
    })
  })

  it('reports an error instead of throwing when the supabase keys are missing', async () => {
    mocks.createClient.mockRejectedValue(new Error('NEXT_PUBLIC_SUPABASE_URL is missing'))
    const result = await signInWithPassword('you@example.com', 'secret')
    expect(result).toEqual({
      status: 'error',
      message: 'That email and password do not match.',
    })
  })
})

describe('signUp', () => {
  const input = { name: '  Sam  ', email: '  You@Example.com ', password: 'secret12' }

  function refusal(code: string, status: number): SignUpResponse {
    return { data: { user: null, session: null }, error: { message: code, code, status } }
  }

  beforeEach(() => {
    mocks.signUp.mockReset()
    mocks.signUp.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: { access_token: 'token' } },
      error: null,
    })
    mocks.createClient.mockReset()
    mocks.createClient.mockResolvedValue({ auth: { signUp: mocks.signUp } })
  })

  it('sends the name as display_name metadata', async () => {
    await signUp(input)
    expect(mocks.signUp).toHaveBeenCalledOnce()
    expect(mocks.signUp.mock.calls[0]?.[0].options).toEqual({ data: { display_name: 'Sam' } })
  })

  it('normalises the email before it calls Supabase', async () => {
    await signUp(input)
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: 'you@example.com',
      password: 'secret12',
      options: { data: { display_name: 'Sam' } },
    })
  })

  it('returns signed-in when Supabase returns a session', async () => {
    expect(await signUp(input)).toEqual({ status: 'signed-in' })
  })

  it('returns needs-code when Supabase returns a user and no session', async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: null },
      error: null,
    })
    expect(await signUp(input)).toEqual({ status: 'needs-code', email: 'you@example.com' })
  })

  it('returns exists for an email that has an account', async () => {
    mocks.signUp.mockResolvedValue(refusal('user_already_exists', 422))
    expect(await signUp(input)).toEqual({ status: 'exists' })
  })

  it('returns an error with the password hint for a weak password', async () => {
    mocks.signUp.mockResolvedValue(refusal('weak_password', 422))
    expect(await signUp(input)).toEqual({ status: 'error', message: 'Use 8 or more characters.' })
  })

  it.each([
    ['over_request_rate_limit', 429],
    ['over_email_send_rate_limit', 429],
  ])('returns an error for a rate limit (%s)', async (code, status) => {
    mocks.signUp.mockResolvedValue(refusal(code, status))
    expect(await signUp(input)).toEqual({
      status: 'error',
      message: 'Too many tries. Wait a minute and try again.',
    })
  })

  it('returns an error for any other failure', async () => {
    mocks.signUp.mockResolvedValue(refusal('signup_disabled', 422))
    expect(await signUp(input)).toEqual({
      status: 'error',
      message: 'We could not create the account. Try again.',
    })
  })

  it('returns an error when Supabase returns neither a user nor an error', async () => {
    mocks.signUp.mockResolvedValue({ data: { user: null, session: null }, error: null })
    expect(await signUp(input)).toEqual({
      status: 'error',
      message: 'We could not create the account. Try again.',
    })
  })

  it('returns an error instead of throwing when the supabase keys are missing', async () => {
    mocks.createClient.mockRejectedValue(new Error('NEXT_PUBLIC_SUPABASE_URL is missing'))
    expect(await signUp(input)).toEqual({
      status: 'error',
      message: 'We could not create the account. Try again.',
    })
  })

  it('refuses input that fails the schema with no Supabase call', async () => {
    const result = await signUp({ ...input, password: 'short' })
    expect(result).toEqual({ status: 'error', message: 'Use 8 or more characters.' })
    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(mocks.signUp).not.toHaveBeenCalled()
  })
})
