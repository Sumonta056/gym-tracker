import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatDuration } from '../../lib/duration'
import { entryOn, TODAY } from '../../tests/fixtures/dashboard'
import { setReducedMotion } from '../../tests/fixtures/motion'

import { streakLabel, TodayHero } from './TodayHero'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TodayHero', () => {
  it('puts the final gym time in the document at once with reduced motion', () => {
    setReducedMotion(true)
    render(<TodayHero entry={entryOn(TODAY, { gym_seconds: 4325 })} streak={1} />)
    expect(screen.getByText(formatDuration(4325, 'clock'))).not.toHaveClass('opacity-0')
    expect(screen.queryByTestId('count-up-display')).not.toBeInTheDocument()
  })

  it('keeps the final gym time readable while the count-up runs', () => {
    setReducedMotion(false)
    render(<TodayHero entry={entryOn(TODAY, { gym_seconds: 4325 })} streak={1} />)
    expect(screen.getByText(formatDuration(4325, 'clock'))).toBeInTheDocument()
    expect(screen.getByTestId('count-up-display')).toHaveAttribute('aria-hidden', 'true')
  })

  it('invites the user to log the day when today has no entry', () => {
    render(<TodayHero entry={undefined} streak={0} />)
    expect(screen.getByText('Nothing logged yet today.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Log the day' })).toHaveAttribute('href', '/log')
  })

  it('gives the log link a 44 px target', () => {
    render(<TodayHero entry={undefined} streak={0} />)
    expect(screen.getByRole('link', { name: 'Log the day' })).toHaveClass('min-h-11')
  })

  it('shows the streak in the pill', () => {
    render(<TodayHero entry={entryOn(TODAY)} streak={4} />)
    expect(screen.getByText('4 day streak')).toBeInTheDocument()
  })

  it('renders the gym time through formatDuration', () => {
    render(<TodayHero entry={entryOn(TODAY, { gym_seconds: 4325 })} streak={1} />)
    expect(screen.getByText(formatDuration(4325, 'clock'))).toBeInTheDocument()
  })

  it('shows the four inline numbers', () => {
    render(<TodayHero entry={entryOn(TODAY)} streak={1} />)
    expect(screen.getByText('117')).toBeInTheDocument()
    expect(screen.getByText('174')).toBeInTheDocument()
    expect(screen.getByText('963')).toBeInTheDocument()
    expect(screen.getByText(formatDuration(3324, 'clock'))).toBeInTheDocument()
  })

  it('says a missing value is not logged', () => {
    const entry = entryOn(TODAY, {
      gym_seconds: null,
      avg_heart_rate: null,
      max_heart_rate: null,
      calories_burnt: null,
      walk_seconds: null,
    })
    render(<TodayHero entry={entry} streak={1} />)
    expect(screen.getAllByText('not logged')).toHaveLength(5)
  })

  it('names the card for assistive technology', () => {
    render(<TodayHero entry={undefined} streak={0} />)
    expect(screen.getByRole('region', { name: 'Today' })).toBeInTheDocument()
  })
})

describe('streakLabel', () => {
  it('reads as a number of days', () => {
    expect(streakLabel(14)).toBe('14 day streak')
  })
})
