'use server'

import { headers } from 'next/headers'

import { createClient } from '../supabase/server'

import { isValidEmail, normaliseEmail } from './email'

export type SendMagicLinkResult =
  { status: 'sent'; email: string } | { status: 'error'; message: string }

const INVALID_EMAIL = 'Enter an email address like you@example.com.'
const SEND_FAILED = 'The link could not be sent. Check the address and try again.'

export async function sendMagicLink(email: string): Promise<SendMagicLinkResult> {
  if (!isValidEmail(email)) {
    return { status: 'error', message: INVALID_EMAIL }
  }

  const address = normaliseEmail(email)
  const origin = (await headers()).get('origin')

  let supabase
  try {
    supabase = await createClient()
  } catch {
    return { status: 'error', message: SEND_FAILED }
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: address,
    options: origin === null ? undefined : { emailRedirectTo: `${origin}/auth/callback` },
  })

  if (error !== null) {
    return { status: 'error', message: SEND_FAILED }
  }

  return { status: 'sent', email: address }
}
