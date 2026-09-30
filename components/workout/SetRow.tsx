'use client'

import { useEffect, useRef } from 'react'

import { toDisplayWeight, weightSymbol } from '../../lib/format/weight'

import type { WorkoutSet } from '../../lib/db/dexie'
import type { UnitSystem } from '../../lib/schema/profile'
import type { MouseEvent, PointerEvent } from 'react'

export const NO_LOAD = 'No load'

export const SWIPE_PX = 72

export const HOLD_MS = 500

export const SLOP_PX = 10

export function loadText(weightKg: number | null, unit: UnitSystem): string {
  if (weightKg === null) {
    return NO_LOAD
  }

  const shown = Math.round(toDisplayWeight(weightKg, unit) * 100) / 100

  return `${String(shown)} ${weightSymbol(unit)}`
}

export function repsText(reps: number): string {
  return reps === 1 ? '1 rep' : `${String(reps)} reps`
}

export function RecordBadge() {
  return (
    <span className="bg-accent/16 text-accent inline-flex shrink-0 items-center rounded-md px-[7px] py-[3px] text-[10px] font-extrabold tracking-[0.6px]">
      PR
    </span>
  )
}

type Press = { x: number; y: number }

export function useSwipeOrHold(onEdit: () => void, onDelete: () => void) {
  const press = useRef<Press | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fired = useRef(false)

  const stopTimer = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  useEffect(() => stopTimer, [])

  const fire = () => {
    stopTimer()
    press.current = null
    fired.current = true
    onDelete()
  }

  const release = () => {
    stopTimer()
    press.current = null
  }

  return {
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      fired.current = false
      press.current = { x: event.clientX, y: event.clientY }
      stopTimer()
      timer.current = setTimeout(fire, HOLD_MS)
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      const start = press.current

      if (start === null) {
        return
      }

      const dx = event.clientX - start.x
      const dy = event.clientY - start.y

      if (Math.abs(dx) > SLOP_PX || Math.abs(dy) > SLOP_PX) {
        stopTimer()
      }

      if (dx <= -SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
        fire()
      }
    },
    onPointerUp: release,
    onPointerCancel: release,
    onPointerLeave: release,
    onContextMenu: (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
    },
    onClick: () => {
      if (fired.current) {
        fired.current = false
        return
      }

      onEdit()
    },
  }
}

export type SetRowProps = {
  position: number
  set: Pick<WorkoutSet, 'reps' | 'weight_kg'>
  unit: UnitSystem
  isRecord: boolean
  onEdit: () => void
  onDelete: () => void
}

const CELL_CLASS =
  'bg-surface-2 border-border flex min-h-11 min-w-0 items-center gap-2 rounded-xl border px-3 text-[15px] font-bold'

export function setRowLabel(
  position: number,
  set: Pick<WorkoutSet, 'reps' | 'weight_kg'>,
  unit: UnitSystem,
  isRecord: boolean,
): string {
  const record = isRecord ? ', personal record' : ''

  return `Edit set ${String(position)}, ${loadText(set.weight_kg, unit)}, ${repsText(set.reps)}${record}`
}

export function SetRow({ position, set, unit, isRecord, onEdit, onDelete }: SetRowProps) {
  const gestures = useSwipeOrHold(onEdit, onDelete)

  return (
    <li>
      <button
        type="button"
        aria-label={setRowLabel(position, set, unit, isRecord)}
        className="grid min-h-11 w-full touch-pan-y grid-cols-[34px_1fr_1fr] items-center gap-2 rounded-xl text-left select-none [-webkit-touch-callout:none]"
        {...gestures}
      >
        <span className="text-muted text-xs font-bold">{position}</span>
        <span className={CELL_CLASS}>{loadText(set.weight_kg, unit)}</span>
        <span className={CELL_CLASS}>
          <span className="min-w-0 flex-1">{repsText(set.reps)}</span>
          {isRecord ? <RecordBadge /> : null}
        </span>
      </button>
    </li>
  )
}
