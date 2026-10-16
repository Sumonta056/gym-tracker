'use client'

import { useEffect, useRef, useState } from 'react'

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

export type FadeEdge = 'none' | 'start' | 'end' | 'both'

export type RowBox = { scrollLeft: number; scrollWidth: number; clientWidth: number }

export function fadeEdge({ scrollLeft, scrollWidth, clientWidth }: RowBox): FadeEdge {
  const before = scrollLeft > 1
  const after = scrollLeft + clientWidth < scrollWidth - 1

  if (before && after) return 'both'
  if (before) return 'start'
  if (after) return 'end'
  return 'none'
}

export function MuscleGroupChips({
  value,
  onValueChange,
  includeAll,
  label,
  labelledBy,
  describedBy,
  className,
}: MuscleGroupChipsProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [fade, setFade] = useState<FadeEdge>('none')

  useEffect(() => {
    const row = rowRef.current

    if (row === null) {
      return
    }

    const measure = () => {
      setFade(fadeEdge(row))
    }

    measure()
    row.addEventListener('scroll', measure, { passive: true })
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(row)

    return () => {
      row.removeEventListener('scroll', measure)
      observer?.disconnect()
    }
  }, [])

  const options = includeAll ? [{ value: null, label: ALL_LABEL }, ...GROUP_OPTIONS] : GROUP_OPTIONS

  return (
    <div
      ref={rowRef}
      role="group"
      aria-label={label}
      aria-labelledby={labelledBy}
      data-fade={fade}
      className={cn('-mx-1 flex scroll-px-8 gap-2 overflow-x-auto p-1', className)}
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
