import { rowEntry } from '../../lib/csv/import'
import { formatDuration } from '../../lib/duration'

import type {
  ParsedRow,
  ParsedSheet,
  ReadingPicks,
  SheetCell,
  SheetField,
} from '../../lib/csv/import'
import type { ImportChoice, ImportDay } from '../../lib/db/repository'

export type Picks = Readonly<Record<string, number>>

export type ReviewTarget = {
  key: string
  rowIndex: number
  field: SheetField
  raw: string
}

export const FIELD_LABEL: Record<SheetField, string> = {
  entry_date: 'Day',
  walk_seconds: 'Walk time',
  gym_seconds: 'Gym time',
  avg_heart_rate: 'Avg heart rate',
  max_heart_rate: 'Highest rate',
  weight_kg: 'Weight',
  calories_burnt: 'Calories',
  steps: 'Steps',
}

export const SHEET_FIELDS: SheetField[] = [
  'entry_date',
  'walk_seconds',
  'gym_seconds',
  'avg_heart_rate',
  'max_heart_rate',
  'weight_kg',
  'calories_burnt',
  'steps',
]

const DURATION_FIELDS: SheetField[] = ['walk_seconds', 'gym_seconds']

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const COUNT = new Intl.NumberFormat('en-US')

export const YEAR_ERROR = 'Enter a year such as 2026.'

export function readYear(text: string): number | null {
  const trimmed = text.trim()

  if (!/^\d{4}$/.test(trimmed)) {
    return null
  }

  const year = Number(trimmed)

  return year >= 1900 && year <= 2100 ? year : null
}

export function cellKey(rowIndex: number, field: SheetField): string {
  return `${String(rowIndex)}:${field}`
}

export function rawShape(raw: string): string {
  return raw.replace(/^\d+/, 'n').replace(/\d/g, 'd')
}

export function hasError(row: ParsedRow): boolean {
  return SHEET_FIELDS.some((field) => row.cells[field].status === 'error')
}

export function rowDate(row: ParsedRow): string | null {
  const day = row.cells.entry_date

  return day.status === 'ok' && typeof day.value === 'string' ? day.value : null
}

export function repeatedRows(sheet: ParsedSheet): Map<number, number> {
  const first = new Map<string, number>()
  const repeated = new Map<number, number>()

  sheet.rows.forEach((row, rowIndex) => {
    const date = rowDate(row)

    if (date === null || hasError(row)) {
      return
    }

    const earlier = first.get(date)

    if (earlier === undefined) {
      first.set(date, rowIndex)
    } else {
      repeated.set(rowIndex, earlier)
    }
  })

  return repeated
}

export function reviewTargets(sheet: ParsedSheet): ReviewTarget[] {
  const repeated = repeatedRows(sheet)

  return sheet.rows.flatMap((row, rowIndex) => {
    if (hasError(row) || repeated.has(rowIndex)) {
      return []
    }

    return SHEET_FIELDS.flatMap((field) => {
      const cell = row.cells[field]

      return cell.status === 'review'
        ? [{ key: cellKey(rowIndex, field), rowIndex, field, raw: cell.raw }]
        : []
    })
  })
}

export function remaining(targets: ReviewTarget[], picks: Picks): number {
  return targets.filter((target) => picks[target.key] === undefined).length
}

export function similarTargets(targets: ReviewTarget[], target: ReviewTarget): ReviewTarget[] {
  const shape = rawShape(target.raw)

  return targets.filter(
    (other) =>
      other.key !== target.key && other.field === target.field && rawShape(other.raw) === shape,
  )
}

export function applyToSimilar(
  picks: Picks,
  targets: ReviewTarget[],
  target: ReviewTarget,
  reading: number,
): Picks {
  const next: Record<string, number> = { ...picks, [target.key]: reading }

  for (const other of similarTargets(targets, target)) {
    next[other.key] = reading
  }

  return next
}

export function dayLabel(iso: string): string {
  return `${String(Number(iso.slice(8, 10)))} ${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ''}`
}

const LONG_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function spokenRowTitle(row: ParsedRow, rowIndex: number): string {
  const number = `Row ${String(rowIndex + 1)}`
  const date = rowDate(row)

  if (date === null) {
    return number
  }

  return `${number}, ${String(Number(date.slice(8, 10)))} ${LONG_MONTHS[Number(date.slice(5, 7)) - 1] ?? ''}`
}

export function rowTitle(row: ParsedRow, rowIndex: number): string {
  const day = row.cells.entry_date
  const number = `Row ${String(rowIndex + 1)}`

  if (day.status === 'ok' && typeof day.value === 'string') {
    return `${number} · ${dayLabel(day.value)}`
  }

  return day.raw === '' ? `${number} · no date` : `${number} · ${day.raw}`
}

