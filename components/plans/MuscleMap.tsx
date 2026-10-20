import { BODY_BACK, BODY_FRONT, BODY_VIEWBOX, MUSCLE_REGIONS } from '../../lib/design/body'
import { colorTokens } from '../../lib/design/tokens'
import { GROUP_COLORS } from '../charts/MuscleBalanceChart'
import { cn } from '../ui/cn'
import { MicroLabel } from '../ui/MicroLabel'

import { muscleName } from './MuscleTags'

import type { BodyRegion } from '../../lib/design/body'
import type { Muscle } from '../../lib/schema/plan'

export type MuscleMapSize = 'chip' | 'card' | 'frame'

export type MuscleMapProps = {
  primary: readonly Muscle[]
  secondary: readonly Muscle[]
  size: MuscleMapSize
  className?: string
}

export type RegionHit = { role: 'primary' | 'secondary'; fill: string }

export const SECONDARY_OPACITY = 0.55

const SECONDARY_STROKE_OPACITY = 0.7

const FIGURE_CLASS: Record<MuscleMapSize, string> = {
  chip: 'w-[26px]',
  card: 'w-[52px]',
  frame: 'w-[min(19cqw,70px)]',
}

const ROOT_CLASS: Record<MuscleMapSize, string> = {
  chip: 'inline-flex shrink-0 gap-0.5',
  card: 'bg-ground relative flex aspect-[3/2] w-full items-center justify-center gap-4',
  frame: 'bg-ground @container absolute inset-0 flex items-center justify-end gap-2.5 pr-6',
}

export function muscleLabel(primary: readonly Muscle[], secondary: readonly Muscle[]): string {
  const main = `Main: ${primary.map(muscleName).join(', ')}.`
  return secondary.length === 0 ? main : `${main} Helpers: ${secondary.map(muscleName).join(', ')}.`
}

export function regionHits(
  primary: readonly Muscle[],
  secondary: readonly Muscle[],
): Map<BodyRegion, RegionHit> {
  const hits = new Map<BodyRegion, RegionHit>()
  const mark = (muscle: Muscle, role: RegionHit['role']) => {
    const { group, regions } = MUSCLE_REGIONS[muscle]
    for (const region of regions) {
      if (hits.get(region)?.role === 'primary') continue
      hits.set(region, { role, fill: GROUP_COLORS[group].fill })
    }
  }
  secondary.forEach((muscle) => {
    mark(muscle, 'secondary')
  })
  primary.forEach((muscle) => {
    mark(muscle, 'primary')
  })
  return hits
}

function Figure({
  side,
  polygons,
  hits,
  className,
}: {
  side: 'front' | 'back'
  polygons: Partial<Record<BodyRegion, readonly string[]>>
  hits: Map<BodyRegion, RegionHit>
  className: string
}) {
  return (
    <svg
      viewBox={BODY_VIEWBOX}
      aria-hidden="true"
      focusable="false"
      data-side={side}
      className={cn('block aspect-[1/2] h-auto shrink-0', className)}
    >
      {Object.entries(polygons).map(([region, shapes]) => {
        const hit = hits.get(region as BodyRegion)
        return (
          <g
            key={region}
            data-region={region}
            data-role={hit?.role ?? 'none'}
            fill={hit?.fill ?? colorTokens['surface-2']}
            stroke={hit?.fill ?? colorTokens.border}
            strokeWidth={0.7}
            fillOpacity={hit?.role === 'secondary' ? SECONDARY_OPACITY : 1}
            strokeOpacity={hit?.role === 'secondary' ? SECONDARY_STROKE_OPACITY : 1}
          >
            {shapes.map((points) => (
              <polygon key={points} points={points} />
            ))}
          </g>
        )
      })}
    </svg>
  )
}

function Key({ size }: { size: MuscleMapSize }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'text-muted absolute flex flex-col gap-1 text-[11px] font-semibold',
        size === 'frame' ? 'top-6 left-[26px]' : 'top-2.5 right-2.5',
      )}
    >
      <span className="flex items-center gap-1">
        <i className="bg-accent inline-block size-2.5 rounded-[3px]" />
        main
      </span>
      <span className="flex items-center gap-1">
        <i className="bg-accent inline-block size-2.5 rounded-[3px] opacity-55" />
        helper
      </span>
    </span>
  )
}

export function MuscleMap({ primary, secondary, size, className }: MuscleMapProps) {
  const hits = regionHits(primary, secondary)
  const figure = FIGURE_CLASS[size]
  const label = muscleLabel(primary, secondary)

  if (size === 'chip') {
    return (
      <span role="img" aria-label={label} className={cn(ROOT_CLASS.chip, className)}>
        <Figure side="front" polygons={BODY_FRONT} hits={hits} className={figure} />
        <Figure side="back" polygons={BODY_BACK} hits={hits} className={figure} />
      </span>
    )
  }

  return (
    <div role="img" aria-label={label} className={cn(ROOT_CLASS[size], className)}>
      <span className="grid justify-items-center gap-1">
        <Figure side="front" polygons={BODY_FRONT} hits={hits} className={figure} />
        <MicroLabel aria-hidden="true">Front</MicroLabel>
      </span>
      <span className="grid justify-items-center gap-1">
        <Figure side="back" polygons={BODY_BACK} hits={hits} className={figure} />
        <MicroLabel aria-hidden="true">Back</MicroLabel>
      </span>
      <Key size={size} />
    </div>
  )
}
