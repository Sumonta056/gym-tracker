import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatDuration } from '../../lib/duration'
import { entryOn, TODAY } from '../../tests/fixtures/dashboard'
import { setReducedMotion } from '../../tests/fixtures/motion'

import { heroWords, streakLabel, TodayHero } from './TodayHero'

afterEach(() => {
  vi.unstubAllGlobals()
})

const TYPED = { seconds: 4325, source: 'typed' } as const
const NONE = { seconds: 0, source: 'none' } as const

describe('TodayHero', () => {
  it('puts the final gym time in the document at once with reduced motion', () => {
    setReducedMotion(true)
    render(
      <TodayHero
        entry={entryOn(TODAY, { gym_seconds: 4325 })}
        gym={TYPED}
        streak={1}
        date={TODAY}
        today={TODAY}
      />,
    )
    expect(screen.getByText(formatDuration(4325, 'clock'))).not.toHaveClass('opacity-0')
    expect(screen.queryByTestId('count-up-display')).not.toBeInTheDocument()
  })

  it('keeps the final gym time readable while the count-up runs', () => {
    setReducedMotion(false)
    render(
      <TodayHero
        entry={entryOn(TODAY, { gym_seconds: 4325 })}
        gym={TYPED}
        streak={1}
        date={TODAY}
        today={TODAY}
      />,
    )
    expect(screen.getByText(formatDuration(4325, 'clock'))).toBeInTheDocument()
    expect(screen.getByTestId('count-up-display')).toHaveAttribute('aria-hidden', 'true')
  })

  it('invites the user to log the day when today has no entry', () => {
    render(<TodayHero entry={undefined} gym={NONE} streak={0} date={TODAY} today={TODAY} />)
    expect(screen.getByText('Nothing logged yet today.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Log the day' })).toHaveAttribute('href', '/log')
  })

  it('gives the log link a 44 px target', () => {
    render(<TodayHero entry={undefined} gym={NONE} streak={0} date={TODAY} today={TODAY} />)
    expect(screen.getByRole('link', { name: 'Log the day' })).toHaveClass('min-h-11')
  })

  it('shows the streak in the pill', () => {
    render(<TodayHero entry={entryOn(TODAY)} gym={TYPED} streak={4} date={TODAY} today={TODAY} />)
    expect(screen.getByText('4 day streak')).toBeInTheDocument()
  })

  it('renders the gym time through formatDuration', () => {
    render(
      <TodayHero
        entry={entryOn(TODAY, { gym_seconds: 4325 })}
        gym={TYPED}
        streak={1}
        date={TODAY}
        today={TODAY}
      />,
    )
    expect(screen.getByText(formatDuration(4325, 'clock'))).toBeInTheDocument()
  })

  it('shows the average and the peak heart rate', () => {
    render(<TodayHero entry={entryOn(TODAY)} gym={TYPED} streak={1} date={TODAY} today={TODAY} />)
    expect(screen.getByText('Avg HR')).toBeVisible()
    expect(screen.getByText('117')).toBeInTheDocument()
    expect(screen.getByText('Peak')).toBeVisible()
    expect(screen.getByText('174')).toBeInTheDocument()
  })

  it('no longer carries the calories or the walk time', () => {
    render(<TodayHero entry={entryOn(TODAY)} gym={TYPED} streak={1} date={TODAY} today={TODAY} />)
    expect(screen.queryByText('Kcal')).toBeNull()
    expect(screen.queryByText('Walk')).toBeNull()
    expect(screen.queryByText('963')).toBeNull()
  })

  it('says the gym time comes from the sessions', () => {
    render(
      <TodayHero
        entry={entryOn(TODAY, { gym_seconds: null })}
        gym={{ seconds: 3600, source: 'sessions' }}
        streak={1}
        date={TODAY}
        today={TODAY}
      />,
    )
    expect(screen.getByText(formatDuration(3600, 'clock'))).toBeInTheDocument()
    expect(screen.getByText('From your sessions')).toBeVisible()
  })

  it('gives no hint for a typed gym time', () => {
    render(
      <TodayHero
        entry={entryOn(TODAY)}
        gym={{ seconds: 4325, source: 'typed' }}
        streak={1}
        date={TODAY}
        today={TODAY}
      />,
    )
    expect(screen.queryByText('From your sessions')).toBeNull()
  })

  it('names a day with an entry and no gym time', () => {
    render(
      <TodayHero
        entry={entryOn(TODAY, { gym_seconds: null })}
        gym={{ seconds: 0, source: 'none' }}
        streak={1}
        date={TODAY}
        today={TODAY}
      />,
    )
    expect(screen.getByText('No gym time today')).toBeVisible()
  })

  it('shows the gym time of a day with only a session', () => {
    render(
      <TodayHero
        entry={undefined}
        gym={{ seconds: 3600, source: 'sessions' }}
        streak={0}
        date={TODAY}
        today={TODAY}
      />,
    )
    expect(screen.queryByText('Nothing logged yet today.')).toBeNull()
    expect(screen.getByText(formatDuration(3600, 'clock'))).toBeInTheDocument()
  })

  it('hides a heart rate value that is not logged', () => {
    render(
      <TodayHero
        entry={entryOn(TODAY, { avg_heart_rate: null })}
        gym={{ seconds: 4325, source: 'typed' }}
        streak={1}
        date={TODAY}
        today={TODAY}
      />,
    )
    expect(screen.queryByText('Avg HR')).toBeNull()
    expect(screen.getByText('Peak')).toBeVisible()
  })

  it('hides the peak when the max heart rate is not logged', () => {
    render(
      <TodayHero
        entry={entryOn(TODAY, { max_heart_rate: null })}
        gym={TYPED}
        streak={1}
        date={TODAY}
        today={TODAY}
      />,
    )
    expect(screen.queryByText('Peak')).toBeNull()
    expect(screen.getByText('Avg HR')).toBeVisible()
  })

  it('drops the heart rate row when neither value is logged', () => {
    render(
      <TodayHero
        entry={entryOn(TODAY, { avg_heart_rate: null, max_heart_rate: null })}
        gym={TYPED}
        streak={1}
        date={TODAY}
        today={TODAY}
      />,
    )
    expect(screen.queryByText('Avg HR')).toBeNull()
    expect(screen.queryByText('Peak')).toBeNull()
    expect(screen.queryByText('—')).toBeNull()
    expect(screen.queryByText('not logged')).toBeNull()
  })

  it('names the card for assistive technology', () => {
    render(<TodayHero entry={undefined} gym={NONE} streak={0} date={TODAY} today={TODAY} />)
    expect(screen.getByRole('region', { name: 'Today' })).toBeInTheDocument()
  })
})

