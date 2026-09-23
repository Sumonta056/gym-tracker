'use client'

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'

import { colorTokens } from '../../lib/design/tokens'
import { formatDuration } from '../../lib/duration'
import { zoneList, zoneSummary } from '../dashboard/HeartRateZonesCard'

import { ChartCard } from './ChartCard'
import { rangeLabel } from './rangeData'

import type { HeartRateZones } from '../../lib/metrics/heartRateZones'

export type ZoneSplitChartProps = {
  zones: HeartRateZones
  date: string
  className?: string
}

export const ZONE_SERIES = [
  { key: 'warmSeconds', color: colorTokens['data-cyan'] },
  { key: 'fatBurnSeconds', color: colorTokens.ok },
  { key: 'cardioSeconds', color: colorTokens.warn },
  { key: 'peakSeconds', color: colorTokens.danger },
] as const

export function ZoneSplitChart({ zones, date, className }: ZoneSplitChartProps) {
  const list = zoneList(zones)
  const total = list.reduce((sum, zone) => sum + zone.seconds, 0)
  const day = rangeLabel({ from: date, to: date })

  return (
    <ChartCard
      title="Heart rate zones"
      summary={day}
      empty={total === 0}
      emptyText="Log gym time with an average and a peak heart rate to see today's zones."
      label={`Heart rate zones on ${day}: ${zoneSummary(zones)}`}
      legend={list.map((zone) => ({
        name: `${zone.name} ${formatDuration(zone.seconds, 'short')}`,
        dot: zone.fill,
      }))}
      footer={<p className="text-muted text-xs">Modelled from the session average and peak.</p>}
      className={className}
    >
      <div className="overflow-hidden rounded-full">
        <ResponsiveContainer width="100%" height={14}>
          <BarChart
            data={[zones]}
            layout="vertical"
            accessibilityLayer={false}
            barCategoryGap={0}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          >
            <XAxis type="number" hide domain={[0, total]} />
            <YAxis type="category" hide />
            {ZONE_SERIES.map((series) => (
              <Bar
                key={series.key}
                dataKey={series.key}
                stackId="zones"
                fill={series.color}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
