'use client'

import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'

import { colorTokens } from '../../lib/design/tokens'
import { GAP_BUCKET_CAP, sessionGaps } from '../../lib/metrics/sessionGaps'

import { ChartCard } from './ChartCard'
import { AXIS_TICK, LABEL_HALO } from './chartStyle'
import { AXIS_HEIGHT, barRadius, MAX_BAR_WIDTH, PLOT_TOP } from './DailyBars'
import { rangeLabel } from './rangeData'

import type { GapBucket } from '../../lib/metrics/sessionGaps'

export type SessionGapChartProps = {
  dates: string[]
  height?: number
  className?: string
}

export type GapRow = {
  bucket: string
  value: number | null
  ghost: number | null
  label: string | null
}

export function bucketTick(days: number): string {
  if (days >= GAP_BUCKET_CAP) {
    return `${String(GAP_BUCKET_CAP)}+ days`
  }

  return days === 1 ? '1 day' : `${String(days)} days`
}

function bucketWords(days: number): string {
  if (days >= GAP_BUCKET_CAP) {
    return `${String(GAP_BUCKET_CAP)} or more days`
  }

  return days === 1 ? '1 day' : `${String(days)} days`
}

const COUNT_WORDS = ['three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

function times(count: number): string {
  if (count === 1) {
    return 'once'
  }

  if (count === 2) {
    return 'twice'
  }

  return `${COUNT_WORDS[count - 3] ?? String(count)} times`
}

function joinOr(parts: readonly string[]): string {
  if (parts.length < 2) {
    return parts.join('')
  }

  return `${parts.slice(0, -1).join(', ')} or ${parts.at(-1) ?? ''}`
}

export function gapSpan(dates: readonly string[]): string {
  const sorted = [...dates].sort()
  const from = sorted[0] ?? ''
  const to = sorted.at(-1) ?? from

  return rangeLabel({ from, to }).replace(' – ', ' to ')
}

export function averageGap(gaps: readonly number[]): string {
  return (gaps.reduce((total, gap) => total + gap, 0) / gaps.length).toFixed(1)
}

export function gapLabel(
  histogram: readonly GapBucket[],
  gaps: readonly number[],
  span: string,
): string {
  const present = histogram.filter((bucket) => bucket.count > 0)
  const missing = histogram.filter((bucket) => bucket.count === 0)
  const parts = present.map(
    (bucket, index) =>
      `${index === 0 ? 'a gap of ' : ''}${bucketWords(bucket.days)} ${times(bucket.count)}`,
  )
  const numbers = missing.map((bucket) =>
    bucket.days >= GAP_BUCKET_CAP ? `${String(GAP_BUCKET_CAP)} or more` : String(bucket.days),
  )
  const unit = missing.length === 1 && missing[0]?.days === 1 ? 'day' : 'days'

  if (missing.length > 0) {
    parts.push(`no gap of ${joinOr(numbers)} ${unit}`)
  }

  return `Days between sessions, ${span}: ${parts.join(', ')}. Average gap ${averageGap(gaps)} days.`
}

export function gapRows(histogram: readonly GapBucket[]): GapRow[] {
  const top = Math.max(1, ...histogram.map((bucket) => bucket.count))

  return histogram.map((bucket) => ({
    bucket: bucketTick(bucket.days),
    value: bucket.count > 0 ? bucket.count : null,
    ghost: bucket.count > 0 ? null : top,
    label: bucket.count > 0 ? String(bucket.count) : null,
  }))
}

export function gapSummary(gaps: readonly number[]): string {
  const average = averageGap(gaps)

  return gaps.length < 2 ? `${average} days` : `avg ${average} days`
}

export function SessionGapChart({ dates, height = 112, className }: SessionGapChartProps) {
  const { gaps, histogram } = sessionGaps(dates)
  const rows = gapRows(histogram)
  const top = Math.max(1, ...histogram.map((bucket) => bucket.count))
  const radius = barRadius(rows.length)
  const empty = gaps.length === 0
  const span = empty ? '' : gapSpan(dates)

  return (
    <ChartCard
      title="Days between sessions"
      summary={empty ? undefined : gapSummary(gaps)}
      empty={empty}
      emptyText={
        dates.length === 0
          ? 'Log a day to start counting the days between sessions.'
          : 'Log one more day to see the days between sessions.'
      }
      label={empty ? '' : gapLabel(histogram, gaps, span)}
      footer={
        empty ? undefined : (
          <p className="text-muted text-xs">{`Gaps ${gaps.map(String).join(', ')} from ${span}.`}</p>
        )
      }
      className={className}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={rows}
          accessibilityLayer={false}
          barCategoryGap="18%"
          maxBarSize={MAX_BAR_WIDTH}
          margin={{ top: PLOT_TOP, right: 0, bottom: 0, left: 0 }}
        >
          <XAxis
            dataKey="bucket"
            interval={0}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            height={AXIS_HEIGHT}
          />
          <YAxis hide domain={[0, top]} />
          <Bar
            dataKey="ghost"
            stackId="gap"
            fill={colorTokens['surface-2']}
            radius={radius}
            isAnimationActive={false}
          />
          <Bar
            dataKey="value"
            stackId="gap"
            fill={colorTokens['data-violet']}
            radius={radius}
            isAnimationActive={false}
          >
            <LabelList dataKey="label" position="top" fill={colorTokens.text} {...LABEL_HALO} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
