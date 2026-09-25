import Link from 'next/link'

import { Card } from '../../components/ui/Card'
import { MicroLabel } from '../../components/ui/MicroLabel'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Offline — Gym Tracker',
}

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 md:px-7">
      <Card className="w-full max-w-md">
        <MicroLabel as="p">No signal</MicroLabel>
        <h1 className="mt-2 text-[23px] leading-tight font-bold tracking-[-0.6px]">
          You are offline
        </h1>
        <p className="text-muted mt-3 text-sm leading-relaxed">
          Your data is safe on this phone. Every entry you make now is stored here first.
        </p>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          The app uploads it on its own when the signal comes back. You do not need to do anything.
        </p>
        <Link
          href="/"
          className="bg-accent text-accent-ink border-accent rounded-input mt-6 flex min-h-[54px] items-center justify-center gap-2 border px-4 text-[15px] font-bold tracking-[-0.2px]"
        >
          Back to today
        </Link>
      </Card>
    </main>
  )
}
