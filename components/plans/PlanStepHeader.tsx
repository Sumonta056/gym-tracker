'use client'

import Link from 'next/link'
import { useId } from 'react'

import { SessionTimer, systemNow } from '../workout/SessionTimer'

export const LEAVE_LABEL = 'Leave to Workouts'

export const BACK_LABEL = 'Previous step'

const CORNER =
  'bg-surface-2 border-border text-text inline-flex size-11 items-center justify-center rounded-xl border text-lg font-bold'

export function stepCountText(index: number, total: number, group: string): string {
  return `Step ${String(index + 1)} of ${String(total)} · ${group}`
}

export type PlanStepHeaderProps = {
  title: string
  stepIndex: number
  total: number
  group: string
  startedAt: string
  leaveHref: string
  now?: () => Date
  busy?: boolean
  onBack: () => void
}

export function PlanStepHeader({
  title,
  stepIndex,
  total,
  group,
  startedAt,
  leaveHref,
  now = systemNow,
  busy = false,
  onBack,
}: PlanStepHeaderProps) {
  const elapsedId = useId()

  return (
    <header className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2">
      {stepIndex === 0 ? (
        <Link href={leaveHref} aria-label={LEAVE_LABEL} className={CORNER}>
          <span aria-hidden="true">‹</span>
        </Link>
      ) : (
        <button
          type="button"
          aria-label={BACK_LABEL}
          disabled={busy}
          onClick={onBack}
          className={CORNER}
        >
          <span aria-hidden="true">‹</span>
        </button>
      )}
      <div className="min-w-0 text-center">
        <p className="text-text text-[15px] font-bold break-words">{title}</p>
        <p className="text-muted text-xs">{stepCountText(stepIndex, total, group)}</p>
      </div>
      <div className="text-muted text-right text-xs">
        <span id={elapsedId}>Elapsed</span>
        <SessionTimer
          startedAt={startedAt}
          now={now}
          aria-labelledby={elapsedId}
          className="text-accent text-base font-bold"
        />
      </div>
    </header>
  )
}
