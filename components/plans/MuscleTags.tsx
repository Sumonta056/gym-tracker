import { MUSCLE_REGIONS } from '../../lib/design/body'
import { GROUP_COLORS } from '../charts/MuscleBalanceChart'
import { cn } from '../ui/cn'

import type { Muscle } from '../../lib/schema/plan'

export type MuscleTagsProps = {
  primary: readonly Muscle[]
  secondary: readonly Muscle[]
  className?: string
}

export function muscleName(muscle: Muscle): string {
  return muscle.charAt(0).toUpperCase() + muscle.slice(1)
}

function Tag({ muscle, role }: { muscle: Muscle; role: 'primary' | 'secondary' }) {
  return (
    <li
      data-role={role}
      className={cn(
        'bg-surface-2 text-text inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[5px] text-xs font-bold',
        role === 'secondary' ? 'border-dim border-dashed' : 'border-border border-solid',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-2 shrink-0 rounded-full',
          GROUP_COLORS[MUSCLE_REGIONS[muscle].group].dot,
          role === 'secondary' && 'opacity-55',
        )}
      />
      {muscleName(muscle)}
      <span className="sr-only">{role === 'primary' ? ', main' : ', helper'}</span>
    </li>
  )
}

export function MuscleTags({ primary, secondary, className }: MuscleTagsProps) {
  return (
    <ul aria-label="Muscles" className={cn('flex flex-wrap gap-1.5', className)}>
      {primary.map((muscle) => (
        <Tag key={`primary-${muscle}`} muscle={muscle} role="primary" />
      ))}
      {secondary.map((muscle) => (
        <Tag key={`secondary-${muscle}`} muscle={muscle} role="secondary" />
      ))}
    </ul>
  )
}
