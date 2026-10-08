import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { listRange, listSetsInRange } from '../../lib/db/repository'
import { entryOn, NOW, TODAY } from '../../tests/fixtures/dashboard'
import { setReducedMotion } from '../../tests/fixtures/motion'

import { Analytics, AnalyticsHeader, AnalyticsView } from './Analytics'
import { analyse } from './rangeData'
import { DRAW_CLASS } from './useLineDraw'

vi.mock('recharts', async (importOriginal) => {
  const { withFixedContainer } = await import('../../tests/fixtures/recharts')
  return withFixedContainer(await importOriginal<object>())
})

vi.mock('../../lib/db/repository', async () => {
  const { PROFILE } = await import('../../tests/fixtures/dashboard')
  const { syncedStatus } = await import('../../tests/fixtures/sync')
  return {
    listRange: vi.fn(),
    listSessions: vi.fn(() => Promise.resolve([])),
    listSetsInRange: vi.fn(() => Promise.resolve([])),
    listExercises: vi.fn(() => Promise.resolve([])),
    getProfile: vi.fn(() => Promise.resolve({ ...PROFILE, step_goal: 10000 })),
    useSyncStatus: syncedStatus,
  }
})

const clock = () => NOW

beforeEach(() => {
  vi.mocked(listRange).mockReset()
  vi.mocked(listRange).mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const WEEK_ENTRIES = ['2026-09-21', '2026-09-22', TODAY].map((date) => entryOn(date))

describe('Analytics', () => {
  it('opens on the week tab and reads the history once', async () => {
    render(<Analytics clock={clock} />)
    expect(await screen.findByText('21 – 27 September')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
    expect(vi.mocked(listRange).mock.calls).toEqual([['0000-01-01', '9999-12-31']])
  })

  it('changes the range label on the click, with no new read', async () => {
    const user = userEvent.setup()
    render(<Analytics clock={clock} />)
    await screen.findByText('21 – 27 September')

    await user.click(screen.getByRole('button', { name: 'Month' }))
    expect(screen.getByText('1 – 30 September')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Day' }))
    expect(screen.getByText('23 September', { selector: 'p' })).toBeVisible()

    expect(listRange).toHaveBeenCalledTimes(1)
  })

  it('keeps every card in the document during a tab switch', async () => {
    vi.mocked(listRange).mockResolvedValue(WEEK_ENTRIES)
    render(<Analytics clock={clock} />)
    await screen.findByTestId('lift-grid')
    const grid = screen.getByTestId('analytics-grid')

    fireEvent.click(screen.getByRole('button', { name: 'Month' }))

    expect(screen.getByTestId('analytics-grid')).toBe(grid)
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(14)
    expect(screen.queryByText('Reading this device…')).not.toBeInTheDocument()
  })

  it('does not replay the line draw on a chart that comes back after a tab switch', async () => {
    vi.useFakeTimers()
    setReducedMotion(false)
    vi.mocked(listRange).mockResolvedValue(WEEK_ENTRIES)
    render(<Analytics clock={clock} />)
    await act(async () => {
      await vi.runAllTimersAsync()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Day' }))
    fireEvent.click(screen.getByRole('button', { name: 'Week' }))

    expect(document.querySelectorAll(`.${DRAW_CLASS}`)).toHaveLength(0)
  })

  it('shows the loading state before the read settles', () => {
    vi.mocked(listRange).mockReturnValue(new Promise(() => undefined))
    render(<Analytics clock={clock} />)
    expect(screen.getByText('Reading this device…')).toHaveAttribute('role', 'status')
  })

  it('shows the error when the read fails', async () => {
    vi.mocked(listRange).mockRejectedValue(new Error('locked'))
    render(<Analytics clock={clock} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The entries on this device could not be read.',
    )
  })

  it('shows every chart in its empty state when nothing is logged', async () => {
    render(<Analytics clock={clock} />)
    await screen.findByTestId('lift-grid')
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(14)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows the lifting charts after the daily charts', async () => {
    render(<Analytics clock={clock} />)
    const lifts = await screen.findByTestId('lift-grid')
    expect(within(lifts).getByRole('heading', { name: 'Volume load per session' })).toBeVisible()
    expect(within(lifts).getByRole('heading', { name: 'Estimated one-rep max' })).toBeVisible()
    expect(within(lifts).getByRole('heading', { name: 'Personal records' })).toBeVisible()
  })

  it('says it is reading the workouts while that read is open', async () => {
    vi.mocked(listSetsInRange).mockReturnValueOnce(new Promise(() => undefined))
    render(<Analytics clock={clock} />)
    expect(await screen.findByText('Reading the workouts…')).toHaveAttribute('role', 'status')
  })

  it('shows the error when the workouts cannot be read, and keeps the daily charts', async () => {
    vi.mocked(listSetsInRange).mockRejectedValueOnce(new Error('locked'))
    render(<Analytics clock={clock} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The workouts on this device could not be read.',
    )
    expect(await screen.findByTestId('analytics-grid')).toBeVisible()
    expect(screen.queryByTestId('lift-grid')).not.toBeInTheDocument()
  })
})

describe('AnalyticsView', () => {
  it('renders eight charts, each an image with a label', () => {
    const entries = [entryOn('2026-09-21'), entryOn(TODAY)]
    render(<AnalyticsView data={analyse(entries, entries, 'week', TODAY, NOW, 12000)} />)
    const grid = screen.getByTestId('analytics-grid')
    const images = within(grid).getAllByRole('img')
    expect(images).toHaveLength(8)
    for (const image of images) {
      expect(image).toHaveAccessibleName()
    }
  })

  it('shows the walk chart after the steps chart', () => {
    render(<AnalyticsView data={analyse([], [], 'week', TODAY, NOW, 12000)} />)
    const headings = within(screen.getByTestId('analytics-grid'))
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent)
    expect(headings).toContain('Steps')
    expect(headings[headings.indexOf('Steps') + 1]).toBe('Walk')
  })

  it('lays the charts out in one column, and two from the md breakpoint', () => {
    render(<AnalyticsView data={analyse([], [], 'week', TODAY, NOW, 12000)} />)
    expect(screen.getByTestId('analytics-grid')).toHaveClass('grid-cols-1', 'md:grid-cols-2')
  })

  it('sets no fixed pixel width on any chart container', () => {
    const entries = [entryOn('2026-09-21'), entryOn(TODAY)]
    const { container } = render(
      <AnalyticsView data={analyse(entries, entries, 'week', TODAY, NOW, 12000)} />,
    )
    for (const image of container.querySelectorAll('[role="img"]')) {
      expect(image).toHaveClass('w-full')
    }
  })
})

describe('AnalyticsHeader', () => {
  it('names the screen Stats', () => {
    render(<AnalyticsHeader label={null} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Stats' })).toBeInTheDocument()
  })
})
