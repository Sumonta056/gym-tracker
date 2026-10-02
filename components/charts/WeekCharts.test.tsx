import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { entryOn } from '../../tests/fixtures/dashboard'
import { BENCH, exercise, LEG, liftSet, sessionOn } from '../../tests/fixtures/lifts'

import { analyse } from './rangeData'
import { rowDates, weekBalance, WeekCharts } from './WeekCharts'

import type { LiftSource } from './useLiftData'

vi.mock('recharts', async (importOriginal) => {
  const { withFixedContainer } = await import('../../tests/fixtures/recharts')
  return withFixedContainer(await importOriginal<object>())
})

const TODAY = '2026-09-13'

const NOW = new Date(2026, 8, 13, 18, 0, 0)

const EXERCISES = [
  { ...exercise(BENCH, 'Bench press') },
  { ...exercise(LEG, 'Leg press'), muscle_group: 'legs' as const },
]

const NOTHING: LiftSource = { sessions: [], sets: [], exercises: EXERCISES }

const SEPTEMBER = [
  entryOn('2026-09-02', { gym_seconds: 3600, calories_burnt: 804 }),
  entryOn('2026-09-03', { gym_seconds: 3600, calories_burnt: 726 }),
  entryOn('2026-09-06', { gym_seconds: 3600, calories_burnt: 834 }),
  entryOn('2026-09-09', { gym_seconds: null, calories_burnt: 629 }),
  entryOn('2026-09-12', { gym_seconds: 3600, calories_burnt: 798 }),
  entryOn('2026-09-13', { gym_seconds: 3600, calories_burnt: 852 }),
]

function monthDays(entries = SEPTEMBER) {
  return analyse(entries, entries, 'month', TODAY, NOW, 10000).days
}

function card(name: string): HTMLElement {
  const heading = screen.getByRole('heading', { level: 2, name })
  const found = heading.closest('div.rounded-card')
  expect(found).not.toBeNull()
  return found as HTMLElement
}

describe('WeekCharts', () => {
  it('shows the empty state of every card before any session exists', () => {
    render(<WeekCharts source={NOTHING} days={monthDays([])} today={TODAY} />)
    const grid = screen.getByTestId('week-grid')
    expect(within(grid).getAllByRole('heading', { level: 2 })).toHaveLength(3)
    expect(within(grid).queryByRole('img')).not.toBeInTheDocument()
  })

  it('lays the cards out in one column, and two from the md breakpoint', () => {
    render(<WeekCharts source={NOTHING} days={[]} today={TODAY} />)
    expect(screen.getByTestId('week-grid')).toHaveClass('grid-cols-1', 'md:grid-cols-2')
  })

  it('renders with one session: the balance bar, no gap and no lone dot', () => {
    const session = sessionOn(TODAY)
    const entries = [entryOn(TODAY, { gym_seconds: 3600, calories_burnt: 852 })]
    render(
      <WeekCharts
        source={{
          sessions: [session],
          sets: [liftSet(session, BENCH, 8, 45)],
          exercises: EXERCISES,
        }}
        days={monthDays(entries)}
        today={TODAY}
      />,
    )
    const grid = screen.getByTestId('week-grid')
    expect(within(grid).getAllByRole('img')).toHaveLength(1)
    expect(within(card('Days between sessions')).getByText(/Log one more day/)).toBeVisible()
    expect(within(card('Calories a gym minute')).getByText(/Log one more session/)).toBeVisible()
  })

  it('counts every daily row date, gym time or not, for the gaps 1, 3, 3, 3, 1', () => {
    render(<WeekCharts source={NOTHING} days={monthDays()} today={TODAY} />)
    const gaps = card('Days between sessions')
    expect(within(gaps).getByText('Gaps 1, 3, 3, 3, 1 from 2 to 13 September.')).toBeVisible()
    expect(within(gaps).getByText('avg 2.2 days')).toBeVisible()
  })

  it('leaves the row with no gym time out of the calorie rate line', () => {
    render(<WeekCharts source={NOTHING} days={monthDays()} today={TODAY} />)
    expect(
      within(card('Calories a gym minute')).getByRole('img', {
        name: 'Calories per gym minute per session, rising: 13.4, 12.1, 13.9, 13.3, 14.2. Average 13.4.',
      }),
    ).toBeInTheDocument()
  })

  it('warns about legs when legs fall under 15 percent of this week', () => {
    const monday = sessionOn('2026-09-07')
    const sunday = sessionOn(TODAY)
    render(
      <WeekCharts
        source={{
          sessions: [monday, sunday],
          sets: [liftSet(monday, BENCH, 10, 100), liftSet(sunday, LEG, 10, 10)],
          exercises: EXERCISES,
        }}
        days={monthDays()}
        today={TODAY}
      />,
    )
    expect(within(card('Muscle group balance')).getByRole('note')).toHaveTextContent(
      "Legs behind: 9% of this week's volume, under 15%.",
    )
  })
})

describe('weekBalance', () => {
  it('reads only the sets of the sessions in the week of today', () => {
    const before = sessionOn('2026-09-06')
    const inWeek = sessionOn('2026-09-07')
    const balance = weekBalance(
      {
        sessions: [before, inWeek],
        sets: [liftSet(before, LEG, 10, 100), liftSet(inWeek, BENCH, 10, 50)],
        exercises: EXERCISES,
      },
      TODAY,
    )
    expect(balance.shares).toEqual([{ group: 'chest', volume: 500, share: 100 }])
  })

  it('returns an empty balance for a week with no session', () => {
    expect(weekBalance(NOTHING, TODAY)).toEqual({ shares: [], below: [] })
  })
})

describe('rowDates', () => {
  it('keeps every logged row, with or without gym time, and no blank day', () => {
    expect(rowDates(monthDays())).toEqual([
      '2026-09-02',
      '2026-09-03',
      '2026-09-06',
      '2026-09-09',
      '2026-09-12',
      '2026-09-13',
    ])
  })
})
