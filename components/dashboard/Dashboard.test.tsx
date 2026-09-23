import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getProfile, listRange } from '../../lib/db/repository'
import { formatDuration } from '../../lib/duration'
import { streak } from '../../lib/metrics/streak'
import { entryOn, NOW, PROFILE, TODAY } from '../../tests/fixtures/dashboard'

import { Dashboard, DashboardView, stepsHint } from './Dashboard'
import { summarise } from './summary'

vi.mock('../../lib/db/repository', async () => {
  const { syncedStatus } = await import('../../tests/fixtures/sync')
  return {
    getProfile: vi.fn(),
    listRange: vi.fn(),
    useSyncStatus: syncedStatus,
  }
})

const clock = () => NOW

const STREAK_DATES = ['2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22', TODAY]

beforeEach(() => {
  vi.mocked(listRange).mockResolvedValue([])
  vi.mocked(getProfile).mockResolvedValue(PROFILE)
})

describe('Dashboard', () => {
  it('says it is reading the device while the entries load', () => {
    render(<Dashboard clock={clock} />)
    expect(screen.getByRole('status')).toHaveTextContent('Reading this device')
  })

  it('shows the empty state linking to /log when today has no entry', async () => {
    vi.mocked(listRange).mockResolvedValue([entryOn('2026-09-22')])
    render(<Dashboard clock={clock} />)
    expect(await screen.findByText('Nothing logged yet today.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Log the day' })).toHaveAttribute('href', '/log')
  })

  it('shows the streak number from lib/metrics/streak', async () => {
    vi.mocked(listRange).mockResolvedValue(STREAK_DATES.map((date) => entryOn(date)))
    const expected = streak(STREAK_DATES, NOW).current
    render(<Dashboard clock={clock} />)
    expect(await screen.findByText(`${String(expected)} day streak`)).toBeInTheDocument()
    expect(expected).toBe(5)
  })

  it('shows the gym time for today through formatDuration', async () => {
    vi.mocked(listRange).mockResolvedValue([entryOn(TODAY, { gym_seconds: 4325 })])
    render(<Dashboard clock={clock} />)
    expect(await screen.findByText(formatDuration(4325, 'clock'))).toBeInTheDocument()
  })

  it('reports a read failure in words', async () => {
    vi.mocked(getProfile).mockRejectedValue(new Error('blocked'))
    render(<Dashboard clock={clock} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be read')
  })
})

describe('DashboardView', () => {
  function view(entries = [entryOn(TODAY)], profile = PROFILE) {
    render(<DashboardView summary={summarise(entries, profile, TODAY, NOW)} />)
  }

  it('lays the cards out in one, two, then three columns', () => {
    view()
    const grid = screen.getByTestId('dashboard-grid')
    expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3')
  })

  it('shows the steps against the goal from the profile', () => {
    view([entryOn('2026-09-22', { steps: 1000 }), entryOn(TODAY, { steps: 5909 })])
    expect(screen.getByText('5,909')).toBeInTheDocument()
    expect(screen.getByText('49% of 12,000')).toBeInTheDocument()
  })

  it('shows the latest weight in kilograms', () => {
    view([entryOn(TODAY, { weight_kg: 73.65 })])
    expect(screen.getByText('73.65')).toBeInTheDocument()
    expect(screen.getByText('kg')).toBeInTheDocument()
  })

  it('shows the latest weight in pounds when the profile is imperial', () => {
    view([entryOn(TODAY, { weight_kg: 71 })], { ...PROFILE, unit_system: 'imperial' })
    expect(screen.getByText('156.5')).toBeInTheDocument()
    expect(screen.getByText('lb')).toBeInTheDocument()
  })

  it('reads the weight trend out in pounds when the profile is imperial', () => {
    view([entryOn('2026-09-22', { weight_kg: 71 }), entryOn(TODAY, { weight_kg: 70 })], {
      ...PROFILE,
      unit_system: 'imperial',
    })
    expect(screen.getByText('Weight series: 156.5, 154.3')).toBeInTheDocument()
  })

  it('draws the weight trend once two weights exist', () => {
    view([entryOn('2026-09-22', { weight_kg: 74 }), entryOn(TODAY, { weight_kg: 73.65 })])
    expect(screen.getByText('Weight series: 74, 73.65')).toBeInTheDocument()
  })

  it('shows a dash for steps and weight that were never logged', () => {
    view([])
    expect(screen.getAllByText('—')).toHaveLength(2)
    expect(screen.getByText('Not logged yet')).toBeInTheDocument()
    expect(screen.getByText('Goal 12,000')).toBeInTheDocument()
  })

  it('shows the heart rate zones and the week totals', () => {
    view()
    expect(screen.getByRole('heading', { name: 'Heart rate zones' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'This week' })).toBeInTheDocument()
  })
})

describe('stepsHint', () => {
  it('rounds the share of the goal', () => {
    expect(stepsHint(12480, 12000)).toBe('104% of 12,000')
  })

  it('names the goal when no steps are logged', () => {
    expect(stepsHint(null, 12000)).toBe('Goal 12,000')
  })
})
