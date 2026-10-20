'use client'

import Link from 'next/link'

import { formatDuration } from '../../lib/duration'
import { elapsedSeconds, systemNow, useTick } from '../workout/SessionTimer'

export const LEAVE_LABEL = 'Leave to Workouts'

export const BACK_LABEL = 'Previous step'

export const FINISH_LABEL = 'Finish'

const CORNER =
  'bg-surface-2 border-border text-text inline-flex size-11 items-center justify-center rounded-xl border text-lg font-bold'

export function stepCountText(index: number, total: number): string {
  return `Step ${String(index + 1)} of ${String(total)}`
}

export function stepJumpLabel(index: number, total: number, seconds: number): string {
  return `${stepCountText(index, total)}, elapsed ${formatDuration(seconds, 'spoken')}, open the step list`
}

export type PlanStepHeaderProps = {
  title: string
  stepIndex: number
  total: number
  startedAt: string
  leaveHref: string
  now?: () => Date
  busy?: boolean
  onBack: () => void
  onOpenList: () => void
  onFinish: () => void
}

export function PlanStepHeader({
  title,
  stepIndex,
  total,
  startedAt,
  leaveHref,
  now = systemNow,
  busy = false,
  onBack,
  onOpenList,
  onFinish,
}: PlanStepHeaderProps) {
  const seconds = elapsedSeconds(startedAt, useTick(now))

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
      <div className="grid min-w-0 justify-items-center text-center">
        <p className="text-text max-w-full text-[15px] font-bold break-words">{title}</p>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={stepJumpLabel(stepIndex, total, seconds)}
          onClick={onOpenList}
          className="text-muted inline-flex min-h-11 max-w-full flex-wrap items-center justify-center gap-x-[5px] rounded-full px-2 text-[13px] font-bold"
        >
          <span className="whitespace-nowrap">{`${stepCountText(stepIndex, total)} ·`}</span>
          <span className="whitespace-nowrap">
            <span data-testid="step-elapsed" className="text-accent text-sm font-extrabold">
              {formatDuration(seconds, 'clock')}
            </span>
            <span aria-hidden="true"> ▾</span>
          </span>
        </button>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onFinish}
        className="bg-surface-2 border-border text-text min-h-11 rounded-xl border px-3.5 text-sm font-bold disabled:opacity-50"
      >
        {FINISH_LABEL}
      </button>
    </header>
  )
}
