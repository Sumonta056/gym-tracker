import type { UnitSystem } from '../schema/profile'

export const KG_PER_LB = 0.45359237

const SYMBOL: Record<UnitSystem, string> = { metric: 'kg', imperial: 'lb' }

const WORD: Record<UnitSystem, string> = { metric: 'kilograms', imperial: 'pounds' }

export function weightSymbol(unit: UnitSystem): string {
  return SYMBOL[unit]
}

export function weightWord(unit: UnitSystem): string {
  return WORD[unit]
}

export function toDisplayWeight(kg: number, unit: UnitSystem): number {
  return unit === 'metric' ? kg : kg / KG_PER_LB
}

export function fromDisplayWeight(value: number, unit: UnitSystem): number {
  const kg = unit === 'metric' ? value : value * KG_PER_LB

  return Math.round(kg * 100) / 100
}

export function formatWeight(kg: number, unit: UnitSystem, digits: number): string {
  return toDisplayWeight(kg, unit).toFixed(digits)
}

export function formatLoadShort(kg: number, unit: UnitSystem): string {
  const scale = unit === 'metric' ? 100 : 10

  return String(Math.round(toDisplayWeight(kg, unit) * scale) / scale)
}
