import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { formatDuration } from '../../lib/duration'
import { BENCH, EXERCISES, LAT, liftSet, sessionOn } from '../../tests/fixtures/lifts'

import { rowTitle } from './historyText'
import { SessionDetail } from './SessionDetail'

import type { FoundSession } from './useWorkoutHistory'
import type { SessionStats } from '../../lib/metrics/sessionStats'

const SESSION = sessionOn('2026-09-08')
const UNKNOWN = '00000000-0000-4000-8000-0000000000ff'

const SETS = [
  liftSet(SESSION, BENCH, 10, 60),
  liftSet(SESSION, LAT, 15, null),
  liftSet(SESSION, BENCH, 3, 102.5),
  liftSet(SESSION, UNKNOWN, 12, 40),
]

const STATS: SessionStats = {
  durationSeconds: 4325,
  setCount: 18,
  exerciseCount: 4,
  volumeKg: 3420,
  newRecords: [{ exerciseId: BENCH, weightKg: 102.5, reps: 3 }],
}

const VIEW: FoundSession = {
  status: 'found',
  session: SESSION,
  sets: SETS,
  stats: STATS,
  exercises: new Map(EXERCISES.map((exercise) => [exercise.id, exercise])),
  unit: 'metric',
}

function renderDetail(view: FoundSession = VIEW) {
  return render(<SessionDetail view={view} />)
}

function cells(container: HTMLElement): [string, string][] {
  const terms = [...container.querySelectorAll('dl dt')].map((cell) => cell.textContent)
  const values = [...container.querySelectorAll('dl dd')].map((cell) => cell.textContent)
  return terms.map((term, index) => [term, values[index] ?? ''])
}

describe('SessionDetail', () => {
  it('links back to all sessions', () => {
    renderDetail()
    const back = screen.getByRole('link', { name: 'All sessions' })
    expect(back).toHaveAttribute('href', '/workouts')
    expect(back).toHaveClass('min-h-11')
  })

  it('titles the detail with the date and the start time', () => {
    renderDetail()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(rowTitle(SESSION))
  })

  it('lists the duration, the sets, the exercises and the volume in kilograms', () => {
    const { container } = renderDetail()
    expect(cells(container)).toEqual([
      ['duration', formatDuration(STATS.durationSeconds, 'short')],
      ['sets', '18'],
      ['exercises', '4'],
      ['volume (kg)', '3,420'],
    ])
  })

  it('lists the volume in pounds for imperial', () => {
    const { container } = renderDetail({ ...VIEW, unit: 'imperial' })
    expect(cells(container)[3]).toEqual(['volume (lb)', '7,540'])
  })

  it('names each new record with its load and reps', () => {
    renderDetail()
    expect(screen.getByText('New records')).toBeInTheDocument()
    expect(screen.getByText('102.5 kg × 3').closest('li')).toHaveTextContent('Bench press')
  })

  it('shows no records card when the session set no record', () => {
    renderDetail({ ...VIEW, stats: { ...STATS, newRecords: [] } })
    expect(screen.queryByText('New records')).toBeNull()
  })

  it('shows one region per exercise in the order first done', () => {
    renderDetail()
    expect(
      screen.getAllByRole('region').map((region) => region.getAttribute('aria-label')),
    ).toEqual(['Bench press', 'Lat pulldown', 'Unknown exercise'])
  })

  it('heads each exercise region with its name', () => {
    renderDetail()
    expect(
      within(screen.getByRole('region', { name: 'Bench press' })).getByRole('heading', {
        level: 3,
      }),
    ).toHaveTextContent('Bench press')
  })

  it('names an exercise missing from the catalogue Unknown exercise', () => {
    renderDetail()
    expect(screen.getByRole('region', { name: 'Unknown exercise' })).toHaveTextContent(
      'Set 112 × 40 kg',
    )
  })

  it('numbers the sets of an exercise and writes the reps and the load', () => {
    renderDetail()
    const rows = within(screen.getByRole('region', { name: 'Bench press' })).getAllByRole(
      'listitem',
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent(/^Set 1\s*10 × 60 kg$/)
    expect(rows[1]).toHaveTextContent(/^Set 2\s*3 × 102\.5 kg$/)
  })

  it('sets every set row at least 44 px tall', () => {
    renderDetail()
    for (const region of screen.getAllByRole('region')) {
      for (const row of within(region).getAllByRole('listitem')) {
        expect(row).toHaveClass('min-h-11')
      }
    }
  })

  it('writes the reps alone for a body-weight set', () => {
    renderDetail()
    expect(screen.getByRole('region', { name: 'Lat pulldown' })).toHaveTextContent('Set 115 reps')
  })

  it('writes the loads in pounds for imperial', () => {
    renderDetail({ ...VIEW, unit: 'imperial' })
    expect(screen.getByRole('region', { name: 'Bench press' })).toHaveTextContent(/ lb/)
    expect(screen.getByRole('region', { name: 'Bench press' })).not.toHaveTextContent(/ kg/)
  })
})
