import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../db/dexie'
import { upsertDay } from '../db/repository'
import { parseSheetValue } from '../duration'
import { dailyEntrySchema } from '../schema/dailyEntry'

import {
  browserTarget,
  buildExport,
  dailyEntriesCsv,
  exportAllData,
  exportFileName,
  exportFiles,
  saveFile,
} from './export'
import { parseSheet, rowEntry } from './import'

import type { SaveTarget } from './export'
import type { DailyEntry, Exercise, WorkoutSession, WorkoutSet } from '../db/dexie'
import type { ExportTables } from '../db/repository'

vi.mock('../supabase/client', () => ({
  createClient: () => {
    throw new Error('no network in a unit test')
  },
}))

const IMPORTED_FIELDS = [
  'entry_date',
  'walk_seconds',
  'gym_seconds',
  'avg_heart_rate',
  'max_heart_rate',
  'weight_kg',
  'calories_burnt',
  'steps',
] as const

const NOW = new Date(2026, 9, 4, 9, 15, 0)

const BENCH_ID = '33333333-3333-4333-8333-333333333333'

function day(entryDate: string, overrides: Partial<DailyEntry> = {}): DailyEntry {
  return {
    ...dailyEntrySchema.parse({ entry_date: entryDate }),
    id: crypto.randomUUID(),
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    deleted_at: null,
    ...overrides,
  }
}

const FULL_DAYS: DailyEntry[] = [
  day('2026-01-01', {
    walk_seconds: 954,
    gym_seconds: 4325,
    avg_heart_rate: 128,
    max_heart_rate: 171,
    weight_kg: 82.45,
    calories_burnt: 612,
    steps: 11482,
    note: 'Legs, then "a long" walk',
  }),
  day('2026-02-28', { walk_seconds: 59, gym_seconds: 86400, weight_kg: 80 }),
  day('2026-08-12', { walk_seconds: 3600, steps: 0, calories_burnt: 0 }),
  day('2026-09-30'),
  day('2026-10-04', { gym_seconds: 2700, note: 'Line one\nline two' }),
]

const BENCH: Exercise = {
  id: BENCH_ID,
  user_id: null,
  name: 'Bench Press',
  muscle_group: 'chest',
  is_archived: false,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  deleted_at: null,
}

const SESSION: WorkoutSession = {
  id: '66666666-6666-4666-8666-666666666666',
  entry_date: '2026-10-03',
  started_at: '2026-10-03T17:00:00.000Z',
  ended_at: '2026-10-03T18:02:10.000Z',
  status: 'finished',
  created_at: '2026-10-03T17:00:00.000Z',
  updated_at: '2026-10-03T18:02:10.000Z',
  deleted_at: null,
}

const SET: WorkoutSet = {
  id: '77777777-7777-4777-8777-777777777777',
  session_id: SESSION.id,
  exercise_id: BENCH_ID,
  set_index: 0,
  reps: 8,
  weight_kg: 62.5,
  rpe: null,
  completed_at: '2026-10-03T17:10:00.000Z',
  created_at: '2026-10-03T17:10:00.000Z',
  updated_at: '2026-10-03T17:10:00.000Z',
  deleted_at: null,
}

function tables(overrides: Partial<ExportTables> = {}): ExportTables {
  return { dailyEntries: [], exercises: [BENCH], sessions: [SESSION], sets: [SET], ...overrides }
}

function imported(text: string, year: number) {
  return parseSheet(text, { year }).rows.map((row) => rowEntry(row, {}))
}

function importedFields(entry: DailyEntry) {
  return Object.fromEntries(IMPORTED_FIELDS.map((field) => [field, entry[field]]))
}

function fileText(files: ReturnType<typeof exportFiles>, name: string): string {
  const file = files.find((item) => item.name === name)

  expect(file?.name).toBe(name)

  return file?.text ?? ''
}

function fakeTarget(canShare: boolean | undefined, share = vi.fn(() => Promise.resolve())) {
  const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() }
  const target: SaveTarget = {
    canShare: canShare === undefined ? undefined : vi.fn(() => canShare),
    share,
    createLink: vi.fn(() => link),
    createUrl: vi.fn(() => 'blob:export'),
    revokeUrl: vi.fn(),
  }

  return { target, link }
}

