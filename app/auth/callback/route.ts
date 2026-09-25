import { NextResponse } from 'next/server'

import { exchangeCodeForSession } from '../../../lib/auth/session'

import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code === null) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing-code`)
  }

  const exchanged = await exchangeCodeForSession(code)

  if (!exchanged) {
    return NextResponse.redirect(`${origin}/sign-in?error=link-expired`)
  }

  return NextResponse.redirect(`${origin}/`)
}
