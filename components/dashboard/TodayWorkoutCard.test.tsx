import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { sessionStats } from '../../lib/metrics/sessionStats'
import { BENCH, liftSet, sessionOn } from '../../tests/fixtures/lifts'
import { startedText } from '../workout/SessionTimer'

import { TodayWorkoutCard } from './TodayWorkoutCard'

const SESSION = sessionOn('2026-09-23')
const STATS = sessionStats(
  SESSION,
  [liftSet(SESSION, BENCH, 10, 60), liftSet(SESSION, BENCH, 8, 65)],
  [],
)

describe('TodayWorkoutCard', () => {
  it('links each session to its detail', () => {
    render(<TodayWorkoutCard workouts={[{ session: SESSION, stats: STATS }]} unit="metric" />)
    const row = screen.getByRole('link')
    expect(row).toHaveAttribute('href', `/workouts?session=${SESSION.id}`)
    expect(row).toHaveTextContent(`${startedText(SESSION.started_at)}1h · 2 sets · 1,120 kg`)
  })

  it('gives each row a 44 px target', () => {
    render(<TodayWorkoutCard workouts={[{ session: SESSION, stats: STATS }]} unit="metric" />)
    expect(screen.getByRole('link')).toHaveClass('min-h-11')
  })

  it('has a heading for the card', () => {
    render(<TodayWorkoutCard workouts={[{ session: SESSION, stats: STATS }]} unit="metric" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Workout today' })).toBeInTheDocument()
  })
})
