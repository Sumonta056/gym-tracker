'use client'

import { MUSCLE_GROUPS } from '../../lib/schema/exercise'
import { cn } from '../ui/cn'

import type { MuscleGroup } from '../../lib/schema/exercise'

export const MUSCLE_GROUP_LABEL: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  legs: 'Legs',
  shoulders: 'Shoulders',
  arms: 'Arms',
  core: 'Core',
  cardio: 'Cardio',
}

export const ALL_LABEL = 'All'

export type MuscleGroupChipsProps = {
  value: MuscleGroup | null
  onValueChange: (value: MuscleGroup | null) => void
  includeAll: boolean
  label?: string
  labelledBy?: string
  describedBy?: string
  className?: string
}

type ChipOption = { value: MuscleGroup | null; label: string }

const GROUP_OPTIONS: ChipOption[] = MUSCLE_GROUPS.map((group) => ({
  value: group,
  label: MUSCLE_GROUP_LABEL[group],
}))

export function MuscleGroupChips({
  value,
  onValueChange,
  includeAll,
  label,
  labelledBy,
  describedBy,
  className,
}: MuscleGroupChipsProps) {
  const options = includeAll ? [{ value: null, label: ALL_LABEL }, ...GROUP_OPTIONS] : GROUP_OPTIONS

  return (
    <div
      role="group"
      aria-label={label}
      aria-labelledby={labelledBy}
      className={cn('-mx-1 flex gap-2 overflow-x-auto p-1', className)}
    >
      {options.map((option) => {
        const pressed = option.value === value

        return (
          <button
            key={option.label}
            type="button"
            aria-pressed={pressed}
            aria-describedby={describedBy}
            onClick={() => {
              onValueChange(option.value)
            }}
            className={cn(
              'min-h-11 shrink-0 rounded-full border px-4 text-[13px] font-bold whitespace-nowrap',
              pressed
                ? 'bg-accent border-accent text-accent-ink'
                : 'bg-surface-2 border-border text-muted',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
