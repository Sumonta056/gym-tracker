import { formatDuration } from '../../lib/duration'
import { Card } from '../ui/Card'
import { cn } from '../ui/cn'
import { MicroLabel } from '../ui/MicroLabel'

import type { HeartRateZones } from '../../lib/metrics/heartRateZones'

export type HeartRateZonesCardProps = {
  zones: HeartRateZones
  className?: string
}

type Zone = {
  name: string
  seconds: number
  fill: string
}

export function zoneList(zones: HeartRateZones): Zone[] {
  return [
    { name: 'Warm', seconds: zones.warmSeconds, fill: 'bg-data-cyan' },
    { name: 'Fat burn', seconds: zones.fatBurnSeconds, fill: 'bg-ok' },
    { name: 'Cardio', seconds: zones.cardioSeconds, fill: 'bg-warn' },
    { name: 'Peak', seconds: zones.peakSeconds, fill: 'bg-danger' },
  ]
}

export function zoneSummary(zones: HeartRateZones): string {
  return zoneList(zones)
    .map((zone) => `${zone.name} ${formatDuration(zone.seconds, 'short')}`)
    .join(', ')
}

export function HeartRateZonesCard({ zones, className }: HeartRateZonesCardProps) {
  const list = zoneList(zones)
  const total = list.reduce((sum, zone) => sum + zone.seconds, 0)

  return (
    <Card className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2>
          <MicroLabel>Heart rate zones</MicroLabel>
        </h2>
        {total === 0 ? null : (
          <p className="text-muted text-xs">{`${formatDuration(zones.cardioSeconds, 'short')} in cardio`}</p>
        )}
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
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {list.map((zone) => (
              <li key={zone.name} className="text-muted flex items-center gap-1.5 text-xs">
                <span
                  aria-hidden="true"
                  className={cn('size-1.5 shrink-0 rounded-full', zone.fill)}
                />
                {`${zone.name} ${formatDuration(zone.seconds, 'short')}`}
              </li>
            ))}
          </ul>
          <p className="text-muted text-xs">Modelled from the session average and peak.</p>
        </>
      )}
    </Card>
  )
}
