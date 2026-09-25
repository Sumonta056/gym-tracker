export type SupabaseEnv = {
  url: string
  anonKey: string
}

export function publicEnv(): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
}

export function readSupabaseEnv(
  source: Record<string, string | undefined> = publicEnv(),
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
