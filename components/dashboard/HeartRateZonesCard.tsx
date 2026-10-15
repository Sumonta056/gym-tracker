import { formatDuration } from '../../lib/duration'
import { zoneBands } from '../../lib/metrics/heartRateZones'
import { Card } from '../ui/Card'
import { cn } from '../ui/cn'
import { MicroLabel } from '../ui/MicroLabel'

import { ZoneInfoButton } from './ZoneInfo'

import type {
  HeartRateZones,
  MaxHeartRate,
  ZoneBand,
  ZoneName,
} from '../../lib/metrics/heartRateZones'

export type HeartRateZonesCardProps = {
  zones: HeartRateZones
  maxHeartRate: MaxHeartRate | null
  className?: string
}

export const NO_MAX_NOTE = 'Add your birth year in Profile for real zones.'

export function zoneNote(maxHeartRate: MaxHeartRate | null): string {
  if (maxHeartRate === null) {
    return NO_MAX_NOTE
  }

  const from = maxHeartRate.source === 'age' ? 'from your birth year' : 'set in Profile'

  return `Based on a max of ${String(maxHeartRate.bpm)} bpm, ${from}.`
}

type Zone = {
  zone: ZoneName
  name: string
  seconds: number
  fill: string
  band: string | null
}

export function bandText(band: ZoneBand): string {
  if (band.toBpm === null) {
    return `${String(band.fromBpm)}+ bpm`
  }

  if (band.fromBpm === 0) {
    return `under ${String(band.toBpm + 1)} bpm`
  }

  return `${String(band.fromBpm)}–${String(band.toBpm)} bpm`
}

export function zoneList(zones: HeartRateZones, maxHeartRate: MaxHeartRate | null = null): Zone[] {
  const bands = maxHeartRate === null ? null : zoneBands(maxHeartRate.bpm)

  function band(zone: ZoneName): string | null {
    const found = bands?.find((item) => item.zone === zone)

    return found === undefined ? null : bandText(found)
  }

  return [
    {
      zone: 'warm',
      name: 'Warm',
      seconds: zones.warmSeconds,
      fill: 'bg-data-cyan',
      band: band('warm'),
    },
    {
      zone: 'fatBurn',
      name: 'Fat burn',
      seconds: zones.fatBurnSeconds,
      fill: 'bg-ok',
      band: band('fatBurn'),
    },
    {
      zone: 'cardio',
      name: 'Cardio',
      seconds: zones.cardioSeconds,
      fill: 'bg-warn',
      band: band('cardio'),
    },
    {
      zone: 'peak',
      name: 'Peak',
      seconds: zones.peakSeconds,
      fill: 'bg-danger',
      band: band('peak'),
    },
  ]
}

export function zoneSummary(zones: HeartRateZones): string {
  return zoneList(zones)
    .map((zone) => `${zone.name} ${formatDuration(zone.seconds, 'short')}`)
    .join(', ')
}

export function HeartRateZonesCard({ zones, maxHeartRate, className }: HeartRateZonesCardProps) {
  const list = zoneList(zones, maxHeartRate)
  const total = list.reduce((sum, zone) => sum + zone.seconds, 0)

  return (
    <Card className={cn('flex flex-col gap-3', className)}>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2>
          <MicroLabel>Heart rate zones</MicroLabel>
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          {total === 0 ? null : (
            <p className="text-muted text-xs">{`${formatDuration(zones.cardioSeconds, 'short')} in cardio`}</p>
          )}
          <ZoneInfoButton maxHeartRate={maxHeartRate} />
        </div>
      </div>

      {total === 0 ? (
        <p className="text-muted text-sm">
          Log gym time with an average and a peak heart rate to see the zones.
        </p>
      ) : (
        <>
          <div
            role="img"
            aria-label={`Heart rate zones: ${zoneSummary(zones)}`}
            className="bg-surface-2 flex h-3.5 overflow-hidden rounded-full"
          >
            {list.map((zone) =>
              zone.seconds === 0 ? null : (
                <span
                  key={zone.name}
                  className={cn('h-full', zone.fill)}
                  style={{ width: `${String((zone.seconds / total) * 100)}%` }}
                />
              ),
            )}
          </div>
          <ul className="flex flex-col gap-1.5">
            {list.map((zone) => (
              <li
                key={zone.name}
                className="text-muted flex items-center justify-between gap-3 text-xs"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className={cn('size-1.5 shrink-0 rounded-full', zone.fill)}
                  />
                  <span>{`${zone.name} ${formatDuration(zone.seconds, 'short')}`}</span>
                </span>
                {zone.band === null ? null : <span className="text-muted">{zone.band}</span>}
              </li>
            ))}
          </ul>
          <p className="text-muted text-xs">{zoneNote(maxHeartRate)}</p>
        </>
      )}
    </Card>
  )
}
