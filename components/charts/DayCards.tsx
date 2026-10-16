'use client'

import { formatDuration } from '../../lib/duration'
import { toDisplayWeight, weightSymbol } from '../../lib/format/weight'
import { goalPercent, sinceLastWeighIn, versusAverage } from '../../lib/metrics/dayCompare'
import { formatCount } from '../dashboard/summary'
import { Card } from '../ui/Card'
import { cn } from '../ui/cn'
import { MicroLabel } from '../ui/MicroLabel'
import { StatIcon } from '../ui/StatIcon'

import { SPARSE_HINT } from './ChartCard'
import { DaySparkline } from './DaySparkline'
import { DeltaChip } from './DeltaChip'
import { GoalRing } from './GoalRing'
import { dayTick, formatKg, presentValues } from './rangeData'

import type { DayTone, SparkPoint } from './DaySparkline'
import type { DeltaChipProps } from './DeltaChip'
import type { DayPoint } from './rangeData'
import type { VersusAverage } from '../../lib/metrics/dayCompare'
import type { UnitSystem } from '../../lib/schema/profile'
import type { StatIconName } from '../ui/StatIcon'
import type { ReactNode } from 'react'

export const VERSUS_WORDS = 'vs 6-day avg'

export const SAME_WORDS = 'same as 6-day avg'

type Metric = Exclude<keyof DayPoint, 'date' | 'logged'>

export function seriesOf(days: readonly DayPoint[], metric: Metric): SparkPoint[] {
  return days.map((day) => ({ date: day.date, value: day[metric] }))
}

export function todayOf(points: readonly SparkPoint[]): number | null {
  return points.at(-1)?.value ?? null
}

export function earlierOf(points: readonly SparkPoint[]): (number | null)[] {
  return points.slice(0, -1).map((point) => point.value)
}

export function versusChip(
  versus: VersusAverage | null,
  format: (amount: number) => string,
  step: number,
): DeltaChipProps | null {
  if (versus === null) {
    return null
  }

  const amount = Math.abs(versus.delta)

  if (versus.direction === 'same' || Math.round(amount / step) === 0) {
    return { direction: 'same', text: SAME_WORDS }
  }

  return { direction: versus.direction, text: `${format(amount)} ${VERSUS_WORDS}` }
}

export function weekdayOf(date: string): string {
  return dayTick(date, 'week')
}

export function weighInChip(days: readonly DayPoint[], unit: UnitSystem): DeltaChipProps | null {
  const change = sinceLastWeighIn(days)

  if (change === null) {
    return null
  }

  const amount = formatKg(toDisplayWeight(Math.abs(change.deltaKg), unit))
  const since = weekdayOf(change.previousDate)

  if (Number(amount) === 0) {
    return { direction: 'same', text: `no change since ${since}` }
  }

  return {
    direction: change.deltaKg > 0 ? 'up' : 'down',
    text: `${amount} ${weightSymbol(unit)} since ${since}`,
  }
}

const ICON_TONE: Record<DayTone, string> = {
  cyan: 'text-data-cyan',
  warn: 'text-warn',
  violet: 'text-data-violet',
}

type DayCardFrameProps = {
  title: string
  icon?: { name: StatIconName; tone: DayTone }
  summary?: string
  empty: boolean
  emptyText: string
  className?: string
  children?: ReactNode
}

function DayCardFrame({
  title,
  icon,
  summary,
  empty,
  emptyText,
  className,
  children,
}: DayCardFrameProps) {
  return (
    <Card data-testid="day-card" className={cn('flex min-w-0 flex-col gap-3', className)}>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5">
          {icon === undefined ? null : (
            <StatIcon name={icon.name} className={ICON_TONE[icon.tone]} />
          )}
          <MicroLabel>{title}</MicroLabel>
        </h2>
        {empty || summary === undefined ? null : (
          <p className="text-muted text-right text-[13px]">{summary}</p>
        )}
      </div>
      {empty ? <p className="text-muted text-sm">{emptyText}</p> : children}
    </Card>
  )
}

function BigValue({ value, unit }: { value: string; unit?: string }) {
  return (
    <p className="text-text text-[34px] leading-none font-extrabold tracking-[-1px]">
      {value}
      {unit === undefined ? null : (
        <span className="text-muted ml-1 text-[15px] font-semibold tracking-normal">{unit}</span>
      )}
    </p>
  )
}

function GoalLine({
  value,
  goal,
  format,
}: {
  value: number
  goal: number
  format: (amount: number) => string
}) {
  return (
    <p className="text-muted mt-1.5 text-[13px]">
      {`goal ${format(goal)} · `}
      {value >= goal ? (
        <span className="text-ok font-bold">✓ reached</span>
      ) : (
        `${format(goal - value)} to go`
      )}
    </p>
  )
}

function Chip({ chip }: { chip: DeltaChipProps | null }) {
  return chip === null ? null : (
    <div className="mt-2">
      <DeltaChip direction={chip.direction} text={chip.text} />
    </div>
  )
}

type GoalDayCardProps = {
  title: string
  icon: StatIconName
  name: string
  points: SparkPoint[]
  goal: number | null
  tone: DayTone
  unit?: string
  format: (amount: number) => string
  formatDelta: (amount: number) => string
  step: number
  emptyText: string
  className?: string
}

