import { formatWeight, weightSymbol } from '../../lib/format/weight'
import { rowLine } from '../workouts/historyText'

import type { SessionStats } from '../../lib/metrics/sessionStats'
import type { UnitSystem } from '../../lib/schema/profile'

export const ON_TARGET_KG = 0.05

export function goalHint(value: number, goal: number, format: (value: number) => string): string {
  return `${String(Math.round((value / goal) * 100))}% of ${format(goal)}`
}

export function weightGapText(gapKg: number, unit: UnitSystem): string {
  return gapKg < ON_TARGET_KG
    ? 'On target'
    : `${formatWeight(gapKg, unit, 1)} ${weightSymbol(unit)} to go`
}

export function workoutLine(stats: SessionStats, unit: UnitSystem): string {
  const records = stats.newRecords.length
  const line = rowLine(stats, unit)

  return records === 0 ? line : `${line} · ${String(records)} new record${records === 1 ? '' : 's'}`
}
