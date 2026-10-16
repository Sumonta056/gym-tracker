import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { sessionStats } from '../../lib/metrics/sessionStats'
import { BENCH, liftSet, sessionOn } from '../../tests/fixtures/lifts'
import { startedText } from '../workout/SessionTimer'

import { sessionDetail, TodayWorkoutCard } from './TodayWorkoutCard'

import type { TodayWorkout } from './summary'

const SESSION = sessionOn('2026-09-23')
const STATS = sessionStats(
  SESSION,
  [liftSet(SESSION, BENCH, 10, 60), liftSet(SESSION, BENCH, 8, 65)],
  [],
)
const FULL: TodayWorkout = { session: SESSION, stats: STATS }

const EMPTY_SESSION = sessionOn('2026-09-23', {
  id: '00000000-0000-4000-8000-000000000999',
  started_at: '2026-09-23T08:00:00.000Z',
  ended_at: '2026-09-23T08:00:20.000Z',
})
const EMPTY: TodayWorkout = {
  session: EMPTY_SESSION,
  stats: sessionStats(EMPTY_SESSION, [], []),
}

function totals(): HTMLElement {
  return screen.getByText('Time').closest('div')?.parentElement as HTMLElement
}

describe('TodayWorkoutCard', () => {
  it('has a heading for the card', () => {
    render(<TodayWorkoutCard workouts={[FULL]} unit="metric" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Workout today' })).toBeInTheDocument()
  })

  it('counts the sessions of the day', () => {
    render(<TodayWorkoutCard workouts={[FULL, EMPTY]} unit="metric" />)
    expect(screen.getByText('2 sessions')).toBeInTheDocument()
  })

  it('adds the time, the sets and the volume of every session', () => {
    render(<TodayWorkoutCard workouts={[FULL, EMPTY]} unit="metric" />)
    const box = totals()
    expect(box).toHaveTextContent('Time1h')
    expect(box).toHaveTextContent('Sets2')
    expect(box).toHaveTextContent('Volume1,120kg')
  })

  it('shows the volume total in pounds for an imperial user', () => {
    render(<TodayWorkoutCard workouts={[FULL]} unit="imperial" />)
    expect(totals()).toHaveTextContent('Volume2,469lb')
  })

  it('links each session to its detail', () => {
    render(<TodayWorkoutCard workouts={[FULL]} unit="metric" />)
    const row = screen.getByRole('link')
    expect(row).toHaveAttribute('href', `/workouts?session=${SESSION.id}`)
    expect(row).toHaveTextContent(startedText(SESSION.started_at))
    expect(row).toHaveTextContent('1 exercise · 2 sets · 1,120 kg · 1h')
  })

  it('gives each row a target taller than 44 px', () => {
    render(<TodayWorkoutCard workouts={[FULL]} unit="metric" />)
    expect(screen.getByRole('link')).toHaveClass('min-h-14')
  })

  it('puts the newest session first', () => {
    render(<TodayWorkoutCard workouts={[EMPTY, FULL]} unit="metric" />)
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', `/workouts?session=${SESSION.id}`)
  })

  it('says no sets logged on an empty session', () => {
    render(<TodayWorkoutCard workouts={[EMPTY]} unit="metric" />)
    expect(screen.getByRole('link')).toHaveTextContent('No sets logged')
  })

  it('shows a record badge with the count of new records', () => {
    const stats = {
      ...STATS,
      newRecords: [
        { exerciseId: BENCH, weightKg: 65, reps: 8 },
        { exerciseId: BENCH, weightKg: 60, reps: 10 },
      ],
    }
    render(<TodayWorkoutCard workouts={[{ session: SESSION, stats }]} unit="metric" />)
    expect(within(screen.getByRole('link')).getByText('2 records')).toBeInTheDocument()
  })

  it('names a single record in the singular', () => {
    const stats = { ...STATS, newRecords: [{ exerciseId: BENCH, weightKg: 65, reps: 8 }] }
    render(<TodayWorkoutCard workouts={[{ session: SESSION, stats }]} unit="metric" />)
    expect(screen.getByText('1 record')).toBeInTheDocument()
  })

  it('marks a session that is still running as in progress', () => {
    const live = { ...SESSION, status: 'active' as const, ended_at: null }
    render(<TodayWorkoutCard workouts={[{ session: live, stats: STATS }]} unit="metric" />)
    expect(screen.getByText('In progress')).toBeInTheDocument()
  })
})

describe('sessionDetail', () => {
  it('lists the exercises, the sets, the volume and the time', () => {
    expect(sessionDetail(STATS, 'metric')).toBe('1 exercise · 2 sets · 1,120 kg · 1h')
  })

  it('says no sets logged when the session has no set', () => {
    expect(sessionDetail(EMPTY.stats, 'metric')).toBe('No sets logged')
  })
})
