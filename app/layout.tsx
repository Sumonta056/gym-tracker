import { SerwistProvider } from '@serwist/next/react'
import { Figtree } from 'next/font/google'

import './globals.css'

import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-figtree',
})

export const metadata: Metadata = {
  applicationName: 'Gym Tracker',
  title: 'Gym Tracker',
  description: 'A personal gym log that works offline.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Gym Tracker',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#0B0B0D',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={figtree.variable}>
      <body className="bg-ground text-text font-sans [font-variant-numeric:tabular-nums]">
        <SerwistProvider swUrl="/sw.js" disable={process.env.NODE_ENV === 'development'}>
          {children}
        </SerwistProvider>
      </body>
    </html>
  )
}
