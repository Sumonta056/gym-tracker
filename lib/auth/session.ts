import { createClient } from '../supabase/server'

export async function exchangeCodeForSession(code: string): Promise<boolean> {
  let supabase
  try {
    supabase = await createClient()
  } catch {
    return false
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  return error === null
}
