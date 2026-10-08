import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDay, listSessions, upsertDay } from '../lib/db/repository'
import { logPath, shiftLogDate } from '../lib/format/logDate'
import { localDate } from '../lib/schema/dailyEntry'

import { prettyDate } from './DailyEntryForm'
import { LogDay } from './LogDay'

import type { DailyEntry } from '../lib/db/dexie'

const mocks = vi.hoisted(() => ({ search: '' }))

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mocks.search),
}))

vi.mock('../lib/db/repository', () => ({
  getDay: vi.fn(() => Promise.resolve(undefined)),
  upsertDay: vi.fn(() => Promise.resolve()),
  listSessions: vi.fn(() => Promise.resolve([])),
}))

const TODAY = localDate()
const PAST = shiftLogDate(TODAY, -3)

function dayField() {
  return screen.getByLabelText('Day')
}

function row(entryDate: string, fields: Partial<DailyEntry>): DailyEntry {
  return {
    id:
      entryDate === PAST
        ? '11111111-1111-4111-8111-111111111111'
        : '22222222-2222-4222-8222-222222222222',
    entry_date: entryDate,
    walk_seconds: null,
    gym_seconds: null,
    swim_seconds: null,
    avg_heart_rate: null,
    max_heart_rate: null,
    weight_kg: null,
    calories_burnt: null,
    steps: null,
    note: null,
    created_at: '2026-09-19T10:00:00.000Z',
    updated_at: '2026-09-19T10:00:00.000Z',
    deleted_at: null,
    ...fields,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.search = ''
  vi.mocked(getDay).mockResolvedValue(undefined)
  vi.mocked(upsertDay).mockResolvedValue(undefined as never)
  vi.mocked(listSessions).mockResolvedValue([])
})

