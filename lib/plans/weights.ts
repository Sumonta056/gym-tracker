import type { Equipment } from '../schema/plan'

type WeightRange = { from: number; to: number; step: number }

const RANGES: Record<Exclude<Equipment, 'body only'>, WeightRange> = {
  dumbbell: { from: 2.5, to: 50, step: 2.5 },
  cable: { from: 5, to: 100, step: 5 },
  machine: { from: 5, to: 100, step: 5 },
  barbell: { from: 20, to: 150, step: 2.5 },
}

export function weightList(equipment: Equipment): number[] {
  if (equipment === 'body only') return []

  const { from, to, step } = RANGES[equipment]
  const count = Math.round((to - from) / step) + 1

  return Array.from({ length: count }, (_, index) => Math.round((from + index * step) * 10) / 10)
}
