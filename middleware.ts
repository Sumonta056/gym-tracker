import { NextResponse } from 'next/server'

import { updateSession } from './lib/supabase/middleware'

import type { NextRequest } from 'next/server'

export const PUBLIC_PATHS = ['/sign-in', '/auth/callback', '/styleguide', '/~offline']

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function redirectTo(request: NextRequest, pathname: string, carry: NextResponse): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  const redirect = NextResponse.redirect(url)
  for (const cookie of carry.cookies.getAll()) {
    redirect.cookies.set(cookie)
  }
  return redirect
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { response, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  if (user === null && !isPublicPath(pathname)) {
    return redirectTo(request, '/sign-in', response)
  }

  if (user !== null && pathname === '/sign-in') {
    return redirectTo(request, '/', response)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|json|js|map)$).*)',
  ],
}