describe('LogDay', () => {
  it('opens the day in the address and reads it', async () => {
    mocks.search = `date=${PAST}`
    render(<LogDay />)

    expect(dayField()).toHaveValue(PAST)
    await waitFor(() => {
      expect(getDay).toHaveBeenCalledWith(PAST)
    })
  })

  it.each(['2999-01-01', '2026-02-30', 'soon'])(
    'opens today for %s and rewrites the address',
    async (asked) => {
      const replaceState = vi.spyOn(window.history, 'replaceState')
      mocks.search = `date=${asked}`
      render(<LogDay />)

      expect(dayField()).toHaveValue(TODAY)
      await waitFor(() => {
        expect(replaceState).toHaveBeenCalledWith(null, '', logPath(TODAY))
      })
    },
  )

  it('opens the day before from the previous day button', async () => {
    const replaceState = vi.spyOn(window.history, 'replaceState')
    mocks.search = `date=${PAST}`
    render(<LogDay />)
    const before = shiftLogDate(PAST, -1)

    await userEvent.click(screen.getByRole('button', { name: /^Previous day,/ }))

    expect(dayField()).toHaveValue(before)
    expect(replaceState).toHaveBeenCalledWith(null, '', logPath(before))
    await waitFor(() => {
      expect(getDay).toHaveBeenCalledWith(before)
    })
  })

  it('turns the next day button off on today and on for a past day', async () => {
    const { unmount } = render(<LogDay />)
    expect(screen.getByRole('button', { name: /^Next day,/ })).toBeDisabled()
    unmount()

    mocks.search = `date=${PAST}`
    render(<LogDay />)
    await userEvent.click(screen.getByRole('button', { name: /^Next day,/ }))
    expect(dayField()).toHaveValue(shiftLogDate(PAST, 1))
  })

  it('caps the Day field at today, opens a picked day and ignores an emptied field', () => {
    render(<LogDay />)
    expect(dayField()).toHaveAttribute('max', TODAY)

    fireEvent.change(dayField(), { target: { value: PAST } })
    expect(dayField()).toHaveValue(PAST)

    fireEvent.change(dayField(), { target: { value: '' } })
    expect(dayField()).toHaveValue(PAST)
  })

  it('clears the fields of the old day on a day change', async () => {
    vi.mocked(getDay).mockImplementation((date) =>
      Promise.resolve(date === PAST ? row(PAST, { steps: 12480 }) : undefined),
    )
    mocks.search = `date=${PAST}`
    render(<LogDay />)
    await waitFor(() => {
      expect(screen.getByLabelText('Steps')).toHaveValue('12480')
    })

    await userEvent.click(screen.getByRole('button', { name: /^Previous day,/ }))

    await waitFor(() => {
      expect(screen.getByLabelText('Steps')).toHaveValue('')
    })
  })

  it('saves nothing of the old day onto the new day', async () => {
    vi.mocked(getDay).mockImplementation((date) =>
      Promise.resolve(
        date === PAST
          ? row(PAST, {
              walk_seconds: 1200,
              gym_seconds: 3600,
              swim_seconds: 900,
              avg_heart_rate: 118,
              max_heart_rate: 164,
              weight_kg: 73.4,
              calories_burnt: 985,
              steps: 12480,
              note: 'Push day.',
            })
          : undefined,
      ),
    )
    mocks.search = `date=${PAST}`
    render(<LogDay />)
    await waitFor(() => {
      expect(screen.getByLabelText('Steps')).toHaveValue('12480')
    })

    await userEvent.click(screen.getByRole('button', { name: /^Previous day,/ }))
    await waitFor(() => {
      expect(screen.getByLabelText('Steps')).toHaveValue('')
    })
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

    await waitFor(() => {
      expect(upsertDay).toHaveBeenCalledWith(
        expect.objectContaining({
          entry_date: shiftLogDate(PAST, -1),
          walk_seconds: null,
          gym_seconds: null,
          swim_seconds: null,
          avg_heart_rate: null,
          max_heart_rate: null,
          weight_kg: null,
          calories_burnt: null,
          steps: null,
          note: null,
        }),
      )
    })
    expect(upsertDay).not.toHaveBeenCalledWith(expect.objectContaining({ entry_date: PAST }))
  })

  it('keeps the swim time of the day it was read from', async () => {
    const previous = shiftLogDate(PAST, -1)
    vi.mocked(getDay).mockImplementation((date) =>
      Promise.resolve(
        date === PAST
          ? row(PAST, { swim_seconds: 900, steps: 111 })
          : date === previous
            ? row(previous, { swim_seconds: 600, steps: 222 })
            : undefined,
      ),
    )
    mocks.search = `date=${PAST}`
    render(<LogDay />)
    await waitFor(() => {
      expect(screen.getByLabelText('Steps')).toHaveValue('111')
    })

    await userEvent.click(screen.getByRole('button', { name: /^Previous day,/ }))
    await waitFor(() => {
      expect(screen.getByLabelText('Steps')).toHaveValue('222')
    })
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

    await waitFor(() => {
      expect(upsertDay).toHaveBeenCalledWith(
        expect.objectContaining({ entry_date: previous, swim_seconds: 600, steps: 222 }),
      )
    })
  })

  it('reads the sessions of the new day', async () => {
    const previous = shiftLogDate(PAST, -1)
    mocks.search = `date=${PAST}`
    render(<LogDay />)

    await userEvent.click(screen.getByRole('button', { name: /^Previous day,/ }))

    await waitFor(() => {
      expect(listSessions).toHaveBeenCalledWith(previous, previous)
    })
  })
})

