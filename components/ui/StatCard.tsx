import { Card } from './Card'
import { cn } from './cn'
import { MicroLabel } from './MicroLabel'
import { StatIcon } from './StatIcon'

import type { StatIconName } from './StatIcon'
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
  icon?: StatIconName
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

const TEXT_TONE: Record<StatCardTone, string> = {
  accent: 'text-accent',
  cyan: 'text-data-cyan',
  violet: 'text-data-violet',
  warn: 'text-warn',
  danger: 'text-danger',
  ok: 'text-ok',
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
  icon,
  className,
}: StatCardProps) {
  const hasSparkline = sparkline !== undefined && sparkline.length > 0

  return (
    <Card className={cn('@container flex flex-col gap-2', className)}>
      <div className="flex items-center gap-1.5">
        {icon === undefined ? null : <StatIcon name={icon} className={TEXT_TONE[tone]} />}
        <MicroLabel>{label}</MicroLabel>
      </div>
      <div
        data-testid="stat-body"
        className={cn(
          'flex flex-col gap-2',
          hasSparkline && '@2xs:grid @2xs:grid-cols-[auto_1fr] @2xs:items-end @2xs:gap-4',
        )}
      >
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-text flex min-w-0 flex-wrap items-baseline gap-1 text-[25px] leading-none font-bold tracking-[-0.9px]">
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
              aria-valuenow={Math.round(Math.min(Math.max(progress, 0), 1) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="bg-surface-2 h-[5px] w-full overflow-hidden rounded-full"
            >
              <div
                className={cn('h-full rounded-full', BAR_TONE[tone])}
                style={{
                  width: `${String(Math.round(Math.min(Math.max(progress, 0), 1) * 100))}%`,
                }}
              />
            </div>
          )}
        </div>
        {!hasSparkline ? null : (
          <>
            <svg
              viewBox="0 0 100 32"
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
              className="h-8 w-full @2xs:h-11"
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
      </div>
    </Card>
  )
}
