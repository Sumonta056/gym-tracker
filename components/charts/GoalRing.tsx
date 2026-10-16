import { cn } from '../ui/cn'

import type { DayTone } from './DaySparkline'

export type GoalRingProps = {
  percent: number
  tone: DayTone
}

const RADIUS = 30

const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const STROKE: Record<DayTone, string> = {
  cyan: 'stroke-data-cyan',
  warn: 'stroke-warn',
  violet: 'stroke-data-violet',
}

export function ringFill(percent: number): number {
  return (Math.min(Math.max(percent, 0), 100) / 100) * CIRCUMFERENCE
}

export function GoalRing({ percent, tone }: GoalRingProps) {
  const fill = ringFill(percent)

  return (
    <div data-testid="goal-ring" className="relative size-[72px] shrink-0">
      <svg viewBox="0 0 72 72" aria-hidden="true" className="size-full -rotate-90">
        <circle
          cx="36"
          cy="36"
          r={RADIUS}
          fill="none"
          strokeWidth="7"
          className="stroke-surface-2"
        />
        {fill === 0 ? null : (
          <circle
            data-testid="goal-ring-fill"
            cx="36"
            cy="36"
            r={RADIUS}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${String(fill)} ${String(CIRCUMFERENCE)}`}
            className={cn(STROKE[tone])}
          />
        )}
      </svg>
      <p className="text-text absolute inset-0 grid place-items-center text-[13px] font-extrabold">
        <span>
          {`${String(percent)}%`}
          <span className="sr-only"> of goal</span>
        </span>
      </p>
    </div>
  )
}
