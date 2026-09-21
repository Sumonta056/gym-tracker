export type SupabaseEnv = {
  url: string
  anonKey: string
}

export function readSupabaseEnv(
  source: Record<string, string | undefined> = process.env,
): SupabaseEnv {
  const url = source.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = source.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (url === undefined || url === '') {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing')
  }

  if (anonKey === undefined || anonKey === '') {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing')
  }

  return { url, anonKey }
}
