import { formatDuration, parseInput, parseSheetValue } from '../duration'
import { dailyEntrySchema, localDate } from '../schema/dailyEntry'

export type SheetField =
  | 'entry_date'
  | 'walk_seconds'
  | 'gym_seconds'
  | 'avg_heart_rate'
  | 'max_heart_rate'
  | 'weight_kg'
  | 'calories_burnt'
  | 'steps'

export type DurationReading = { label: string; seconds: number }

export type SheetCell =
  | { status: 'ok'; raw: string; value: string | number | null }
  | { status: 'review'; raw: string; reason: string; readings: DurationReading[] }
  | { status: 'error'; raw: string; reason: string }

export type ParsedRow = { line: number; cells: Record<SheetField, SheetCell> }

export type SheetIssue = {
  kind: 'missing_column' | 'extra_column' | 'blank_row'
  line: number
  column: string | null
  message: string
}

export type ParsedSheet = { rows: ParsedRow[]; issues: SheetIssue[] }

type Kind = 'date' | 'duration' | 'number'

const COLUMNS: { name: string; field: SheetField; kind: Kind }[] = [
  { name: 'Day', field: 'entry_date', kind: 'date' },
  { name: 'Walk Time', field: 'walk_seconds', kind: 'duration' },
  { name: 'Gym Time', field: 'gym_seconds', kind: 'duration' },
  { name: 'Avg Heart Rate', field: 'avg_heart_rate', kind: 'number' },
  { name: 'Highest Rate', field: 'max_heart_rate', kind: 'number' },
  { name: 'Weight', field: 'weight_kg', kind: 'number' },
  { name: 'Calories Burnt', field: 'calories_burnt', kind: 'number' },
  { name: 'Steps', field: 'steps', kind: 'number' },
]

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]

const SHEET_DATE = /^([a-z]+)\s+(\d{1,2})$/i
const NUMBER = /^-?\d+(?:\.\d+)?$/

const BLANK_DATE_REASON = 'Enter a date such as August 12.'
const DATE_SHAPE_REASON = 'Write the date as a month name and a day, such as August 12.'
const NUMBER_REASON = 'Enter a number.'

type SheetRecord = { line: number; fields: string[] }

export function parseSheet(text: string, options: { year: number }): ParsedSheet {
  const [header, ...records] = readRecords(text.replace(/^﻿/, ''))
  const names = (header?.fields ?? []).map((name) => name.trim())
  const issues: SheetIssue[] = [...columnIssues(names)]
  const rows: ParsedRow[] = []

  for (const record of records) {
    if (record.fields.every((field) => field.trim() === '')) {
      issues.push({
        kind: 'blank_row',
        line: record.line,
        column: null,
        message: `Line ${String(record.line)} is blank, so it is skipped.`,
      })
      continue
    }

    rows.push({ line: record.line, cells: readRow(names, record.fields, options.year) })
  }

  return { rows, issues }
}

function columnIssues(names: string[]): SheetIssue[] {
  const missing = COLUMNS.filter(({ name }) => !names.includes(name)).map(({ name }) => ({
    kind: 'missing_column' as const,
    line: 1,
    column: name,
    message: `The sheet has no ${name} column.`,
  }))

  const extra = names
    .filter((name) => name !== '' && !COLUMNS.some((column) => column.name === name))
    .map((name) => ({
      kind: 'extra_column' as const,
      line: 1,
      column: name,
      message: `The ${name} column is not part of a daily entry, so it is ignored.`,
    }))

  return [...missing, ...extra]
}

function readRow(names: string[], fields: string[], year: number): Record<SheetField, SheetCell> {
  const cells = {} as Record<SheetField, SheetCell>

  for (const { name, field, kind } of COLUMNS) {
    const index = names.indexOf(name)
    const raw = (index === -1 ? '' : (fields[index] ?? '')).trim()

    cells[field] = readCell(kind, raw, year)
  }

  return validate(cells)
}

function readCell(kind: Kind, raw: string, year: number): SheetCell {
  if (kind === 'date') {
    return readDate(raw, year)
  }

  return kind === 'duration' ? readDuration(raw) : readNumber(raw)
}

function readDate(raw: string, year: number): SheetCell {
  if (raw === '') {
    return { status: 'error', raw, reason: BLANK_DATE_REASON }
  }

  const match = SHEET_DATE.exec(raw)
  const month = MONTHS.indexOf(match?.[1]?.toLowerCase() ?? '')

  if (match === null || month === -1) {
    return { status: 'error', raw, reason: DATE_SHAPE_REASON }
  }

  const day = Number(match[2])
  const date = new Date(Date.UTC(year, month, day))

  if (date.getUTCMonth() !== month || date.getUTCDate() !== day) {
    return { status: 'error', raw, reason: `${raw} does not exist in ${String(year)}.` }
  }

  return { status: 'ok', raw, value: date.toISOString().slice(0, 10) }
}

function readDuration(raw: string): SheetCell {
  const sheet = parseSheetValue(raw)

  if (sheet === null) {
    const input = parseInput(raw)

    if (raw === '' || raw === '-' || input.ok) {
      return { status: 'ok', raw, value: null }
    }

    return { status: 'error', raw, reason: input.reason }
  }

  if (sheet.certain) {
    return { status: 'ok', raw, value: sheet.seconds }
  }

  const decimal = parseInput(raw)
  const decimalSeconds = decimal.ok ? decimal.seconds : sheet.seconds

  return {
    status: 'review',
    raw,
    reason: `${raw} can mean minutes and seconds, or decimal minutes. Choose one.`,
    readings: [
      { label: `${formatDuration(sheet.seconds, 'minsec')} (as mm.ss)`, seconds: sheet.seconds },
      {
        label: `${raw} min · ${formatDuration(decimalSeconds, 'minsec')}`,
        seconds: decimalSeconds,
      },
    ],
  }
}

function readNumber(raw: string): SheetCell {
  if (raw === '') {
    return { status: 'ok', raw, value: null }
  }

  const compact = raw.replaceAll(',', '')

  if (!NUMBER.test(compact)) {
    return { status: 'error', raw, reason: NUMBER_REASON }
  }

  return { status: 'ok', raw, value: Number(compact) }
}

function validate(cells: Record<SheetField, SheetCell>): Record<SheetField, SheetCell> {
  const entry: Record<string, unknown> = { entry_date: localDate() }

  for (const { field } of COLUMNS) {
    const cell = cells[field]

    if (cell.status === 'ok') {
      entry[field] = cell.value
    }
  }

  const result = dailyEntrySchema.safeParse(entry)

  if (result.success) {
    return cells
  }

  const next = { ...cells }
  let changed = false

  for (const issue of result.error.issues) {
    const field = issue.path[0] as SheetField
    const cell = next[field]

    if (cell.status === 'ok') {
      next[field] = { status: 'error', raw: cell.raw, reason: issue.message }
      changed = true
    }
  }

  return changed ? validate(next) : next
}

function readRecords(text: string): SheetRecord[] {
  const records: SheetRecord[] = []
  let fields: string[] = []
  let field = ''
  let quoted = false
  let line = 1
  let start = 1
  let index = 0

  while (index < text.length) {
    const char = text.charAt(index)

    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        if (char === '\n') {
          line += 1
        }
        field += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      fields.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') {
        index += 1
      }
      fields.push(field)
      records.push({ line: start, fields })
      fields = []
      field = ''
      line += 1
      start = line
    } else {
      field += char
    }

    index += 1
  }

  if (field !== '' || fields.length > 0) {
    fields.push(field)
    records.push({ line: start, fields })
  }

  return records
}
