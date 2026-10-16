import { cn } from '../ui/cn'

import { dayTick } from './rangeData'

export type DayTone = 'cyan' | 'warn' | 'violet'

export type SparkPoint = {
  date: string
  value: number | null
}

export type DaySparklineProps = {
  name: string
  points: SparkPoint[]
  variant: 'bars' | 'line'
  tone: DayTone
  formatValue: (value: number) => string
  goal?: number | null
}

const FULL: Record<DayTone, string> = {
  cyan: 'bg-data-cyan',
  warn: 'bg-warn',
  violet: 'bg-data-violet',
}

const FADED: Record<DayTone, string> = {
  cyan: 'bg-data-cyan/30',
  warn: 'bg-warn/30',
  violet: 'bg-data-violet/30',
}

const STROKE: Record<DayTone, string> = {
  cyan: 'stroke-data-cyan',
  warn: 'stroke-warn',
  violet: 'stroke-data-violet',
}

const RING: Record<DayTone, string> = {
  cyan: 'border-data-cyan',
  warn: 'border-warn',
  violet: 'border-data-violet',
}

const HEADROOM = 1.1

const LINE_PAD = 0.4

export function dayLetter(date: string): string {
  return dayTick(date, 'week').slice(0, 1)
}

export function spokenDay(date: string, last: boolean): string {
  return last ? 'Today' : dayTick(date, 'day')
}

export function barTop(points: readonly SparkPoint[], goal: number | null): number {
  const values = points.map((point) => point.value ?? 0)

  return Math.max(...values, goal ?? 0) * HEADROOM
}

export function lineRange(values: readonly number[]): { low: number; high: number } {
  const low = Math.min(...values)
  const high = Math.max(...values)
  const pad = Math.max((high - low) * 0.25, LINE_PAD)

  return { low: low - pad, high: high + pad }
}

export function slotCentre(index: number, count: number): number {
  return ((index + 0.5) / count) * 100
}

function percentOf(value: number, top: number): number {
  return top <= 0 ? 0 : (value / top) * 100
}

function Bars({
  points,
  tone,
  goal,
}: {
  points: SparkPoint[]
  tone: DayTone
  goal: number | null
}) {
  const top = barTop(points, goal)

  return (
    <>
      <div className="grid h-full grid-cols-7 items-end">
        {points.map((point, index) => {
          const ghost = point.value === null || point.value <= 0
          const today = index === points.length - 1

          return (
            <div key={point.date} className="flex h-full items-end justify-center px-0.5">
              <div
                data-testid={ghost ? 'spark-ghost' : 'spark-bar'}
                data-today={today ? 'true' : undefined}
                className={cn(
                  'w-full max-w-[22px] rounded-[5px]',
                  ghost ? 'bg-surface-2 h-[3px]' : today ? FULL[tone] : FADED[tone],
                )}
                style={
                  ghost
                    ? undefined
                    : { height: `${String(percentOf(point.value ?? 0, top))}%`, minHeight: 3 }
                }
              />
            </div>
          )
        })}
      </div>
      {goal === null ? null : (
        <div
          data-testid="spark-goal"
          className="border-muted absolute inset-x-0 border-t border-dashed"
          style={{ bottom: `${String(percentOf(goal, top))}%` }}
        />
      )}
    </>
  )
}

function Line({ points, tone }: { points: SparkPoint[]; tone: DayTone }) {
  const present = points.flatMap((point, index) =>
    point.value === null ? [] : [{ index, value: point.value }],
  )
  const { low, high } = lineRange(present.map((point) => point.value))
  const placed = present.map((point) => ({
    index: point.index,
    x: slotCentre(point.index, points.length),
    y: 100 - ((point.value - low) / (high - low)) * 100,
  }))
  const path = placed
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${String(point.x)} ${String(point.y)}`)
    .join(' ')

  return (
    <>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible"
      >
        <path
          d={path}
          fill="none"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          className={STROKE[tone]}
        />
      </svg>
      {placed.map((point) => {
        const today = point.index === points.length - 1

        return (
          <span
            key={point.index}
            data-testid="spark-dot"
            data-today={today ? 'true' : undefined}
            className={cn(
              'absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2',
              RING[tone],
              today ? cn('size-2.5', FULL[tone]) : 'bg-surface size-2',
            )}
            style={{ left: `${String(point.x)}%`, top: `${String(point.y)}%` }}
          />
        )
      })}
    </>
  )
}

export function DaySparkline({
  name,
  points,
  variant,
  tone,
  formatValue,
  goal = null,
}: DaySparklineProps) {
  return (
    <div data-testid="day-sparkline" data-variant={variant} className="mt-1 min-w-0">
      <div aria-hidden="true">
        <div className="relative h-16">
          {variant === 'bars' ? (
            <Bars points={points} tone={tone} goal={goal} />
          ) : (
            <Line points={points} tone={tone} />
          )}
        </div>
        <div className="mt-1.5 grid grid-cols-7">
          {points.map((point, index) => {
            const last = index === points.length - 1

            return (
              <span
                key={point.date}
                className={cn(
                  'text-center text-[11px]',
                  last ? 'text-text font-bold' : 'text-muted',
                )}
              >
                {last ? 'Today' : dayLetter(point.date)}
              </span>
            )
          })}
        </div>
      </div>
      <ul className="sr-only" aria-label={`${name}, the last 7 days`}>
        {points.map((point, index) => (
          <li key={point.date}>
            {`${spokenDay(point.date, index === points.length - 1)}: ${
              point.value === null ? 'not logged' : formatValue(point.value)
            }`}
          </li>
        ))}
        {goal === null ? null : <li>{`Goal: ${formatValue(goal)}`}</li>}
      </ul>
    </div>
  )
}
