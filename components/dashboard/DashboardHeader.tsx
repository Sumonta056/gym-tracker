import Link from 'next/link'

import { MicroLabel } from '../ui/MicroLabel'

import { NetworkChip } from './NetworkChip'
import { headerDate } from './summary'

export type DashboardHeaderProps = {
  date: string
  displayName: string | null
}

export function initialOf(name: string | null): string {
  const first = name?.trim().charAt(0) ?? ''

  return first === '' ? '☰' : first.toLocaleUpperCase('en-GB')
}

export function DashboardHeader({ date, displayName }: DashboardHeaderProps) {
  const { weekday, dayMonth } = headerDate(date)

  return (
    <header className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <MicroLabel as="p">{weekday}</MicroLabel>
        <h1 className="text-text text-[23px] leading-tight font-bold tracking-[-0.6px]">
          {dayMonth}
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <NetworkChip />
        <Link
          href="/profile"
          aria-label="Profile"
          className="bg-surface-2 border-border text-accent flex size-11 items-center justify-center rounded-full border text-[13px] font-bold"
        >
          <span aria-hidden="true">{initialOf(displayName)}</span>
        </Link>
      </div>
    </header>
  )
}