describe('LogDay with unsaved edits', () => {
  async function openPastWithSteps() {
    vi.mocked(getDay).mockImplementation((date) =>
      Promise.resolve(date === PAST ? row(PAST, { steps: 4321 }) : undefined),
    )
    mocks.search = `date=${PAST}`
    render(<LogDay />)
    await waitFor(() => {
      expect(screen.getByLabelText('Steps')).toHaveValue('4321')
    })
  }

  async function typeSteps(value: string) {
    const steps = screen.getByLabelText('Steps')
    await userEvent.clear(steps)
    await userEvent.type(steps, value)
  }

  function question() {
    return screen.queryByRole('dialog', { name: `Discard the changes to ${prettyDate(PAST)}?` })
  }

  it('asks before the previous day button drops a typed value', async () => {
    await openPastWithSteps()
    await typeSteps('5000')

    await userEvent.click(screen.getByRole('button', { name: /^Previous day,/ }))

    expect(question()).toBeInTheDocument()
    expect(dayField()).toHaveValue(PAST)
  })

  it('puts the first focus of the question on Keep editing', async () => {
    await openPastWithSteps()
    await typeSteps('5000')

    await userEvent.click(screen.getByRole('button', { name: /^Previous day,/ }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Keep editing' })).toHaveFocus()
    })
  })

  it('opens the new day with empty fields after Discard', async () => {
    await openPastWithSteps()
    await typeSteps('5000')
    await userEvent.click(screen.getByRole('button', { name: /^Previous day,/ }))

    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))

    expect(question()).not.toBeInTheDocument()
    expect(dayField()).toHaveValue(shiftLogDate(PAST, -1))
    await waitFor(() => {
      expect(getDay).toHaveBeenCalledWith(shiftLogDate(PAST, -1))
    })
    expect(screen.getByLabelText('Steps')).toHaveValue('')
    expect(upsertDay).not.toHaveBeenCalled()
  })

  it('keeps the old day, the typed value and the focus after Keep editing, and saves nothing', async () => {
    await openPastWithSteps()
    await typeSteps('5000')
    const previous = screen.getByRole('button', { name: /^Previous day,/ })
    await userEvent.click(previous)

    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }))

    expect(question()).not.toBeInTheDocument()
    expect(dayField()).toHaveValue(PAST)
    expect(screen.getByLabelText('Steps')).toHaveValue('5000')
    await waitFor(() => {
      expect(previous).toHaveFocus()
    })
    expect(upsertDay).not.toHaveBeenCalled()
  })

  it('changes the day at once with no question when nothing is edited', async () => {
    await openPastWithSteps()

    await userEvent.click(screen.getByRole('button', { name: /^Previous day,/ }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(dayField()).toHaveValue(shiftLogDate(PAST, -1))
  })

  it('asks before the Day field drops an edit, and Keep editing shows the old date again', async () => {
    await openPastWithSteps()
    await typeSteps('5000')

    fireEvent.change(dayField(), { target: { value: shiftLogDate(PAST, -5) } })

    expect(question()).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(dayField()).toHaveValue(PAST)
    expect(screen.getByLabelText('Steps')).toHaveValue('5000')
  })

  it('opens the picked day after Discard from the Day field', async () => {
    await openPastWithSteps()
    await typeSteps('5000')

    fireEvent.change(dayField(), { target: { value: shiftLogDate(PAST, -5) } })
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))

    expect(dayField()).toHaveValue(shiftLogDate(PAST, -5))
  })

  it('asks after a picker change too', async () => {
    await openPastWithSteps()

    await userEvent.click(
      within(screen.getByRole('group', { name: 'Walk time' })).getByRole('button', {
        name: '30m',
      }),
    )
    await userEvent.click(screen.getByRole('button', { name: /^Previous day,/ }))

    expect(question()).toBeInTheDocument()
  })

  it('changes the day with no question after a save', async () => {
    await openPastWithSteps()
    await typeSteps('5000')
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))
    await waitFor(() => {
      expect(upsertDay).toHaveBeenCalledWith(expect.objectContaining({ steps: 5000 }))
    })

    await userEvent.click(screen.getByRole('button', { name: /^Previous day,/ }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(dayField()).toHaveValue(shiftLogDate(PAST, -1))
  })

  it('puts the focus on the previous day button of the new day after Discard', async () => {
    await openPastWithSteps()
    await typeSteps('5000')
    await userEvent.click(screen.getByRole('button', { name: /^Previous day,/ }))

    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Previous day,/ })).toHaveFocus()
    })
  })
})

describe('LogDay focus after a day change', () => {
  it('keeps the focus on the previous day button', async () => {
    mocks.search = `date=${PAST}`
    render(<LogDay />)

    await userEvent.click(screen.getByRole('button', { name: /^Previous day,/ }))

    expect(dayField()).toHaveValue(shiftLogDate(PAST, -1))
    expect(screen.getByRole('button', { name: /^Previous day,/ })).toHaveFocus()
  })

  it('keeps the focus on the next day button while it can still move', async () => {
    mocks.search = `date=${PAST}`
    render(<LogDay />)

    await userEvent.click(screen.getByRole('button', { name: /^Next day,/ }))

    expect(screen.getByRole('button', { name: /^Next day,/ })).toHaveFocus()
  })

  it('moves the focus to the Day field when the next day button turns off on today', async () => {
    mocks.search = `date=${shiftLogDate(TODAY, -1)}`
    render(<LogDay />)

    await userEvent.click(screen.getByRole('button', { name: /^Next day,/ }))

    expect(dayField()).toHaveValue(TODAY)
    expect(dayField()).toHaveFocus()
  })

  it('keeps the focus on the Day field after a pick', () => {
    render(<LogDay />)

    fireEvent.change(dayField(), { target: { value: PAST } })

    expect(dayField()).toHaveValue(PAST)
    expect(dayField()).toHaveFocus()
  })

  it('takes no focus on the first open', () => {
    mocks.search = `date=${PAST}`
    render(<LogDay />)

    expect(document.body).toHaveFocus()
  })
})
