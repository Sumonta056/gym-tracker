import { formatDuration } from '../../lib/duration'
import { hardEffortSeconds, zoneBands, zoneOfBeat } from '../../lib/metrics/heartRateZones'
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
  avgBpm?: number | null
  peakBpm?: number | null
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
  stroke: string
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

export function zoneList(
  zones: HeartRateZones,
  maxHeartRate: Pick<MaxHeartRate, 'bpm'> | null = null,
): Zone[] {
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
      stroke: 'stroke-data-cyan',
      band: band('warm'),
    },
    {
      zone: 'fatBurn',
      name: 'Fat burn',
      seconds: zones.fatBurnSeconds,
      fill: 'bg-ok',
      stroke: 'stroke-ok',
      band: band('fatBurn'),
    },
    {
      zone: 'cardio',
      name: 'Cardio',
      seconds: zones.cardioSeconds,
      fill: 'bg-warn',
      stroke: 'stroke-warn',
      band: band('cardio'),
    },
    {
      zone: 'peak',
      name: 'Peak',
      seconds: zones.peakSeconds,
      fill: 'bg-danger',
      stroke: 'stroke-danger',
      band: band('peak'),
    },
  ]
}

export function zoneSummary(zones: HeartRateZones): string {
  return zoneList(zones)
    .map((zone) => `${zone.name} ${formatDuration(zone.seconds, 'short')}`)
    .join(', ')
}

export function referenceBpm(
  maxHeartRate: MaxHeartRate | null,
  avgBpm: number | null,
  peakBpm: number | null,
): number | null {
  if (maxHeartRate !== null) {
    return maxHeartRate.bpm
  }

  const high = Math.max(avgBpm ?? 0, peakBpm ?? 0)

  return high > 0 ? high : null
}

export function factLine(
  avgBpm: number | null,
  peakBpm: number | null,
  bands: ZoneBand[] | null,
): string | null {
  if (bands === null || avgBpm === null || peakBpm === null) {
    return null
  }

  const name = (beat: number) => ZONE_NAMES[zoneOfBeat(beat, bands)]

  return `Your average, ${String(avgBpm)} bpm, sits in ${name(avgBpm)}. Your peak reached ${name(peakBpm)}.`
}

const ZONE_NAMES: Record<ZoneName, string> = {
  warm: 'Warm',
  fatBurn: 'Fat burn',
  cardio: 'Cardio',
  peak: 'Peak',
}

function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100)
}

