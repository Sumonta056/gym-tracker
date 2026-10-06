'use client'

import { Figtree } from 'next/font/google'

import { ErrorScreen } from '../components/errors/ErrorScreen'

import './globals.css'

const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-figtree',
})

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en" className={figtree.variable}>
      <body className="bg-ground text-text font-sans [font-variant-numeric:tabular-nums]">
        <main className="px-5 pt-[calc(env(safe-area-inset-top)+40px)] pb-10 md:px-7">
          <ErrorScreen error={error} />
        </main>
      </body>
    </html>
  )
}