describe('the daily entries round trip', () => {
  it('imports back every field the importer reads, unchanged', () => {
    const text = dailyEntriesCsv(FULL_DAYS)

    expect(imported(text, 2026)).toEqual(FULL_DAYS.map(importedFields))
  })

  it('reads every row as ok, with nothing to review', () => {
    const sheet = parseSheet(dailyEntriesCsv(FULL_DAYS), { year: 2026 })

    for (const row of sheet.rows) {
      expect(Object.values(row.cells).map((cell) => cell.status)).toEqual(
        Array.from({ length: IMPORTED_FIELDS.length }, () => 'ok'),
      )
    }
  })

  it('writes every duration so that it parses back as certain', () => {
    const sheet = parseSheet(dailyEntriesCsv(FULL_DAYS), { year: 2026 })
    const durations = sheet.rows.flatMap((row) => [
      row.cells.walk_seconds.raw,
      row.cells.gym_seconds.raw,
    ])
    const written = durations.filter((raw) => raw !== '')

    expect(written).toEqual(['0:15:54', '1:12:05', '0:00:59', '24:00:00', '1:00:00', '0:45:00'])

    for (const raw of written) {
      expect(parseSheetValue(raw)).toMatchObject({ certain: true })
    }
  })

  it('names only the note column as one the importer leaves out', () => {
    expect(parseSheet(dailyEntriesCsv(FULL_DAYS), { year: 2026 }).issues).toEqual([
      expect.objectContaining({ kind: 'extra_column', column: 'Note' }),
    ])
  })

  it('keeps a note with a comma, a quote and a line break in one cell', () => {
    const text = dailyEntriesCsv(FULL_DAYS)

    expect(text).toContain('"Legs, then ""a long"" walk"')
    expect(text).toContain('"Line one\nline two"')
    expect(parseSheet(text, { year: 2026 }).rows).toHaveLength(FULL_DAYS.length)
  })

  it('writes the header and nothing else for no days', () => {
    expect(dailyEntriesCsv([])).toBe(
      'Day,Walk Time,Gym Time,Avg Heart Rate,Highest Rate,Weight,Calories Burnt,Steps,Note\n',
    )
  })

  it('leaves out a soft-deleted day', () => {
    const gone = day('2026-03-03', { deleted_at: '2026-03-04T10:00:00.000Z', steps: 4321 })
    const text = dailyEntriesCsv([gone, ...FULL_DAYS])

    expect(text).not.toContain('March 3')
    expect(text).not.toContain('4321')
  })
})

