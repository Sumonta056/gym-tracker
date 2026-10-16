import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { sessionOn } from '../../tests/fixtures/lifts'

import { rowLine, rowTitle } from './historyText'
import { EMPTY_HISTORY, SessionList } from './SessionList'

import type { HistoryList } from './useWorkoutHistory'
import type { SessionStats } from '../../lib/metrics/sessionStats'

const RECENT = sessionOn('2026-09-08')
const OLD = sessionOn('2026-09-01')

const RECENT_STATS: SessionStats = {
  durationSeconds: 4325,
  setCount: 18,
  exerciseCount: 4,
  volumeKg: 3420,
  newRecords: [],
}

const OLD_STATS: SessionStats = {
  durationSeconds: 3600,
  setCount: 1,
  exerciseCount: 1,
  volumeKg: 600,
  newRecords: [],
}

const LIST: HistoryList = {
  rows: [
    { session: RECENT, stats: RECENT_STATS },
    { session: OLD, stats: OLD_STATS },
  ],
  hasMore: false,
  unit: 'metric',
}

function renderList(list: HistoryList = LIST, note: string | null = null) {
  const onMore = vi.fn()
  render(<SessionList list={list} note={note} onMore={onMore} />)
  return onMore
}

function history() {
  return screen.getByRole('region', { name: 'History' })
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

  it('links each row to its session detail', () => {
    renderList()
    expect(
      within(history())
        .getAllByRole('link')
        .map((row) => row.getAttribute('href')),
    ).toEqual([`/workouts?session=${RECENT.id}`, `/workouts?session=${OLD.id}`])
  })

  it('writes the title and the line of each row', () => {
    renderList()
    const [recent, old] = within(history()).getAllByRole('link')
    expect(recent).toHaveTextContent(rowTitle(RECENT))
    expect(recent).toHaveTextContent(rowLine(RECENT_STATS, 'metric'))
    expect(old).toHaveTextContent(rowTitle(OLD))
    expect(old).toHaveTextContent('1h · 1 set · 600 kg')
  })

  it('puts the row title in strong text', () => {
    renderList()
    const [recent] = within(history()).getAllByRole('link')
    expect(recent?.querySelector('strong')).toHaveTextContent(rowTitle(RECENT))
  })

  it('sets every row as a card at least 44 px tall', () => {
    renderList()
    for (const row of within(history()).getAllByRole('link')) {
      expect(row).toHaveClass('min-h-11', 'rounded-card')
    }
  })

  it('writes the volume in pounds for imperial', () => {
    renderList({ ...LIST, unit: 'imperial' })
    expect(within(history()).getAllByRole('link')[0]).toHaveTextContent(
      '1h 12m · 18 sets · 7,540 lb',
    )
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
    const onMore = renderList({ ...LIST, hasMore: true })
    await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
    expect(onMore).toHaveBeenCalledTimes(1)
  })
})
