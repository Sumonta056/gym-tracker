import { roundTo2 } from './round'

export function epley(weightKg: number | null, reps: number): number | null {
  if (weightKg === null || !Number.isFinite(weightKg) || weightKg < 0) {
    return null
  }

  if (!Number.isFinite(reps) || reps < 1) {
    return null
  }

  return reps === 1 ? weightKg : roundTo2(weightKg * (1 + reps / 30))
}
