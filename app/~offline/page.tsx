import Link from 'next/link'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Offline — Gym Tracker',
}

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 md:px-7">
      <div className="border-border bg-surface rounded-card w-full max-w-md border p-6">
        <p className="text-muted text-[10px] font-bold tracking-[1.5px] uppercase">No signal</p>
        <h1 className="mt-2 text-2xl font-extrabold">You are offline</h1>
        <p className="text-muted mt-3 text-sm leading-relaxed">
          Your data is safe on this phone. Every entry you make now is stored here first.
        </p>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          The app uploads it on its own when the signal comes back. You do not need to do anything.
        </p>
        <Link
          href="/"
          className="bg-accent text-accent-ink rounded-input mt-6 flex h-[54px] items-center justify-center text-base font-bold"
        >
          Back to today
        </Link>
      </div>
    </main>
  )
}
