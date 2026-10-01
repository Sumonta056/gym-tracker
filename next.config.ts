import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  turbopack: {
    root: import.meta.dirname,
  },
  headers() {
    return Promise.resolve([{ source: '/:path*', headers: securityHeaders }])
  },
}

export default nextConfig
