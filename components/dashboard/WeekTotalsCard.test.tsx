import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { dayState, goalLine, goalNote, WeekTotalsCard } from './WeekTotalsCard'

const RANGE = { from: '2026-10-12', to: '2026-10-18' }
const TOTALS = { sessions: 1, gymSeconds: 3600, walkSeconds: 1800, calories: 800, steps: 12000 }

function day(date: string): HTMLElement {
  return screen.getAllByRole('listitem').find((item) => item.dataset.date === date) as HTMLElement
}

describe('WeekTotalsCard', () => {
  it('has a heading for the card', () => {
    render(<WeekTotalsCard totals={TOTALS} range={RANGE} />)
    expect(screen.getByRole('heading', { level: 2, name: 'This week' })).toBeInTheDocument()
  })

  it('shows the dates of the week beside the label', () => {
    render(<WeekTotalsCard totals={TOTALS} range={RANGE} />)
    expect(screen.getByText('12 – 18 Oct')).toBeVisible()
  })

  it('shows the four totals with their names', () => {
    render(<WeekTotalsCard totals={TOTALS} range={RANGE} />)
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Gym time',
      'Calories',
      'Steps',
      'Walk',
    ])
    expect(screen.getAllByRole('definition').map((value) => value.textContent)).toEqual([
      '1h',
      '800kcal',
      '12,000',
      '30m',
    ])
  })

  it('shows the sessions against the goal with a ring', () => {
    render(<WeekTotalsCard totals={TOTALS} range={RANGE} today="2026-10-16" sessionsGoal={4} />)
    expect(screen.getByText('1 of 4 sessions')).toBeInTheDocument()
    expect(screen.getByText('3 more to reach your goal. 2 days left.')).toBeInTheDocument()
    expect(screen.getByTestId('goal-progress')).toHaveAttribute('stroke-dasharray', '25 75')
  })

  it('shows the count in words and no ring with no goal', () => {
    render(<WeekTotalsCard totals={TOTALS} range={RANGE} sessionsGoal={null} />)
    expect(screen.getByText('1 session this week')).toBeInTheDocument()
    expect(screen.queryByTestId('goal-progress')).toBeNull()
  })

  it('draws an empty ring with no session yet', () => {
    render(<WeekTotalsCard totals={{ ...TOTALS, sessions: 0 }} range={RANGE} sessionsGoal={4} />)
    expect(screen.getByText('0 of 4 sessions')).toBeInTheDocument()
    expect(screen.queryByTestId('goal-progress')).toBeNull()
  })

  it('lists the 7 days of the week from Monday', () => {
    render(<WeekTotalsCard totals={TOTALS} range={RANGE} />)
    const list = screen.getByRole('list', { name: 'Gym days this week' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(7)
    expect(day('2026-10-12')).toHaveTextContent(/^M/)
  })

  it('marks a gym day, today and the days to come in words', () => {
    render(
      <WeekTotalsCard totals={TOTALS} range={RANGE} gymDates={['2026-10-16']} today="2026-10-16" />,
    )
    expect(day('2026-10-16')).toHaveTextContent('Friday 16 October, gym day, today')
    expect(day('2026-10-15')).toHaveTextContent('Thursday 15 October, no gym')
    expect(day('2026-10-17')).toHaveTextContent('Saturday 17 October, to come')
  })

  it('marks a chosen past day and still counts the days left from today', () => {
    render(
      <WeekTotalsCard
        totals={TOTALS}
        range={RANGE}
        today="2026-10-16"
        marked="2026-10-14"
        sessionsGoal={4}
      />,
    )
    expect(day('2026-10-14')).toHaveTextContent('Wednesday 14 October, no gym, shown')
    expect(day('2026-10-14').querySelector('[aria-hidden="true"]')).toHaveClass('outline-accent')
    expect(day('2026-10-16')).toHaveTextContent('Friday 16 October, no gym, today')
    expect(day('2026-10-16').querySelector('[aria-hidden="true"]')).not.toHaveClass(
      'outline-accent',
    )
    expect(screen.getByText('3 more to reach your goal. 2 days left.')).toBeVisible()
  })

  it('draws a dumbbell on a gym day only', () => {
    render(<WeekTotalsCard totals={TOTALS} range={RANGE} gymDates={['2026-10-14']} />)
    expect(day('2026-10-14').querySelector('svg[data-icon="dumbbell"]')).not.toBeNull()
    expect(day('2026-10-13').querySelector('svg[data-icon="dumbbell"]')).toBeNull()
  })
})

describe('goalLine', () => {
  it('names the sessions against the goal', () => {
    expect(goalLine(3, 4)).toBe('3 of 4 sessions')
  })

  it('names a single session with no goal', () => {
    expect(goalLine(1, null)).toBe('1 session this week')
  })
})

describe('goalNote', () => {
  it('returns null with no goal', () => {
    expect(goalNote(1, null, 2)).toBeNull()
  })

  it('says the goal is reached', () => {
    expect(goalNote(5, 4, 2)).toBe('Goal reached.')
  })

  it('leaves out the days when today is not known', () => {
    expect(goalNote(1, 4, null)).toBe('3 more to reach your goal.')
  })

  it('names 1 day left in the singular', () => {
    expect(goalNote(1, 4, 1)).toBe('3 more to reach your goal. 1 day left.')
  })

  it('says when today is the last day', () => {
    expect(goalNote(1, 4, 0)).toBe('3 more to reach your goal. This is the last day.')
  })
})

describe('dayState', () => {
  it('names a past day with no gym', () => {
    expect(dayState('2026-10-12', false, '2026-10-16')).toBe('Monday 12 October, no gym')
  })

  it('names a day with no today given as a past day', () => {
    expect(dayState('2026-10-18', true, undefined)).toBe('Sunday 18 October, gym day')
  })
})