function ZoneRing({ zones, list, total }: { zones: HeartRateZones; list: Zone[]; total: number }) {
  const segments = list.map((zone, index) => ({
    zone,
    share: (zone.seconds / total) * 100,
    offset: list.slice(0, index).reduce((sum, item) => sum + (item.seconds / total) * 100, 0),
  }))

  return (
    <div className="relative size-32 shrink-0">
      <svg
        viewBox="0 0 42 42"
        role="img"
        aria-label={`Heart rate zones: ${zoneSummary(zones)}`}
        className="size-full -rotate-90"
      >
        <circle
          cx="21"
          cy="21"
          r="15.915"
          fill="none"
          strokeWidth={5}
          className="stroke-surface-2"
        />
        {segments.map(({ zone, share, offset }) =>
          zone.seconds === 0 ? null : (
            <circle
              key={zone.zone}
              data-zone={zone.zone}
              cx="21"
              cy="21"
              r="15.915"
              fill="none"
              strokeWidth={5}
              strokeDasharray={`${String(share)} ${String(100 - share)}`}
              strokeDashoffset={-offset}
              className={zone.stroke}
            />
          ),
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-text text-lg leading-none font-extrabold tracking-[-0.5px]">
          {formatDuration(total, 'short')}
        </span>
        <span className="text-muted mt-1 text-[11px]">gym time</span>
      </div>
    </div>
  )
}

function Pill({ label, value }: { label: string; value: number }) {
  return (
    <span className="bg-surface-2 text-text rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap">
      <span className="text-muted font-medium">{label}</span> {value}
    </span>
  )
}

function markerAlign(position: number): string {
  if (position >= 85) {
    return '-translate-x-full items-end'
  }

  if (position <= 15) {
    return 'items-start'
  }

  return '-translate-x-1/2 items-center'
}

function EffortScale({
  bands,
  scaleMax,
  avgBpm,
  peakBpm,
  list,
}: {
  bands: ZoneBand[]
  scaleMax: number
  avgBpm: number | null
  peakBpm: number | null
  list: Zone[]
}) {
  const at = (beat: number) => Math.min(100, (beat / scaleMax) * 100)
  const markers = [
    { label: 'Avg', beat: avgBpm, line: 'h-4' },
    { label: 'Peak', beat: peakBpm, line: 'h-9' },
  ].flatMap((marker) => (marker.beat === null ? [] : [{ ...marker, beat: marker.beat }]))
  const floors = bands.slice(1).map((band) => band.fromBpm)

  return (
    <div
      role="img"
      aria-label={`Heart rate scale to ${String(scaleMax)} bpm. Zones start at ${floors.join(', ')} bpm.${markers
        .map((marker) => ` ${marker.label} ${String(marker.beat)} bpm.`)
        .join('')}`}
      className="pt-14"
    >
      <div className="relative">
        {markers.map((marker) => (
          <span
            key={marker.label}
            aria-hidden="true"
            data-marker={marker.label.toLowerCase()}
            className={cn(
              'text-text absolute bottom-full flex flex-col text-[11px] font-bold whitespace-nowrap',
              markerAlign(at(marker.beat)),
            )}
            style={{ left: `${String(at(marker.beat))}%` }}
          >
            {`${marker.label} ${String(marker.beat)}`}
            <span className={cn('bg-text mt-1 w-0.5 rounded-full', marker.line)} />
          </span>
        ))}
        <div aria-hidden="true" className="flex h-3.5 overflow-hidden rounded-full">
          {bands.map((band, index) => {
            const end = bands.at(index + 1)?.fromBpm ?? scaleMax
            const zone = list.find((item) => item.zone === band.zone)

            return (
              <span
                key={band.zone}
                className={cn('h-full', zone?.fill)}
                style={{ width: `${String(((end - band.fromBpm) / scaleMax) * 100)}%` }}
              />
            )
          })}
        </div>
      </div>
      <div aria-hidden="true" className="text-muted relative mt-1.5 h-4 text-[11px]">
        <span className="absolute left-0">0</span>
        {floors.map((floor) => (
          <span
            key={floor}
            className="absolute -translate-x-1/2"
            style={{ left: `${String(at(floor))}%` }}
          >
            {floor}
          </span>
        ))}
        <span className="absolute right-0">bpm</span>
      </div>
    </div>
  )
}

export function HeartRateZonesCard({
  zones,
  maxHeartRate,
  avgBpm = null,
  peakBpm = null,
  className,
}: HeartRateZonesCardProps) {
  const reference = referenceBpm(maxHeartRate, avgBpm, peakBpm)
  const bands = reference === null ? null : zoneBands(reference)
  const list = zoneList(zones, reference === null ? null : { bpm: reference })
  const total = list.reduce((sum, zone) => sum + zone.seconds, 0)
  const hardest = [...list].reverse()
  const fact = factLine(avgBpm, peakBpm, bands)

  return (
    <Card className={cn('flex flex-col gap-4', className)}>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2>
          <MicroLabel>Heart rate zones</MicroLabel>
        </h2>
        <ZoneInfoButton maxHeartRate={maxHeartRate} />
      </div>

      {total === 0 ? (
        <p className="text-muted text-sm">
          Log gym time with an average and a peak heart rate to see the zones.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <ZoneRing zones={zones} list={list} total={total} />
            <div className="flex min-w-0 flex-col gap-2.5">
              <p className="flex flex-col">
                <span className="text-text text-[28px] leading-none font-extrabold tracking-[-1px]">
                  {formatDuration(hardEffortSeconds(zones), 'short')}
                </span>
                <span className="text-muted mt-1 text-xs">hard effort, cardio and peak</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {avgBpm === null ? null : <Pill label="Avg" value={avgBpm} />}
                {peakBpm === null ? null : <Pill label="Peak" value={peakBpm} />}
                {reference === null ? null : <Pill label="Max" value={reference} />}
              </div>
            </div>
          </div>

          {bands === null || reference === null ? null : (
            <EffortScale
              bands={bands}
              scaleMax={Math.max(reference, peakBpm ?? 0)}
              avgBpm={avgBpm}
              peakBpm={peakBpm}
              list={list}
            />
          )}

          <ul className="border-border flex flex-col gap-3 border-t pt-4">
            {hardest.map((zone) => (
              <li
                key={zone.zone}
                className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5"
              >
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <span
                    aria-hidden="true"
                    className={cn('size-2 shrink-0 rounded-full', zone.fill)}
                  />
                  <span>{zone.name}</span>
                  {zone.band === null ? null : (
                    <>
                      {' '}
                      <span className="text-muted text-xs font-medium">{zone.band}</span>
                    </>
                  )}
                </span>{' '}
                <span className="text-text text-sm font-bold">
                  {formatDuration(zone.seconds, 'short')}{' '}
                  <span className="text-muted ml-1.5 text-xs font-medium">{`${String(percent(zone.seconds, total))}%`}</span>
                </span>
                <span
                  aria-hidden="true"
                  className="bg-surface-2 col-span-2 h-2 overflow-hidden rounded-full"
                >
                  <span
                    className={cn('block h-full rounded-full', zone.fill)}
                    style={{ width: `${String(percent(zone.seconds, total))}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>

          {fact === null ? null : (
            <p className="bg-surface-2 text-text rounded-xl px-3 py-2.5 text-[13px] leading-snug">
              {fact}
            </p>
          )}
          <p className="text-muted text-xs">{zoneNote(maxHeartRate)}</p>
        </>
      )}
    </Card>
  )
}
