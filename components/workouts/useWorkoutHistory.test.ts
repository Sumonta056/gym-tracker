import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../../lib/db/dexie'
import { updateProfile } from '../../lib/db/repository'
import {
  BENCH,
  EXERCISES,
  LEG,
  ROW,
  exercise,
  liftSet,
  sessionOn,
} from '../../tests/fixtures/lifts'

import {
  HISTORY_PAGE,
  readHistory,
  readSession,
  useHistory,
  useSessionView,
} from './useWorkoutHistory'

vi.mock('../../lib/supabase/client', () => ({
  createClient: () => {
    throw new Error('no network in a hook test')
  },
}))

beforeEach(async () => {
  vi.restoreAllMocks()
  await db.open()
  await Promise.all([
    db.workoutSessions.clear(),
    db.workoutSets.clear(),
    db.exercises.clear(),
    db.outbox.clear(),
    db.profiles.clear(),
    db.syncMeta.clear(),
  ])
  await db.exercises.bulkPut(EXERCISES)
})

describe('HISTORY_PAGE', () => {
  it('pages the history 30 sessions at a time', () => {
    expect(HISTORY_PAGE).toBe(30)
  })
})

describe('readHistory', () => {
  it('lists the finished sessions newest first', async () => {
    const old = sessionOn('2026-09-01')
    const recent = sessionOn('2026-09-08')
    await db.workoutSessions.bulkPut([old, recent])

    const list = await readHistory(30)

    expect(list.rows.map((row) => row.session.id)).toEqual([recent.id, old.id])
  })

  it('counts the sets and the volume of each session alone', async () => {
    const old = sessionOn('2026-09-01')
    const recent = sessionOn('2026-09-08')
    await db.workoutSessions.bulkPut([old, recent])
    await db.workoutSets.bulkPut([
      liftSet(recent, BENCH, 10, 60),
      liftSet(recent, BENCH, 8, 65),
      liftSet(old, LEG, 12, 100),
    ])

    const list = await readHistory(30)

    expect(list.rows.map((row) => row.stats)).toEqual([
      { durationSeconds: 3600, setCount: 2, exerciseCount: 1, volumeKg: 1120, newRecords: [] },
      { durationSeconds: 3600, setCount: 1, exerciseCount: 1, volumeKg: 1200, newRecords: [] },
    ])
  })

  it('names a record in a row when an earlier session was lighter', async () => {
    const old = sessionOn('2026-09-01')
    const recent = sessionOn('2026-09-08')
    await db.workoutSessions.bulkPut([old, recent])
    await db.workoutSets.bulkPut([liftSet(old, BENCH, 10, 60), liftSet(recent, BENCH, 10, 80)])

    const list = await readHistory(30)

    expect(list.rows.map((row) => row.stats.newRecords)).toEqual([
      [{ exerciseId: BENCH, weightKg: 80, reps: 10 }],
      [],
    ])
  })

  it('counts a record against an earlier session past the loaded page', async () => {
    const old = sessionOn('2026-09-01')
    const recent = sessionOn('2026-09-08')
    await db.workoutSessions.bulkPut([old, recent])
    await db.workoutSets.bulkPut([liftSet(old, BENCH, 10, 60), liftSet(recent, BENCH, 10, 80)])

    const list = await readHistory(1)

    expect(list.rows[0]?.stats.newRecords).toEqual([{ exerciseId: BENCH, weightKg: 80, reps: 10 }])
  })

  it('lists the muscle groups of each session once, in the order of the first set', async () => {
    const session = sessionOn('2026-09-08')
    await db.exercises.put({ ...exercise(LEG, 'Leg press'), muscle_group: 'legs' })
    await db.exercises.put({
      ...exercise(ROW, 'Seated row'),
      muscle_group: 'back',
      is_archived: true,
    })
    await db.workoutSessions.put(session)
    await db.workoutSets.bulkPut([
      liftSet(session, LEG, 10, 100),
      liftSet(session, BENCH, 10, 60),
      liftSet(session, ROW, 10, 50),
      liftSet(session, LEG, 8, 110),
    ])

    const list = await readHistory(30)

    expect(list.rows[0]?.groups).toEqual(['legs', 'chest', 'back'])
  })

  it('leaves out a soft-deleted set', async () => {
    const session = sessionOn('2026-09-08')
    await db.workoutSessions.put(session)
    await db.workoutSets.bulkPut([
      liftSet(session, BENCH, 10, 60),
      liftSet(session, BENCH, 10, 60, { deleted_at: '2026-09-08T14:00:00.000Z' }),
    ])

    const list = await readHistory(30)

    expect(list.rows[0]?.stats.setCount).toBe(1)
  })

  it('says that more sessions exist past the limit', async () => {
    await db.workoutSessions.bulkPut([
      sessionOn('2026-09-01'),
      sessionOn('2026-09-02'),
      sessionOn('2026-09-03'),
    ])

    const list = await readHistory(2)

    expect([list.rows.length, list.hasMore]).toEqual([2, true])
  })

  it('says that no more sessions exist at the limit', async () => {
    await db.workoutSessions.bulkPut([sessionOn('2026-09-01'), sessionOn('2026-09-02')])

    expect((await readHistory(2)).hasMore).toBe(false)
  })

  it('returns no row on an empty device', async () => {
    expect(await readHistory(30)).toEqual({ rows: [], hasMore: false, unit: 'metric' })
  })

  it('reads the unit as metric by default', async () => {
    expect((await readHistory(30)).unit).toBe('metric')
  })

  it('reads the unit from the profile', async () => {
    await updateProfile({ unit_system: 'imperial' })

    expect((await readHistory(30)).unit).toBe('imperial')
  })
})