describe('streakLabel', () => {
  it('reads as a number of days', () => {
    expect(streakLabel(14)).toBe('14 day streak')
  })
})

describe('TodayHero on a past day', () => {
  const PAST = '2026-09-10'

  it('names the day in the label and the region', () => {
    render(<TodayHero entry={entryOn(PAST)} gym={TYPED} streak={2} date={PAST} today={TODAY} />)
    expect(screen.getByText('Gym time · 10 Sep')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '10 September' })).toBeInTheDocument()
  })

  it('invites the user to log that day when it has no entry', () => {
    render(<TodayHero entry={undefined} gym={NONE} streak={0} date={PAST} today={TODAY} />)
    expect(screen.getByText('Nothing logged on 10 Sep.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Log this day' })).toHaveAttribute(
      'href',
      `/log?date=${PAST}`,
    )
  })

  it('says the day had no gym time', () => {
    render(
      <TodayHero
        entry={entryOn(PAST, { gym_seconds: null })}
        gym={NONE}
        streak={1}
        date={PAST}
        today={TODAY}
      />,
    )
    expect(screen.getByText('No gym time on 10 Sep')).toBeInTheDocument()
  })

  it('keeps a given name for the region', () => {
    render(
      <TodayHero entry={undefined} gym={NONE} streak={0} date={PAST} today={TODAY} name="Sample" />,
    )
    expect(screen.getByRole('region', { name: 'Sample' })).toBeInTheDocument()
  })
})

describe('heroWords', () => {
  it('speaks of today on today', () => {
    expect(heroWords(TODAY, TODAY)).toEqual({
      label: 'Gym time today',
      empty: 'Nothing logged yet today.',
      logLink: 'Log the day',
      noGym: 'No gym time today',
    })
  })

  it('names any other day', () => {
    expect(heroWords('2026-09-10', TODAY)).toEqual({
      label: 'Gym time · 10 Sep',
      empty: 'Nothing logged on 10 Sep.',
      logLink: 'Log this day',
      noGym: 'No gym time on 10 Sep',
    })
  })
})
