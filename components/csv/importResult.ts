import type { ImportResult } from '../../lib/db/repository'

export type ImportOutcome = ImportResult & { leftOut: number }

export const RESULT_PARAM = 'imported'

const KEYS = ['created', 'overwritten', 'merged', 'skipped', 'leftOut'] as const

export function resultPath(outcome: ImportOutcome): string {
  const value = KEYS.map((key) => String(outcome[key])).join('.')

  return `/?${RESULT_PARAM}=${value}`
}

export function readResult(search: string): ImportOutcome | null {
  const value = new URLSearchParams(search).get(RESULT_PARAM)
  const parts = value?.split('.') ?? []

  if (parts.length !== KEYS.length || !parts.every((part) => /^\d{1,6}$/.test(part))) {
    return null
  }

  const [created, overwritten, merged, skipped, leftOut] = parts.map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ]

  return { created, overwritten, merged, skipped, leftOut }
}

export function resultText(outcome: ImportOutcome): string {
  return `The sheet is imported: ${String(outcome.created)} new, ${String(outcome.overwritten)} overwritten, ${String(outcome.merged)} merged, ${String(outcome.skipped)} skipped, ${String(outcome.leftOut)} left out.`
}