describe('exportFiles', () => {
  it('writes one daily entries file for each year, named by the year', () => {
    const files = exportFiles(
      tables({ dailyEntries: [day('2025-12-31', { steps: 900 }), day('2026-01-01')] }),
    )

    expect(files.map((file) => file.name)).toEqual([
      'daily-entries-2025.csv',
      'daily-entries-2026.csv',
      'exercises.csv',
      'workout-sessions.csv',
      'workout-sets.csv',
    ])
    expect(imported(fileText(files, 'daily-entries-2025.csv'), 2025)).toEqual([
      expect.objectContaining({ entry_date: '2025-12-31', steps: 900 }),
    ])
  })

  it('writes an empty daily entries file when no day is logged', () => {
    const files = exportFiles(tables())

    expect(fileText(files, 'daily-entries.csv')).toBe(dailyEntriesCsv([]))
  })

  it('writes the exercises with a built in column', () => {
    const own: Exercise = {
      ...BENCH,
      id: '88888888-8888-4888-8888-888888888888',
      user_id: 'someone',
      name: 'Cable, Fly',
      is_archived: true,
    }

    expect(fileText(exportFiles(tables({ exercises: [BENCH, own] })), 'exercises.csv')).toBe(
      [
        'id,name,muscle_group,is_archived,built_in,created_at,updated_at',
        `${BENCH_ID},Bench Press,chest,false,true,2026-09-01T00:00:00.000Z,2026-09-01T00:00:00.000Z`,
        `${own.id},"Cable, Fly",chest,true,false,2026-09-01T00:00:00.000Z,2026-09-01T00:00:00.000Z`,
        '',
      ].join('\n'),
    )
  })

  it('writes the sessions with their length in h:mm:ss', () => {
    const active: WorkoutSession = {
      ...SESSION,
      id: '99999999-9999-4999-8999-999999999999',
      ended_at: null,
      status: 'active',
    }

    expect(
      fileText(exportFiles(tables({ sessions: [SESSION, active] })), 'workout-sessions.csv'),
    ).toBe(
      [
        'id,entry_date,started_at,ended_at,status,length,created_at,updated_at',
        `${SESSION.id},2026-10-03,2026-10-03T17:00:00.000Z,2026-10-03T18:02:10.000Z,finished,1:02:10,2026-10-03T17:00:00.000Z,2026-10-03T18:02:10.000Z`,
        `${active.id},2026-10-03,2026-10-03T17:00:00.000Z,,active,,2026-10-03T17:00:00.000Z,2026-10-03T18:02:10.000Z`,
        '',
      ].join('\n'),
    )
  })

  it('writes the sets with the name of their exercise', () => {
    const unknown: WorkoutSet = {
      ...SET,
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      exercise_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      weight_kg: null,
      rpe: 8,
      completed_at: null,
    }

    expect(fileText(exportFiles(tables({ sets: [SET, unknown] })), 'workout-sets.csv')).toBe(
      [
        'id,session_id,exercise_id,exercise,set_index,reps,weight_kg,rpe,completed_at,created_at,updated_at',
        `${SET.id},${SESSION.id},${BENCH_ID},Bench Press,0,8,62.5,,2026-10-03T17:10:00.000Z,2026-10-03T17:10:00.000Z,2026-10-03T17:10:00.000Z`,
        `${unknown.id},${SESSION.id},${unknown.exercise_id},,0,8,,8,,2026-10-03T17:10:00.000Z,2026-10-03T17:10:00.000Z`,
        '',
      ].join('\n'),
    )
  })

  it('leaves out a soft-deleted row of every table', () => {
    const deletedAt = '2026-10-04T08:00:00.000Z'
    const files = exportFiles({
      dailyEntries: [day('2026-10-01', { deleted_at: deletedAt })],
      exercises: [{ ...BENCH, deleted_at: deletedAt }],
      sessions: [{ ...SESSION, deleted_at: deletedAt }],
      sets: [{ ...SET, deleted_at: deletedAt }],
    })

    expect(files.map((file) => file.text.split('\n').length)).toEqual([2, 2, 2, 2])
  })
})

describe('exportFileName', () => {
  it('names the zip after the local date', () => {
    expect(exportFileName(NOW)).toBe('gym-tracker-2026-10-04.zip')
  })
})

describe('buildExport', () => {
  it('returns a zip file that holds every csv as plain text', async () => {
    const file = buildExport(tables({ dailyEntries: FULL_DAYS }), NOW)
    const bytes = new TextDecoder().decode(await file.arrayBuffer())

    expect(file.name).toBe('gym-tracker-2026-10-04.zip')
    expect(file.type).toBe('application/zip')
    expect(bytes.startsWith('PK')).toBe(true)
    expect(bytes).toContain(dailyEntriesCsv(FULL_DAYS))
    expect(bytes).toContain('workout-sets.csv')
  })
})

