'use server'

import { signUpSchema } from '../schema/signUp'
import { createClient } from '../supabase/server'

import { isValidEmail, normaliseEmail } from './email'

import type { SignUpInput } from '../schema/signUp'

export type SendMagicLinkResult =
  { status: 'sent'; email: string } | { status: 'error'; message: string }

export type SignInWithPasswordResult =
  { status: 'signed-in' } | { status: 'error'; message: string }

export type SignUpResult =
  | { status: 'signed-in' }
  | { status: 'exists' }
  | { status: 'needs-code'; email: string }
  | { status: 'error'; message: string }

const INVALID_EMAIL = 'Enter an email address like you@example.com.'
const SEND_FAILED = 'The link could not be sent. Check the address and try again.'
const EMPTY_PASSWORD = 'Enter your password.'
const SIGN_IN_FAILED = 'That email and password do not match.'
const UNKNOWN_EMAIL_CODE = 'otp_disabled'
const WEAK_PASSWORD = 'Use 8 or more characters.'
const RATE_LIMITED = 'Too many tries. Wait a minute and try again.'
const SIGN_UP_FAILED = 'We could not create the account. Try again.'
const EXISTING_USER_CODE = 'user_already_exists'
const WEAK_PASSWORD_CODE = 'weak_password'
const RATE_LIMIT_CODES: readonly string[] = [
  'over_request_rate_limit',
  'over_email_send_rate_limit',
]

function siteOrigin(): string | null {
  try {
    const { origin } = new URL(process.env.SITE_URL ?? '')
    return origin === 'null' ? null : origin
  } catch {
    return null
  }
}

export async function sendMagicLink(email: string): Promise<SendMagicLinkResult> {
  if (!isValidEmail(email)) {
    return { status: 'error', message: INVALID_EMAIL }
  }

  const address = normaliseEmail(email)
  const origin = siteOrigin()

  let supabase
  try {
    supabase = await createClient()
  } catch {
    return { status: 'error', message: SEND_FAILED }
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: address,
    options:
      origin === null
        ? { shouldCreateUser: false }
        : { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback` },
  })

  if (error !== null && error.code !== UNKNOWN_EMAIL_CODE) {
    return { status: 'error', message: SEND_FAILED }
  }

  return { status: 'sent', email: address }
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<SignInWithPasswordResult> {
  if (!isValidEmail(email)) {
    return { status: 'error', message: INVALID_EMAIL }
  }

  if (password === '') {
    return { status: 'error', message: EMPTY_PASSWORD }
  }

  let supabase
  try {
    supabase = await createClient()
  } catch {
    return { status: 'error', message: SIGN_IN_FAILED }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: normaliseEmail(email),
    password,
  })

  if (error !== null) {
    return { status: 'error', message: SIGN_IN_FAILED }
  }

  return { status: 'signed-in' }
}

function signUpRefusal(code: string | undefined): SignUpResult {
  if (code === EXISTING_USER_CODE) {
    return { status: 'exists' }
  }

  if (code === WEAK_PASSWORD_CODE) {
    return { status: 'error', message: WEAK_PASSWORD }
  }

  if (code !== undefined && RATE_LIMIT_CODES.includes(code)) {
    return { status: 'error', message: RATE_LIMITED }
  }

  return { status: 'error', message: SIGN_UP_FAILED }
}

export async function signUp(input: SignUpInput): Promise<SignUpResult> {
  const parsed = signUpSchema.safeParse(input)

  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? SIGN_UP_FAILED }
  }

  const { name, email, password } = parsed.data

  let supabase
  try {
    supabase = await createClient()
  } catch {
    return { status: 'error', message: SIGN_UP_FAILED }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: name } },
  })

  if (error !== null) {
    return signUpRefusal(error.code)
  }

  if (data.session !== null) {
    return { status: 'signed-in' }
  }

  if (data.user !== null) {
    return { status: 'needs-code', email }
  }

  return { status: 'error', message: SIGN_UP_FAILED }
}