describe('readSession', () => {
  it('says an unknown id is missing', async () => {
    expect(await readSession(crypto.randomUUID())).toEqual({ status: 'missing' })
  })

  it('says a soft-deleted session is missing', async () => {
    const removed = sessionOn('2026-09-08', { deleted_at: '2026-09-09T10:00:00.000Z' })
    await db.workoutSessions.put(removed)

    expect(await readSession(removed.id)).toEqual({ status: 'missing' })
  })

  it('says the active session is still running', async () => {
    const running = sessionOn('2026-09-08', { status: 'active', ended_at: null })
    await db.workoutSessions.put(running)

    expect(await readSession(running.id)).toEqual({ status: 'running' })
  })

  it('finds a finished session with its live sets', async () => {
    const session = sessionOn('2026-09-08')
    const bench = liftSet(session, BENCH, 10, 60)
    const leg = liftSet(session, LEG, 12, 100)
    await db.workoutSessions.put(session)
    await db.workoutSets.bulkPut([
      bench,
      leg,
      liftSet(session, BENCH, 5, 70, { deleted_at: '2026-09-08T14:00:00.000Z' }),
    ])

    const view = await readSession(session.id)

    expect(view).toMatchObject({ status: 'found', session, unit: 'metric' })
    expect(view.status === 'found' ? view.sets.map((set) => set.id) : []).toEqual([
      bench.id,
      leg.id,
    ])
  })

  it('counts the stats of the session', async () => {
    const session = sessionOn('2026-09-08')
    await db.workoutSessions.put(session)
    await db.workoutSets.bulkPut([liftSet(session, BENCH, 10, 60), liftSet(session, LEG, 12, 100)])

    const view = await readSession(session.id)

    expect(view.status === 'found' ? view.stats : null).toEqual({
      durationSeconds: 3600,
      setCount: 2,
      exerciseCount: 2,
      volumeKg: 1800,
      newRecords: [],
    })
  })

  it('maps every exercise by id, an archived one too', async () => {
    const session = sessionOn('2026-09-08')
    await db.exercises.put({ ...exercise(ROW, 'Seated row'), is_archived: true })
    await db.workoutSessions.put(session)
    await db.workoutSets.put(liftSet(session, ROW, 10, 50))

    const view = await readSession(session.id)

    expect(view.status === 'found' ? view.exercises.get(ROW)?.name : null).toBe('Seated row')
  })

  it('names a record when an earlier session lifted less on the same exercise', async () => {
    const earlier = sessionOn('2026-09-01')
    const session = sessionOn('2026-09-08')
    await db.workoutSessions.bulkPut([earlier, session])
    await db.workoutSets.bulkPut([
      liftSet(earlier, BENCH, 5, 100),
      liftSet(session, BENCH, 3, 102.5),
    ])

    const view = await readSession(session.id)

    expect(view.status === 'found' ? view.stats.newRecords : null).toEqual([
      { exerciseId: BENCH, weightKg: 102.5, reps: 3 },
    ])
  })

  it('names no record when no earlier set exists', async () => {
    const session = sessionOn('2026-09-08')
    await db.workoutSessions.put(session)
    await db.workoutSets.put(liftSet(session, BENCH, 3, 102.5))

    const view = await readSession(session.id)

    expect(view.status === 'found' ? view.stats.newRecords : null).toEqual([])
  })

  it('names no record from a heavier set done after the session started', async () => {
    const session = sessionOn('2026-09-08')
    const later = sessionOn('2026-09-15')
    await db.workoutSessions.bulkPut([session, later])
    await db.workoutSets.bulkPut([liftSet(later, BENCH, 5, 100), liftSet(session, BENCH, 3, 102.5)])

    const view = await readSession(session.id)

    expect(view.status === 'found' ? view.stats.newRecords : null).toEqual([])
  })

  it('reads the unit from the profile', async () => {
    const session = sessionOn('2026-09-08')
    await db.workoutSessions.put(session)
    await updateProfile({ unit_system: 'imperial' })

    const view = await readSession(session.id)

    expect(view.status === 'found' ? view.unit : null).toBe('imperial')
  })
})

describe('useHistory', () => {
  it('resolves to the history of the device', async () => {
    const session = sessionOn('2026-09-08')
    await db.workoutSessions.put(session)

    const { result } = renderHook(() => useHistory(30))

    await waitFor(() => {
      expect(result.current?.rows.map((row) => row.session.id)).toEqual([session.id])
    })
  })

  it('resolves to null when the device cannot be read', async () => {
    vi.spyOn(db.workoutSessions, 'where').mockImplementation(() => {
      throw new Error('broken')
    })

    const { result } = renderHook(() => useHistory(30))

    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })
})

describe('useSessionView', () => {
  it('resolves to the view of the session', async () => {
    const session = sessionOn('2026-09-08')
    await db.workoutSessions.put(session)

    const { result } = renderHook(() => useSessionView(session.id))

    await waitFor(() => {
      expect(result.current?.status).toBe('found')
    })
  })

  it('resolves to null when the device cannot be read', async () => {
    vi.spyOn(db.workoutSessions, 'get').mockImplementation(() => {
      throw new Error('broken')
    })

    const { result } = renderHook(() => useSessionView(crypto.randomUUID()))

    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })
})