function GoalDayCard({
  title,
  icon,
  name,
  points,
  goal,
  tone,
  unit,
  format,
  formatDelta,
  step,
  emptyText,
  className,
}: GoalDayCardProps) {
  const today = todayOf(points)
  const versus = versusAverage(today, earlierOf(points))
  const percent = goalPercent(today, goal)

  return (
    <DayCardFrame
      title={title}
      icon={{ name: icon, tone }}
      summary={versus === null ? undefined : `6-day avg ${format(versus.average)}`}
      empty={today === null}
      emptyText={emptyText}
      className={className}
    >
      <div className="flex items-center gap-4">
        {percent === null ? null : <GoalRing percent={percent} tone={tone} />}
        <div className="min-w-0">
          <BigValue value={format(today ?? 0)} unit={unit} />
          {goal === null || goal <= 0 ? null : (
            <GoalLine value={today ?? 0} goal={goal} format={format} />
          )}
          <Chip chip={versusChip(versus, formatDelta, step)} />
        </div>
      </div>
      <DaySparkline
        name={name}
        points={points}
        variant="bars"
        tone={tone}
        formatValue={(value) => (unit === undefined ? format(value) : `${format(value)} ${unit}`)}
        goal={goal !== null && goal > 0 ? goal : null}
      />
    </DayCardFrame>
  )
}

function count(value: number): string {
  return formatCount(Math.round(value))
}

function shortTime(seconds: number): string {
  return formatDuration(seconds, 'short')
}

function minutesOf(seconds: number): string {
  return formatDuration(seconds, 'minutes')
}

export type DayCardProps = {
  days: DayPoint[]
  className?: string
}

export function StepsDayCard({
  days,
  stepGoal,
  className,
}: DayCardProps & { stepGoal: number | null }) {
  return (
    <GoalDayCard
      title="Steps"
      icon="steps"
      name="Steps"
      points={seriesOf(days, 'steps')}
      goal={stepGoal}
      tone="cyan"
      format={count}
      formatDelta={count}
      step={1}
      emptyText="Log your steps to see them against your goal."
      className={className}
    />
  )
}

export function CaloriesDayCard({ days, goal, className }: DayCardProps & { goal: number | null }) {
  return (
    <GoalDayCard
      title="Calories burnt"
      icon="flame"
      name="Calories burnt"
      points={seriesOf(days, 'calories')}
      goal={goal}
      tone="warn"
      unit="kcal"
      format={count}
      formatDelta={count}
      step={1}
      emptyText="Log the calories burnt to see them against your goal."
      className={className}
    />
  )
}

export function WalkDayCard({
  days,
  goalSeconds,
  className,
}: DayCardProps & { goalSeconds: number | null }) {
  return (
    <GoalDayCard
      title="Walk"
      icon="walk"
      name="Walk time"
      points={seriesOf(days, 'walkSeconds')}
      goal={goalSeconds}
      tone="cyan"
      format={shortTime}
      formatDelta={minutesOf}
      step={60}
      emptyText="Log your walk time to see it against your goal."
      className={className}
    />
  )
}

export function WeightDayCard({
  days,
  unit,
  targetKg,
  className,
}: DayCardProps & { unit: UnitSystem; targetKg: number | null }) {
  const points = seriesOf(days, 'weightKg').map((point) => ({
    date: point.date,
    value: point.value === null ? null : toDisplayWeight(point.value, unit),
  }))
  const today = todayOf(points)
  const symbol = weightSymbol(unit)
  const weighIns = presentValues(points.map((point) => point.value)).length

  return (
    <DayCardFrame
      title="Weight"
      icon={{ name: 'scale', tone: 'violet' }}
      summary={
        targetKg === null
          ? undefined
          : `goal ${formatKg(toDisplayWeight(targetKg, unit))} ${symbol}`
      }
      empty={today === null}
      emptyText="Log a weight to see the trend and its 7-day average."
      className={className}
    >
      <div className="min-w-0">
        <BigValue value={formatKg(today ?? 0)} unit={symbol} />
        <Chip chip={weighInChip(days, unit)} />
      </div>
      {weighIns < 2 ? (
        <p className="text-muted text-[13px]">{SPARSE_HINT}</p>
      ) : (
        <DaySparkline
          name="Weight"
          points={points}
          variant="line"
          tone="violet"
          formatValue={(value) => `${formatKg(value)} ${symbol}`}
        />
      )}
    </DayCardFrame>
  )
}

function HeartTile({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="bg-surface-2 min-w-0 rounded-[14px] p-3">
      <MicroLabel as="p">{label}</MicroLabel>
      {value === null ? (
        <p className="text-muted mt-1.5 text-[13px]">Not logged</p>
      ) : (
        <p className="text-text mt-1.5 text-[26px] leading-none font-extrabold tracking-[-1px]">
          {String(value)}
          <span className="text-muted ml-1 text-[15px] font-semibold tracking-normal">bpm</span>
        </p>
      )}
    </div>
  )
}

function bpm(value: number): string {
  return `${String(Math.round(value))} bpm`
}

export function HeartRateDayCard({ days, className }: DayCardProps) {
  const averages = seriesOf(days, 'avgHeartRate')
  const average = todayOf(averages)
  const highest = todayOf(seriesOf(days, 'maxHeartRate'))
  const versus = versusAverage(average, earlierOf(averages))

  return (
    <DayCardFrame
      title="Heart rate"
      summary={versus === null ? undefined : `6-day avg ${bpm(versus.average)}`}
      empty={average === null && highest === null}
      emptyText="Log an average or a peak heart rate to see the trend."
      className={className}
    >
      <div className="grid grid-cols-2 gap-2.5">
        <HeartTile label="Average" value={average} />
        <HeartTile label="Highest" value={highest} />
      </div>
      <Chip chip={versusChip(versus, (amount) => `${bpm(amount)} avg`, 1)} />
    </DayCardFrame>
  )
}
