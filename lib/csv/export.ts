import { exportTables } from '../db/repository'
import { formatDuration } from '../duration'
import { localDate } from '../schema/dailyEntry'

import { zipFiles } from './zip'

import type { ZipFile } from './zip'
import type { DailyEntry, Exercise, WorkoutSession, WorkoutSet } from '../db/dexie'
import type { ExportTables } from '../db/repository'

export type SaveOutcome = 'shared' | 'downloaded' | 'cancelled'

export type DownloadLink = { href: string; download: string; click: () => void; remove: () => void }

export type SaveTarget = {
  canShare?: (data: ShareData) => boolean
  share: (data: ShareData) => Promise<void>
  createLink: () => DownloadLink
  createUrl: (file: File) => string
  revokeUrl: (url: string) => void
}

type Cell = string | number | boolean | null

const MONTHS = [
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

const DAILY_HEADER = [
  'Day',
  'Walk Time',
  'Gym Time',
  'Avg Heart Rate',
  'Highest Rate',
  'Weight',
  'Calories Burnt',
  'Steps',
  'Note',
]

const EXERCISE_HEADER = [
  'id',
  'name',
  'muscle_group',
  'is_archived',
  'built_in',
  'created_at',
  'updated_at',
]

const SESSION_HEADER = [
  'id',
  'entry_date',
  'started_at',
  'ended_at',
  'status',
  'length',
  'created_at',
  'updated_at',
]

const SET_HEADER = [
  'id',
  'session_id',
  'exercise_id',
  'exercise',
  'set_index',
  'reps',
  'weight_kg',
  'rpe',
  'completed_at',
  'created_at',
  'updated_at',
]

const NEEDS_QUOTES = /[",\r\n]|^\s|\s$/

const REVOKE_DELAY_MS = 1000

function cell(value: Cell): string {
  if (value === null) {
    return ''
  }

  const text = String(value)

  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function csv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((row) => `${row.map(cell).join(',')}\n`).join('')
}

function live<Row extends { deleted_at: string | null }>(rows: Row[]): Row[] {
  return rows.filter((row) => row.deleted_at === null)
}

function duration(seconds: number | null): string | null {
  return seconds === null ? null : formatDuration(seconds, 'hms')
}

function sheetDay(entryDate: string): string {
  const month = MONTHS[Number(entryDate.slice(5, 7)) - 1] ?? ''

  return `${month} ${String(Number(entryDate.slice(8, 10)))}`
}

export function dailyEntriesCsv(rows: DailyEntry[]): string {
  return csv(
    DAILY_HEADER,
    live(rows).map((row) => [
      sheetDay(row.entry_date),
      duration(row.walk_seconds),
      duration(row.gym_seconds),
      row.avg_heart_rate,
      row.max_heart_rate,
      row.weight_kg,
      row.calories_burnt,
      row.steps,
      row.note,
    ]),
  )
}

function dailyFiles(rows: DailyEntry[]): ZipFile[] {
  const byYear = new Map<string, DailyEntry[]>()

  for (const row of live(rows)) {
    const year = row.entry_date.slice(0, 4)
    byYear.set(year, [...(byYear.get(year) ?? []), row])
  }

  if (byYear.size === 0) {
    return [{ name: 'daily-entries.csv', text: dailyEntriesCsv([]) }]
  }

  return [...byYear.keys()].sort().map((year) => ({
    name: `daily-entries-${year}.csv`,
    text: dailyEntriesCsv(byYear.get(year) ?? []),
  }))
}

function exercisesCsv(rows: Exercise[]): string {
  return csv(
    EXERCISE_HEADER,
    live(rows).map((row) => [
      row.id,
      row.name,
      row.muscle_group,
      row.is_archived,
      row.user_id === null,
      row.created_at,
      row.updated_at,
    ]),
  )
}

function sessionLength(session: WorkoutSession): string | null {
  if (session.ended_at === null) {
    return null
  }

  return duration(
    Math.floor((Date.parse(session.ended_at) - Date.parse(session.started_at)) / 1000),
  )
}

function sessionsCsv(rows: WorkoutSession[]): string {
  return csv(
    SESSION_HEADER,
    live(rows).map((row) => [
      row.id,
      row.entry_date,
      row.started_at,
      row.ended_at,
      row.status,
      sessionLength(row),
      row.created_at,
      row.updated_at,
    ]),
  )
}

function setsCsv(rows: WorkoutSet[], exercises: Exercise[]): string {
  const names = new Map(exercises.map((exercise) => [exercise.id, exercise.name]))

  return csv(
    SET_HEADER,
    live(rows).map((row) => [
      row.id,
      row.session_id,
      row.exercise_id,
      names.get(row.exercise_id) ?? null,
      row.set_index,
      row.reps,
      row.weight_kg,
      row.rpe,
      row.completed_at,
      row.created_at,
      row.updated_at,
    ]),
  )
}

export function exportFiles(tables: ExportTables): ZipFile[] {
  return [
    ...dailyFiles(tables.dailyEntries),
    { name: 'exercises.csv', text: exercisesCsv(tables.exercises) },
    { name: 'workout-sessions.csv', text: sessionsCsv(tables.sessions) },
    { name: 'workout-sets.csv', text: setsCsv(tables.sets, tables.exercises) },
  ]
}

export function exportFileName(now: Date): string {
  return `gym-tracker-${localDate(now)}.zip`
}

export function buildExport(tables: ExportTables, now: Date): File {
  const bytes = zipFiles(exportFiles(tables), now)

  return new File([bytes], exportFileName(now), { type: 'application/zip' })
}

function isCancel(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === 'AbortError'
}

export function browserTarget(): SaveTarget {
  return {
    canShare:
      typeof navigator.canShare === 'function' ? (data) => navigator.canShare(data) : undefined,
    share: (data) => navigator.share(data),
    createLink: () => {
      const link = document.createElement('a')
      document.body.append(link)

      return link
    },
    createUrl: (file) => URL.createObjectURL(file),
    revokeUrl: (url) => {
      URL.revokeObjectURL(url)
    },
  }
}

export async function saveFile(file: File, target: SaveTarget): Promise<SaveOutcome> {
  const data = { files: [file], title: file.name }

  if (target.canShare?.(data) === true) {
    try {
      await target.share(data)
      return 'shared'
    } catch (cause) {
      if (isCancel(cause)) {
        return 'cancelled'
      }
    }
  }

  const url = target.createUrl(file)
  const link = target.createLink()
  link.href = url
  link.download = file.name
  link.click()
  link.remove()
  setTimeout(() => {
    target.revokeUrl(url)
  }, REVOKE_DELAY_MS)

  return 'downloaded'
}

export async function exportAllData(
  now: Date = new Date(),
  target: SaveTarget = browserTarget(),
): Promise<SaveOutcome> {
  return saveFile(buildExport(await exportTables(), now), target)
}
