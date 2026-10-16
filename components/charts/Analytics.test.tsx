import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getProfile, listRange, listSetsInRange } from '../../lib/db/repository'
import { entryOn, NOW, PROFILE, TODAY } from '../../tests/fixtures/dashboard'
import { setReducedMotion } from '../../tests/fixtures/motion'

import { Analytics, AnalyticsHeader, AnalyticsView } from './Analytics'
import { analyse } from './rangeData'
import { moveCard, resolveLayout } from './statsCards'
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
    updateProfile: vi.fn(() => Promise.resolve()),
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
    await screen.findByRole('heading', { level: 2, name: 'Personal records' })
    const grid = screen.getByTestId('stats-grid')

    fireEvent.click(screen.getByRole('button', { name: 'Month' }))

    expect(screen.getByTestId('stats-grid')).toBe(grid)
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
    await screen.findByRole('heading', { level: 2, name: 'Personal records' })
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(14)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows the lifting charts after the daily charts', async () => {
    render(<Analytics clock={clock} />)
    await screen.findByRole('heading', { level: 2, name: 'Personal records' })
    const names = within(screen.getByTestId('stats-grid'))
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent)
    expect(names.slice(8, 11)).toEqual([
      'Volume load per session',
      'Estimated one-rep max',
      'Personal records',
    ])
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
    expect(await screen.findByTestId('stats-grid')).toBeVisible()
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Personal records' }),
    ).not.toBeInTheDocument()
    expect(
      within(screen.getByTestId('stats-grid')).getAllByRole('heading', { level: 2 }),
    ).toHaveLength(8)
  })
})

function headings(): string[] {
  return within(screen.getByTestId('stats-grid'))
    .getAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent)
}

describe('Analytics layout', () => {
  it('renders the cards in the stored order', async () => {
    vi.mocked(getProfile).mockResolvedValueOnce({
      ...PROFILE,
      stats_layout: [
        { id: 'steps', hidden: false },
        { id: 'weight', hidden: false },
        ...resolveLayout(null).filter((item) => item.id !== 'steps' && item.id !== 'weight'),
      ],
    })
    render(<Analytics clock={clock} />)
    await screen.findByTestId('stats-grid')
    expect(headings().slice(0, 3)).toEqual(['Steps', 'Weight', 'Calories burnt'])
  })

  it('leaves a hidden card out of the grid', async () => {
    vi.mocked(getProfile).mockResolvedValueOnce({
      ...PROFILE,
      stats_layout: [{ id: 'weight', hidden: true }],
    })
    render(<Analytics clock={clock} />)
    await screen.findByTestId('stats-grid')
    expect(headings()).not.toContain('Weight')
  })

  it('saves the new order on Done and leaves edit mode', async () => {
    const user = userEvent.setup()
    const save = vi.fn(() => Promise.resolve())
    render(<Analytics clock={clock} save={save} />)
    await screen.findByTestId('stats-grid')
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Move Calories burnt up' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(save).toHaveBeenCalledWith({
      stats_layout: moveCard(resolveLayout(null), 'calories', -1),
    })
    expect(await screen.findByTestId('stats-grid')).toBeVisible()
    expect(headings().slice(0, 2)).toEqual(['Calories burnt', 'Weight'])
  })

  it('saves the default layout after Reset and Done', async () => {
    const user = userEvent.setup()
    const save = vi.fn(() => Promise.resolve())
    vi.mocked(getProfile).mockResolvedValueOnce({
      ...PROFILE,
      stats_layout: [{ id: 'steps', hidden: true }],
    })
    render(<Analytics clock={clock} save={save} />)
    await screen.findByTestId('stats-grid')
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(save).toHaveBeenCalledWith({ stats_layout: resolveLayout(null) })
  })

  it('stays in edit mode and says so when the save is refused', async () => {
    const user = userEvent.setup()
    const save = vi.fn(() => Promise.reject(new Error('locked')))
    render(<Analytics clock={clock} save={save} />)
    await screen.findByTestId('stats-grid')
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The layout could not be saved on this device.',
    )
    expect(screen.getByRole('list', { name: 'Stats cards' })).toBeInTheDocument()
  })
})

describe('Analytics layout focus', () => {
  it('moves the focus to the Stats cards heading on Edit', async () => {
    const user = userEvent.setup()
    render(<Analytics clock={clock} />)
    await screen.findByTestId('stats-grid')
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Stats cards' })).toHaveFocus()
  })

  it('gives the focus back to the Edit button after Done saves', async () => {
    const user = userEvent.setup()
    render(<Analytics clock={clock} save={() => Promise.resolve()} />)
    await screen.findByTestId('stats-grid')
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(await screen.findByRole('button', { name: 'Edit' })).toHaveFocus()
  })

  it('keeps the focus on Done when the save is refused', async () => {
    const user = userEvent.setup()
    render(<Analytics clock={clock} save={() => Promise.reject(new Error('locked'))} />)
    await screen.findByTestId('stats-grid')
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus()
  })

  it('keeps the focus on Reset, which stays in edit mode', async () => {
    const user = userEvent.setup()
    render(<Analytics clock={clock} />)
    await screen.findByTestId('stats-grid')
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.getByRole('button', { name: 'Reset' })).toHaveFocus()
    expect(screen.getByRole('list', { name: 'Stats cards' })).toBeInTheDocument()
  })

  it('moves no focus when the screen first opens', async () => {
    render(<Analytics clock={clock} />)
    await screen.findByTestId('stats-grid')
    expect(document.body).toHaveFocus()
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

describe('AnalyticsView heart rate zones', () => {
  it('names the max heart rate of the data under the zone split', () => {
    const entries = [entryOn(TODAY)]
    const data = analyse(entries, entries, 'week', TODAY, NOW, 12000, 'metric', [], undefined, {
      bpm: 175,
      source: 'override',
    })
    render(<AnalyticsView data={data} />)
    expect(screen.getByText('Based on a max of 175 bpm, set in Profile.')).toBeVisible()
  })
})

describe('AnalyticsHeader', () => {
  it('names the screen Stats', () => {
    render(<AnalyticsHeader label={null} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Stats' })).toBeInTheDocument()
  })
})