describe('saveFile', () => {
  const file = new File(['zip'], 'gym-tracker-2026-10-04.zip', { type: 'application/zip' })

  it('hands the file to the share sheet when the device can share it', async () => {
    const { target, link } = fakeTarget(true)

    expect(await saveFile(file, target)).toBe('shared')
    expect(target.share).toHaveBeenCalledWith({ files: [file], title: file.name })
    expect(link.click).not.toHaveBeenCalled()
  })

  it('reads a closed share sheet as a cancel and saves nothing', async () => {
    const share = vi.fn(() => Promise.reject(new DOMException('closed', 'AbortError')))
    const { target, link } = fakeTarget(true, share)

    expect(await saveFile(file, target)).toBe('cancelled')
    expect(link.click).not.toHaveBeenCalled()
  })

  it('falls back to a download when the share fails for another reason', async () => {
    const share = vi.fn(() => Promise.reject(new DOMException('blocked', 'NotAllowedError')))
    const { target, link } = fakeTarget(true, share)

    expect(await saveFile(file, target)).toBe('downloaded')
    expect(link.click).toHaveBeenCalledOnce()
  })

  it('starts a download when the device cannot share a file', async () => {
    const { target, link } = fakeTarget(false)

    expect(await saveFile(file, target)).toBe('downloaded')
    expect(target.share).not.toHaveBeenCalled()
    expect(target.createUrl).toHaveBeenCalledWith(file)
    expect(link).toMatchObject({ href: 'blob:export', download: file.name })
    expect(link.click).toHaveBeenCalledOnce()
    expect(link.remove).toHaveBeenCalledOnce()
  })

  it('starts a download when the browser has no share at all', async () => {
    const { target, link } = fakeTarget(undefined)

    expect(await saveFile(file, target)).toBe('downloaded')
    expect(link.click).toHaveBeenCalledOnce()
  })

  it('lets the link go once the download has started', async () => {
    vi.useFakeTimers()

    try {
      const { target } = fakeTarget(false)
      await saveFile(file, target)
      expect(target.revokeUrl).not.toHaveBeenCalled()

      await vi.runAllTimersAsync()

      expect(target.revokeUrl).toHaveBeenCalledWith('blob:export')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('exportAllData', () => {
  beforeEach(async () => {
    await db.open()
    await Promise.all([
      db.dailyEntries.clear(),
      db.outbox.clear(),
      db.syncMeta.clear(),
      db.exercises.clear(),
      db.workoutSessions.clear(),
      db.workoutSets.clear(),
    ])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('saves the zip read from this device with the network down', async () => {
    const fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
    vi.stubGlobal('fetch', fetch)
    await upsertDay(dailyEntrySchema.parse({ entry_date: '2026-09-02', walk_seconds: 954 }))
    const { target } = fakeTarget(false)

    expect(await exportAllData(NOW, target)).toBe('downloaded')

    const saved = vi.mocked(target.createUrl).mock.calls[0]?.[0]
    const bytes = new TextDecoder().decode(await saved?.arrayBuffer())
    expect(saved?.name).toBe('gym-tracker-2026-10-04.zip')
    expect(bytes).toContain('September 2,0:15:54,')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('leaves a soft-deleted day out of the zip', async () => {
    await db.dailyEntries.put(
      day('2026-09-03', { steps: 4321, deleted_at: '2026-09-04T10:00:00.000Z' }),
    )
    const { target } = fakeTarget(false)

    await exportAllData(NOW, target)

    const saved = vi.mocked(target.createUrl).mock.calls[0]?.[0]
    const bytes = new TextDecoder().decode(await saved?.arrayBuffer())
    expect(bytes).not.toContain('4321')
    expect(bytes).not.toContain('September 3')
  })
})

describe('browserTarget', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shares through the navigator when it can check a file', async () => {
    const share = vi.fn(() => Promise.resolve())
    const canShare = vi.fn(() => true)
    vi.stubGlobal('navigator', { canShare, share })
    const target = browserTarget()
    const data = { files: [new File(['x'], 'a.zip')] }

    expect(target.canShare?.(data)).toBe(true)
    await target.share(data)

    expect(canShare).toHaveBeenCalledWith(data)
    expect(share).toHaveBeenCalledWith(data)
  })

  it('offers no share check when the navigator has none', () => {
    vi.stubGlobal('navigator', {})

    expect(browserTarget().canShare).toBeUndefined()
  })

  it('makes a link in the page and object urls for the file', () => {
    const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() }
    const append = vi.fn()
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('document', { createElement: vi.fn(() => link), body: { append } })
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:a')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined)
    const target = browserTarget()
    const file = new File(['x'], 'a.zip')

    expect(target.createLink()).toBe(link)
    expect(append).toHaveBeenCalledWith(link)
    expect(target.createUrl(file)).toBe('blob:a')
    target.revokeUrl('blob:a')

    expect(createObjectURL).toHaveBeenCalledWith(file)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:a')
  })
})
