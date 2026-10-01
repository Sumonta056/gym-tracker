'use server'

import { createClient } from '../supabase/server'

import { isValidEmail, normaliseEmail } from './email'

export type SendMagicLinkResult =
  { status: 'sent'; email: string } | { status: 'error'; message: string }

export type SignInWithPasswordResult =
  { status: 'signed-in' } | { status: 'error'; message: string }

const INVALID_EMAIL = 'Enter an email address like you@example.com.'
const SEND_FAILED = 'The link could not be sent. Check the address and try again.'
const EMPTY_PASSWORD = 'Enter your password.'
const SIGN_IN_FAILED = 'That email and password do not match.'
const UNKNOWN_EMAIL_CODE = 'otp_disabled'

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