export function cellText(field: SheetField, cell: SheetCell, pick?: number): string {
  if (cell.status === 'review') {
    const reading = pick === undefined ? undefined : cell.readings[pick]

    return reading === undefined ? cell.raw : formatDuration(reading.seconds, 'minsec')
  }

  if (cell.status === 'error') {
    return cell.raw === '' ? '—' : cell.raw
  }

  if (cell.value === null) {
    return '—'
  }

  if (typeof cell.value === 'string') {
    return dayLabel(cell.value)
  }

  if (DURATION_FIELDS.includes(field)) {
    return formatDuration(cell.value, 'clock')
  }

  if (field === 'weight_kg') {
    return `${String(cell.value)} kg`
  }

  return COUNT.format(cell.value)
}

export function rowDetail(row: ParsedRow): string {
  const { avg_heart_rate, max_heart_rate, weight_kg, calories_burnt, steps } = row.cells
  const value = (field: SheetField, cell: SheetCell): string | null =>
    cell.status === 'ok' && cell.value !== null ? cellText(field, cell) : null

  const average = value('avg_heart_rate', avg_heart_rate)
  const highest = value('max_heart_rate', max_heart_rate)
  const calories = value('calories_burnt', calories_burnt)
  const count = value('steps', steps)

  const parts = [
    average === null && highest === null ? null : `HR ${average ?? '—'} / ${highest ?? '—'}`,
    value('weight_kg', weight_kg),
    calories === null ? null : `${calories} kcal`,
    count === null ? null : `${count} steps`,
  ]

  return parts.filter((part) => part !== null).join(' · ')
}

export function errorText(row: ParsedRow): string[] {
  return SHEET_FIELDS.flatMap((field) => {
    const cell = row.cells[field]

    if (cell.status !== 'error') {
      return []
    }

    const label = FIELD_LABEL[field]
    const lead =
      cell.raw === '' ? `${label} is blank.` : `${label} "${cell.raw}" could not be read.`

    return [`${lead} ${cell.reason}`]
  })
}

export type Choices = Readonly<Record<string, ImportChoice>>

export type ImportCounts = {
  created: number
  overwritten: number
  merged: number
  skipped: number
  leftOut: number
}

export type ImportPlan = { days: ImportDay[]; counts: ImportCounts; writes: number }

export function rowPicks(picks: Picks, rowIndex: number): ReadingPicks {
  const own: ReadingPicks = {}

  for (const field of DURATION_FIELDS) {
    const pick = picks[cellKey(rowIndex, field)]

    if (pick !== undefined) {
      own[field] = pick
    }
  }

  return own
}

export function duplicateDates(sheet: ParsedSheet, logged: ReadonlySet<string>): string[] {
  const repeated = repeatedRows(sheet)

  return sheet.rows.flatMap((row, rowIndex) => {
    const date = rowDate(row)

    return date !== null && !hasError(row) && !repeated.has(rowIndex) && logged.has(date)
      ? [date]
      : []
  })
}

export function undecided(dates: string[], choices: Choices): number {
  return dates.filter((date) => choices[date] === undefined).length
}

export function chooseForAll(dates: string[], choice: ImportChoice): Choices {
  return Object.fromEntries(dates.map((date) => [date, choice]))
}

export function sharedChoice(dates: string[], choices: Choices): ImportChoice | null {
  const first = dates[0] === undefined ? undefined : choices[dates[0]]

  if (first === undefined) {
    return null
  }

  return dates.every((date) => choices[date] === first) ? first : null
}

const COUNTED: Record<ImportChoice, 'skipped' | 'overwritten' | 'merged'> = {
  skip: 'skipped',
  overwrite: 'overwritten',
  merge: 'merged',
}

export function importPlan(
  sheet: ParsedSheet,
  picks: Picks,
  logged: ReadonlySet<string>,
  choices: Choices,
): ImportPlan {
  const repeated = repeatedRows(sheet)
  const counts: ImportCounts = { created: 0, overwritten: 0, merged: 0, skipped: 0, leftOut: 0 }
  const days: ImportDay[] = []

  sheet.rows.forEach((row, rowIndex) => {
    const entry = repeated.has(rowIndex) ? null : rowEntry(row, rowPicks(picks, rowIndex))

    if (entry === null) {
      counts.leftOut += 1
      return
    }

    if (!logged.has(entry.entry_date)) {
      counts.created += 1
      days.push({ entry })
      return
    }

    const choice = choices[entry.entry_date]

    if (choice === undefined) {
      counts.leftOut += 1
      return
    }

    counts[COUNTED[choice]] += 1
    days.push({ entry, choice })
  })

  return { days, counts, writes: counts.created + counts.overwritten + counts.merged }
}

export function repeatText(sheet: ParsedSheet, rowIndex: number, earlier: number): string {
  const date = sheet.rows[rowIndex] === undefined ? null : rowDate(sheet.rows[rowIndex])
  const day = date === null ? 'This date' : `Day ${dayLabel(date)}`

  return `${day} is also on row ${String(earlier + 1)}, so only that row is imported.`
}
