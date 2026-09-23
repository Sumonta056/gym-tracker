import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listRange } from '../../lib/db/repository'
import { entryOn, NOW, TODAY } from '../../tests/fixtures/dashboard'

import { Analytics, AnalyticsHeader, AnalyticsView } from './Analytics'
import { analyse } from './rangeData'

vi.mock('recharts', async (importOriginal) => {
  const { withFixedContainer } = await import('../../tests/fixtures/recharts')
  return withFixedContainer(await importOriginal<object>())
})

vi.mock('../../lib/db/repository', async () => {
  const { PROFILE } = await import('../../tests/fixtures/dashboard')
  return {
    listRange: vi.fn(),
    getProfile: vi.fn(() => Promise.resolve({ ...PROFILE, step_goal: 10000 })),
  }
})

const clock = () => NOW

function rangeReads(): string[][] {
  return vi
    .mocked(listRange)
    .mock.calls.filter(([from]) => from !== '0000-01-01')
    .map(([from, to]) => [from, to])
}

beforeEach(() => {
  vi.mocked(listRange).mockReset()
  vi.mocked(listRange).mockResolvedValue([])
})

describe('Analytics', () => {
  it('opens on the week tab and reads the week', async () => {
    render(<Analytics clock={clock} />)
    expect(await screen.findByText('21 – 27 September')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
    expect(rangeReads()).toEqual([['2026-09-15', '2026-09-27']])
  })

  it('changes the range passed to listRange when the tab changes', async () => {
    const user = userEvent.setup()
    render(<Analytics clock={clock} />)
    await screen.findByText('21 – 27 September')

    await user.click(screen.getByRole('button', { name: 'Month' }))
    expect(await screen.findByText('1 – 30 September')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Day' }))
    expect(await screen.findByText('23 September', { selector: 'p' })).toBeVisible()

    expect(rangeReads()).toEqual([
      ['2026-09-15', '2026-09-27'],
      ['2026-08-26', '2026-09-30'],
      ['2026-09-17', '2026-09-23'],
    ])
  })

  it('shows the loading state before the read settles', () => {
    vi.mocked(listRange).mockReturnValue(new Promise(() => undefined))
    render(<Analytics clock={clock} />)
    expect(screen.getByRole('status')).toHaveTextContent('Reading this device…')
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
    await screen.findByTestId('analytics-grid')
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(7)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

describe('AnalyticsView', () => {
  it('renders seven charts, each an image with a label', () => {
    const entries = [entryOn('2026-09-21'), entryOn(TODAY)]
    render(<AnalyticsView data={analyse(entries, entries, 'week', TODAY, NOW, 12000)} />)
    const grid = screen.getByTestId('analytics-grid')
    const images = within(grid).getAllByRole('img')
    expect(images).toHaveLength(7)
    for (const image of images) {
      expect(image).toHaveAccessibleName()
    }
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
