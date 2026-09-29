import { toDisplayWeight, weightSymbol } from '../../lib/format/weight'

import type { WorkoutSet } from '../../lib/db/dexie'
import type { UnitSystem } from '../../lib/schema/profile'

export const NO_LOAD = 'No load'

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

export type SetRowProps = {
  position: number
  set: Pick<WorkoutSet, 'reps' | 'weight_kg'>
  unit: UnitSystem
  isRecord: boolean
}

const CELL_CLASS =
  'bg-surface-2 border-border flex min-h-11 min-w-0 items-center gap-2 rounded-xl border px-3 text-[15px] font-bold'

export function SetRow({ position, set, unit, isRecord }: SetRowProps) {
  return (
    <li className="grid min-h-11 grid-cols-[34px_1fr_1fr] items-center gap-2">
      <span className="text-muted text-xs font-bold">
        <span className="sr-only">Set </span>
        {position}
      </span>
      <span className={CELL_CLASS}>{loadText(set.weight_kg, unit)}</span>
      <span className={CELL_CLASS}>
        <span className="min-w-0 flex-1">{repsText(set.reps)}</span>
        {isRecord ? <RecordBadge /> : null}
      </span>
    </li>
  )
}
