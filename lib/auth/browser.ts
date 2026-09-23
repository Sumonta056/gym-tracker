import { createClient } from '../supabase/client'

export type SignOutResult = { status: 'signed-out' } | { status: 'error'; message: string }

export const SIGN_OUT_FAILED =
  'This device is cleared, but the sign-out did not reach the server. Try again when online.'

export async function readSignedInEmail(): Promise<string | null> {
  try {
    const { data } = await createClient().auth.getSession()

    return data.session?.user.email ?? null
  } catch {
    return null
  }
}

export async function signOut(): Promise<SignOutResult> {
  try {
    const { error } = await createClient().auth.signOut({ scope: 'local' })

    return error === null ? { status: 'signed-out' } : { status: 'error', message: SIGN_OUT_FAILED }
  } catch {
    return { status: 'error', message: SIGN_OUT_FAILED }
  }
}
