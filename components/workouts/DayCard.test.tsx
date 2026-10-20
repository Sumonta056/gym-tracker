import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { BENCH, sessionOn } from '../../tests/fixtures/lifts'
import { startedText } from '../workout/SessionTimer'

import { DayCard } from './DayCard'
import { EMPTY_ROW } from './historyText'

import type { HistoryRow } from './useWorkoutHistory'

const FULL = sessionOn('2026-10-16')
const EMPTY = sessionOn('2026-10-16', {
  id: '00000000-0000-4000-8000-0000000000aa',
  started_at: '2026-10-16T07:00:00.000Z',
  ended_at: '2026-10-16T07:00:30.000Z',
})

const FULL_ROW: HistoryRow = {
  session: FULL,
  stats: {
    durationSeconds: 3120,
    setCount: 14,
    exerciseCount: 4,
    volumeKg: 2700,
    newRecords: [
      { exerciseId: BENCH, weightKg: 100, reps: 3 },
      { exerciseId: 'other', weightKg: 60, reps: 8 },
    ],
  },
  groups: ['chest', 'arms'],
}

const EMPTY_ROW_DATA: HistoryRow = {
  session: EMPTY,
  stats: { durationSeconds: 30, setCount: 0, exerciseCount: 0, volumeKg: 0, newRecords: [] },
  groups: [],
}

function renderCard(today = '2026-10-17', rows: HistoryRow[] = [FULL_ROW, EMPTY_ROW_DATA]) {
  const onDelete = vi.fn()
  const view = render(
    <DayCard
      date="2026-10-16"
      rows={rows}
      unit="metric"
      maxKg={3420}
      today={today}
      onDelete={onDelete}
    />,
  )
  return { onDelete, ...view }
}

function links() {
  return screen.getAllByRole('link').slice(1)
}

function dayLink() {
  return screen.getByRole('link', { name: 'Open Fri 16 Oct' })
}

describe('DayCard', () => {
  it('shows the day number and the weekday in the date column', () => {
    renderCard()
    expect(dayLink()).toHaveTextContent('16Fri')
    expect(dayLink()).toHaveClass('bg-surface-2', 'w-[58px]')
  })

  it('opens the day on the Today screen from the date column', () => {
    renderCard()
    expect(dayLink()).toHaveAttribute('href', '/?date=2026-10-16')
  })

  it('opens the root from the date column of today', () => {
    renderCard('2026-10-16')
    expect(dayLink()).toHaveAttribute('href', '/')
  })

  it('fills the date column with the accent for today', () => {
    const { container } = renderCard('2026-10-16')
    expect(container.querySelector('[data-today="true"]')).toHaveClass(
      'bg-accent',
      'text-accent-ink',
    )
  })

  it('writes the time and the volume on the first line', () => {
    renderCard()
    expect(links()[0]?.querySelector('strong')).toHaveTextContent(
      `${startedText(FULL.started_at)} · 2,700 kg`,
    )
  })

  it('names the date for a screen reader inside the link', () => {
    renderCard()
    expect(links()[0]).toHaveAccessibleName(
      new RegExp(`^Fri 16 Oct ·\\s*${startedText(FULL.started_at)}`),
    )
  })

  it('shows the count of new records', () => {
    renderCard()
    expect(within(links()[0] as HTMLElement).getByText('2 PRs')).toHaveClass('text-accent')
  })

  it('shows no record chip without a new record', () => {
    renderCard()
    expect(within(links()[1] as HTMLElement).queryByText(/PR/)).toBeNull()
  })

  it('draws a volume bar against the biggest session', () => {
    renderCard()
    expect(within(links()[0] as HTMLElement).getByRole('img')).toHaveAccessibleName(
      '79% of your biggest session',
    )
  })

  it('writes the duration, the sets and the muscle groups', () => {
    renderCard()
    expect(links()[0]).toHaveTextContent('52m · 14 sets · Chest, Arms')
  })

  it('shows an empty session with the time alone, no bar and the empty text', () => {
    renderCard()
    const empty = links()[1] as HTMLElement
    expect(empty.querySelector('strong')).toHaveTextContent(startedText(EMPTY.started_at))
    expect(empty.querySelector('strong')).not.toHaveTextContent('kg')
    expect(within(empty).queryByRole('img')).toBeNull()
    expect(empty).toHaveTextContent(EMPTY_ROW)
  })

  it('divides the rows with a border', () => {
    renderCard()
    for (const item of screen.getAllByRole('listitem')) {
      expect(item).toHaveClass('not-first:border-t', 'border-border')
    }
  })

  it('puts the trash button beside the link, not inside it', () => {
    renderCard()
    const button = screen.getByRole('button', {
      name: `Delete the session of Fri 16 Oct at ${startedText(FULL.started_at)}`,
    })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveClass('size-11')
    expect(button.closest('a')).toBeNull()
  })

  it('hands the row to onDelete from the trash button', async () => {
    const { onDelete } = renderCard()
    await userEvent.click(
      screen.getByRole('button', {
        name: `Delete the session of Fri 16 Oct at ${startedText(EMPTY.started_at)}`,
      }),
    )
    expect(onDelete).toHaveBeenCalledWith(EMPTY_ROW_DATA)
  })
})
