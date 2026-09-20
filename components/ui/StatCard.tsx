import { Card } from './Card'
import { cn } from './cn'
import { MicroLabel } from './MicroLabel'

import type { ReactNode } from 'react'

export type StatCardTone = 'accent' | 'cyan' | 'violet' | 'warn' | 'danger' | 'ok'

export type StatCardProps = {
  label: string
  value: ReactNode
  unit?: string
  hint?: string
  progress?: number
  sparkline?: number[]
  tone?: StatCardTone
  className?: string
}

const BAR_TONE: Record<StatCardTone, string> = {
  accent: 'bg-accent',
  cyan: 'bg-data-cyan',
  violet: 'bg-data-violet',
  warn: 'bg-warn',
  danger: 'bg-danger',
  ok: 'bg-ok',
}

const STROKE_TONE: Record<StatCardTone, string> = {
  accent: 'stroke-accent',
  cyan: 'stroke-data-cyan',
  violet: 'stroke-data-violet',
  warn: 'stroke-warn',
  danger: 'stroke-danger',
  ok: 'stroke-ok',
}

function toPoints(values: number[]): string {
  const highest = Math.max(...values)
  const lowest = Math.min(...values)
  const span = highest - lowest || 1
  const step = values.length > 1 ? 100 / (values.length - 1) : 0

  return values
    .map((value, index) => `${String(index * step)},${String(28 - ((value - lowest) / span) * 24)}`)
    .join(' ')
}

export function StatCard({
  label,
  value,
  unit,
  hint,
  progress,
  sparkline,
  tone = 'accent',
  className,
}: StatCardProps) {
  return (
    <Card className={cn('flex flex-col gap-2', className)}>
      <MicroLabel>{label}</MicroLabel>
      <p className="text-text flex items-baseline gap-1 text-[25px] leading-none font-extrabold">
        <span>{value}</span>
        {unit === undefined ? null : (
          <span className="text-muted text-xs font-semibold">{unit}</span>
        )}
      </p>
      {hint === undefined ? null : <p className="text-muted text-xs">{hint}</p>}
      {progress === undefined ? null : (
        <div
          role="progressbar"
          aria-label={`${label} progress`}
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="bg-surface-2 h-1.5 w-full overflow-hidden rounded-full"
        >
          <div
            className={cn('h-full rounded-full', BAR_TONE[tone])}
            style={{ width: `${String(Math.round(Math.min(Math.max(progress, 0), 1) * 100))}%` }}
          />
        </div>
      )}
      {sparkline === undefined || sparkline.length === 0 ? null : (
        <>
          <svg
            viewBox="0 0 100 32"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
            className="h-8 w-full"
          >
            <polyline
              points={toPoints(sparkline)}
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className={STROKE_TONE[tone]}
            />
          </svg>
          <p className="sr-only">{`${label} series: ${sparkline.join(', ')}`}</p>
        </>
      )}
    </Card>
  )
}
