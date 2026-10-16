import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { sessionOn } from '../../tests/fixtures/lifts'

import { DELETE_TITLE } from './DeleteSessionSheet'
import { EMPTY_HISTORY, SessionList } from './SessionList'

import type { HistoryList, HistoryRow } from './useWorkoutHistory'
import type { SessionStats } from '../../lib/metrics/sessionStats'

const RECENT = sessionOn('2026-10-16')
const SAME_DAY = sessionOn('2026-10-16', {
  id: '00000000-0000-4000-8000-0000000000aa',
  started_at: '2026-10-16T07:00:00.000Z',
})
const OLD = sessionOn('2026-09-29')

const RECENT_STATS: SessionStats = {
  durationSeconds: 4325,
  setCount: 18,
  exerciseCount: 4,
  volumeKg: 3420,
  newRecords: [],
}

const EMPTY_STATS: SessionStats = {
  durationSeconds: 30,
  setCount: 0,
  exerciseCount: 0,
  volumeKg: 0,
  newRecords: [],
}

const OLD_STATS: SessionStats = {
  durationSeconds: 3600,
  setCount: 1,
  exerciseCount: 1,
  volumeKg: 1710,
  newRecords: [],
}

const ROWS: HistoryRow[] = [
  { session: RECENT, stats: RECENT_STATS, groups: ['chest'] },
  { session: SAME_DAY, stats: EMPTY_STATS, groups: [] },
  { session: OLD, stats: OLD_STATS, groups: ['legs'] },
]

const LIST: HistoryList = { rows: ROWS, hasMore: false, unit: 'metric' }

function renderList(
  list: HistoryList = LIST,
  note: string | null = null,
  discard = vi.fn(() => Promise.resolve()),
) {
  const onMore = vi.fn()
  render(
    <SessionList list={list} note={note} onMore={onMore} today="2026-10-16" discard={discard} />,
  )
  return { onMore, discard }
}

function history() {
  return screen.getByRole('region', { name: 'History' })
}

function trash(index: number): HTMLElement {
  return screen.getAllByRole('button', { name: /^Delete the session of/ })[index] as HTMLElement
}

describe('EMPTY_HISTORY', () => {
  it('asks for a first session', () => {
    expect(EMPTY_HISTORY).toBe('No finished session yet. Start one above.')
  })
})

describe('SessionList', () => {
  it('is a section named by its History label', () => {
    renderList()
    expect(history().tagName).toBe('SECTION')
    expect(within(history()).getByText('History')).toBeInTheDocument()
  })

  it('heads each month with its name and its session count', () => {
    renderList()
    const headings = within(history()).getAllByRole('heading', { level: 2 })
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'October 20262 sessions',
      'September 20261 session',
    ])
  })

  it('puts the sessions of one date in one day card', () => {
    renderList()
    const cards = within(history()).getAllByTestId('day-card')
    expect(cards).toHaveLength(2)
    expect(within(cards[0] as HTMLElement).getAllByRole('link')).toHaveLength(2)
    expect(within(cards[1] as HTMLElement).getAllByRole('link')).toHaveLength(1)
  })

  it('links each row to its session detail', () => {
    renderList()
    expect(
      within(history())
        .getAllByRole('link')
        .map((row) => row.getAttribute('href')),
    ).toEqual([
      `/workouts?session=${RECENT.id}`,
      `/workouts?session=${SAME_DAY.id}`,
      `/workouts?session=${OLD.id}`,
    ])
  })

  it('marks the card of today only', () => {
    const { container } = render(
      <SessionList list={LIST} note={null} onMore={vi.fn()} today="2026-10-16" />,
    )
    expect(container.querySelectorAll('[data-today="true"]')).toHaveLength(1)
  })

  it('measures each bar against the biggest loaded session', () => {
    renderList()
    expect(
      within(history())
        .getAllByRole('img')
        .map((bar) => bar.getAttribute('aria-label')),
    ).toEqual(['100% of your biggest session', '50% of your biggest session'])
  })

  it('marks no card as today when the date differs', () => {
    const { container } = render(
      <SessionList list={LIST} note={null} onMore={vi.fn()} today="2026-10-17" />,
    )
    expect(container.querySelector('[data-today="true"]')).toBeNull()
  })

  it('reads the device date when no today is given', () => {
    const { container } = render(<SessionList list={LIST} note={null} onMore={vi.fn()} />)
    expect(container.querySelectorAll('[data-testid="day-card"]')).toHaveLength(2)
  })

  it('writes the volume in pounds for imperial', () => {
    renderList({ ...LIST, unit: 'imperial' })
    expect(within(history()).getAllByRole('link')[0]).toHaveTextContent('7,540 lb')
  })

  it('says so when no session is finished', () => {
    renderList({ rows: [], hasMore: false, unit: 'metric' })
    expect(within(history()).getByText(EMPTY_HISTORY)).toBeInTheDocument()
    expect(within(history()).queryByRole('link')).toBeNull()
  })

  it('writes no empty text when a row exists', () => {
    renderList()
    expect(screen.queryByText(EMPTY_HISTORY)).toBeNull()
  })

  it('shows the note as a status in the text colour', () => {
    renderList(LIST, 'That session is not on this device.')
    const note = screen.getByRole('status')
    expect(note.tagName).toBe('P')
    expect(note).toHaveTextContent('That session is not on this device.')
    expect(note).toHaveClass('text-text')
  })

  it('shows no status without a note', () => {
    renderList()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('hides Show more when no more session exists', () => {
    renderList()
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull()
  })

  it('calls onMore from Show more when more sessions exist', async () => {
    const { onMore } = renderList({ ...LIST, hasMore: true })
    await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
    expect(onMore).toHaveBeenCalledTimes(1)
  })

  it('opens the delete sheet for the row of the trash button', async () => {
    renderList()
    await userEvent.click(trash(2))
    const sheet = screen.getByRole('dialog', { name: DELETE_TITLE })
    expect(sheet).toHaveTextContent('1h · 1 set · 1,710 kg')
  })

  it('discards the session and closes the sheet on confirm', async () => {
    const { discard } = renderList()
    await userEvent.click(trash(0))
    await userEvent.click(screen.getByRole('button', { name: 'Delete session' }))
    expect(discard).toHaveBeenCalledWith(RECENT.id)
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('closes the sheet on Keep it with no discard', async () => {
    const { discard } = renderList()
    await userEvent.click(trash(0))
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(discard).not.toHaveBeenCalled()
  })
})
