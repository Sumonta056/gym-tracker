import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../../lib/db/dexie'
import { BENCH, EXERCISES, LEG, liftSet, sessionOn } from '../../tests/fixtures/lifts'

import {
  HISTORY_READ_FAILED,
  RUNNING_SESSION,
  UNKNOWN_SESSION,
  WorkoutHistory,
} from './WorkoutHistory'

import type * as Repository from '../../lib/db/repository'

let search = new URLSearchParams()

const failing = vi.hoisted(() => ({ history: false, session: false }))

vi.mock('../../lib/db/repository', async (importOriginal) => {
  const actual = await importOriginal<typeof Repository>()
  return {
    ...actual,
    listFinishedSessions: (limit: number) =>
      failing.history ? Promise.reject(new Error('blocked')) : actual.listFinishedSessions(limit),
    getSession: (id: string) =>
      failing.session ? Promise.reject(new Error('blocked')) : actual.getSession(id),
  }
})

vi.mock('next/navigation', () => ({
  useSearchParams: () => search,
}))

vi.mock('../../lib/supabase/client', () => ({
  createClient: () => {
    throw new Error('no network in a component test')
  },
}))

function dayOf(index: number): string {
  return new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10)
}

beforeEach(async () => {
  search = new URLSearchParams()
  failing.history = false
  failing.session = false
  await db.open()
  await Promise.all([
    db.workoutSessions.clear(),
    db.workoutSets.clear(),
    db.exercises.clear(),
    db.outbox.clear(),
  ])
  await db.exercises.bulkPut(EXERCISES)
})

function sessionLinks(scope: HTMLElement | typeof screen = screen): HTMLElement[] {
  const query = scope === screen ? screen : within(scope as HTMLElement)

  return query
    .getAllByRole('link')
    .filter(
      (link) =>
        !link.hasAttribute('data-today') && !/^Open /.test(link.getAttribute('aria-label') ?? ''),
    )
}

describe('WorkoutHistory', () => {
  it('lists the finished sessions newest first', async () => {
    const old = sessionOn('2026-09-01')
    const recent = sessionOn('2026-09-08')
    await db.workoutSessions.bulkPut([old, recent])
    await db.workoutSets.bulkPut([liftSet(recent, BENCH, 10, 60), liftSet(recent, BENCH, 8, 65)])
    render(<WorkoutHistory />)

    const history = await screen.findByRole('region', { name: 'History' })
    const rows = sessionLinks(history)
    expect(rows[0]).toHaveTextContent('Tue 8 Sep')
    expect(rows[0]).toHaveTextContent('1,120 kg')
    expect(rows[0]).toHaveTextContent('1h · 2 sets · Chest')
    expect(rows[1]).toHaveTextContent('Tue 1 Sep')
  })

  it('shows the next 30 sessions only after Show more', async () => {
    await db.workoutSessions.bulkPut(
      Array.from({ length: 31 }, (_, index) => sessionOn(dayOf(index))),
    )
    render(<WorkoutHistory />)

    await screen.findByRole('region', { name: 'History' })
    expect(sessionLinks()).toHaveLength(30)
    await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
    await waitFor(() => {
      expect(sessionLinks()).toHaveLength(31)
    })
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull()
  })

  it('shows the exercises and the sets of the session in the query', async () => {
    const session = sessionOn('2026-09-08')
    await db.workoutSessions.put(session)
    await db.workoutSets.bulkPut([liftSet(session, BENCH, 10, 60), liftSet(session, LEG, 12, 100)])
    search = new URLSearchParams({ session: session.id })
    render(<WorkoutHistory />)

    expect(await screen.findByRole('region', { name: 'Bench press' })).toHaveTextContent(
      'Set 110 × 60 kg',
    )
    expect(screen.getByRole('region', { name: 'Leg press' })).toHaveTextContent('Set 112 × 100 kg')
    expect(screen.getByRole('link', { name: 'All sessions' })).toHaveAttribute('href', '/workouts')
  })

  it('shows the list with a note for an unknown id', async () => {
    await db.workoutSessions.put(sessionOn('2026-09-08'))
    search = new URLSearchParams({ session: crypto.randomUUID() })
    render(<WorkoutHistory />)

    expect(await screen.findByText(UNKNOWN_SESSION)).toHaveAttribute('role', 'status')
    expect(screen.getByRole('region', { name: 'History' })).toBeInTheDocument()
  })

  it('shows the list with a note for the running session', async () => {
    const running = sessionOn('2026-09-08', { status: 'active', ended_at: null })
    await db.workoutSessions.put(running)
    search = new URLSearchParams({ session: running.id })
    render(<WorkoutHistory />)

    expect(await screen.findByText(RUNNING_SESSION)).toBeVisible()
  })

  it('says so when the device cannot be read', async () => {
    failing.history = true
    render(<WorkoutHistory />)

    expect(await screen.findByRole('alert')).toHaveTextContent(HISTORY_READ_FAILED)
  })

  it('shows the list with a note for a soft-deleted session', async () => {
    const removed = sessionOn('2026-09-08', { deleted_at: '2026-09-09T10:00:00.000Z' })
    await db.workoutSessions.bulkPut([removed, sessionOn('2026-09-01')])
    search = new URLSearchParams({ session: removed.id })
    render(<WorkoutHistory />)

    expect(await screen.findByText(UNKNOWN_SESSION)).toHaveAttribute('role', 'status')
    expect(screen.getByRole('region', { name: 'History' })).toBeInTheDocument()
  })

  it('says so when the session in the query cannot be read', async () => {
    const session = sessionOn('2026-09-08')
    await db.workoutSessions.put(session)
    failing.session = true
    search = new URLSearchParams({ session: session.id })
    render(<WorkoutHistory />)

    expect(await screen.findByRole('alert')).toHaveTextContent(HISTORY_READ_FAILED)
  })

  it('shows the list with no note for an empty session query', async () => {
    await db.workoutSessions.put(sessionOn('2026-09-08'))
    search = new URLSearchParams({ session: '' })
    render(<WorkoutHistory />)

    const history = await screen.findByRole('region', { name: 'History' })
    expect(sessionLinks(history)).toHaveLength(1)
    expect(within(history).getByRole('link', { name: 'Open Tue 8 Sep' })).toHaveAttribute(
      'href',
      '/?date=2026-09-08',
    )
    expect(screen.queryByRole('status')).toBeNull()
  })
})
