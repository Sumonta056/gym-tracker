import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDay, listSessions, upsertDay } from '../lib/db/repository'

import {
  DailyEntryForm,
  finishedCount,
  nextWeight,
  prettyDate,
  sessionsText,
  toFormValues,
} from './DailyEntryForm'
import { ToastProvider } from './ui/Toast'

import type { DailyEntry, WorkoutSession } from '../lib/db/dexie'

vi.mock('../lib/db/repository', () => ({
  getDay: vi.fn(() => Promise.resolve(undefined)),
  upsertDay: vi.fn(() => Promise.resolve()),
  listSessions: vi.fn(() => Promise.resolve([])),
}))

const DATE = '2026-09-19'

const STORED: DailyEntry = {
  id: '11111111-1111-4111-8111-111111111111',
  entry_date: DATE,
  walk_seconds: 2538,
  gym_seconds: 4325,
  avg_heart_rate: 118,
  max_heart_rate: 164,
  weight_kg: 73.4,
  calories_burnt: 985,
  steps: 12480,
  note: 'Push day.',
  created_at: '2026-09-19T10:00:00.000Z',
  updated_at: '2026-09-19T10:00:00.000Z',
  deleted_at: null,
}

function setOnline(value: boolean): void {
  Object.defineProperty(globalThis.navigator, 'onLine', { configurable: true, value })
}

function pickerOf(name: 'Gym time' | 'Walk time') {
  return within(screen.getByRole('group', { name }))
}

async function renderForm() {
  render(<DailyEntryForm date={DATE} />)
  await waitFor(() => {
    expect(getDay).toHaveBeenCalledWith(DATE)
  })
}

function session(id: string, startedAt: string, endedAt: string | null): WorkoutSession {
  return {
    id,
    entry_date: DATE,
    started_at: startedAt,
    ended_at: endedAt,
    status: endedAt === null ? 'active' : 'finished',
    created_at: startedAt,
    updated_at: endedAt ?? startedAt,
    deleted_at: null,
  }
}

const TWO_SESSIONS = [
  session(
    'a1111111-1111-4111-8111-111111111111',
    '2026-09-19T07:00:00.000Z',
    '2026-09-19T07:30:00.000Z',
  ),
  session(
    'b2222222-2222-4222-8222-222222222222',
    '2026-09-19T17:00:00.000Z',
    '2026-09-19T17:42:05.000Z',
  ),
]

function gymGroup() {
  return within(screen.getByRole('group', { name: 'Gym time' }))
}

beforeEach(() => {
  vi.mocked(getDay).mockResolvedValue(undefined)
  vi.mocked(upsertDay).mockResolvedValue(undefined as never)
  vi.mocked(listSessions).mockResolvedValue([])
  setOnline(true)
})

describe('nextWeight', () => {
  it('adds 0.05 without a floating point tail', () => {
    expect(nextWeight(73.4, 1)).toBe(73.45)
  })

  it('takes 0.05 off in reverse', () => {
    expect(nextWeight(73.45, -1)).toBe(73.4)
  })

  it('never goes below the schema floor of 20', () => {
    expect(nextWeight(20, -1)).toBe(20)
  })

  it('never goes above the schema ceiling', () => {
    expect(nextWeight(300, 1)).toBe(300)
  })
})

describe('prettyDate', () => {
  it('reads the date the way the mockup writes it', () => {
    expect(prettyDate(DATE)).toBe('Sat 19 Sep')
  })
})

describe('toFormValues', () => {
  it('leaves an empty string where the entry holds nothing', () => {
    expect(
      toFormValues({
        ...STORED,
        walk_seconds: null,
        gym_seconds: null,
        avg_heart_rate: null,
        max_heart_rate: null,
        weight_kg: null,
        calories_burnt: null,
        steps: null,
        note: null,
      }),
    ).toEqual({
      entry_date: DATE,
      walk_seconds: null,
      gym_seconds: null,
      avg_heart_rate: '',
      max_heart_rate: '',
      weight_kg: '',
      calories_burnt: '',
      steps: '',
      note: '',
    })
  })
})

describe('DailyEntryForm', () => {
  it('ties every input to a label', async () => {
    await renderForm()
    for (const label of [
      'Avg heart rate',
      'Max heart rate',
      'Weight (kg)',
      'Calories',
      'Steps',
      'Note',
    ]) {
      expect(screen.getByLabelText(label)).toBeInstanceOf(HTMLInputElement)
    }
    expect(screen.getByRole('group', { name: 'Gym time' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Walk time' })).toBeInTheDocument()
  })

  it('blocks the save when the max heart rate is below the average', async () => {
    await renderForm()
    await userEvent.type(screen.getByLabelText('Avg heart rate'), '150')
    await userEvent.type(screen.getByLabelText('Max heart rate'), '120')
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Max heart rate')).toHaveAttribute('aria-invalid', 'true')
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The peak heart rate cannot be below the average.',
    )
    expect(upsertDay).not.toHaveBeenCalled()
  })

  it('adds 0.05 to the weight from the plus button', async () => {
    await renderForm()
    const weight = screen.getByLabelText('Weight (kg)')
    await userEvent.type(weight, '73.40')
    await userEvent.click(screen.getByRole('button', { name: '+0.05 kg, increase the weight' }))
    expect(weight).toHaveValue('73.45')
  })

  it('takes 0.05 off the weight from the minus button', async () => {
    await renderForm()
    const weight = screen.getByLabelText('Weight (kg)')
    await userEvent.type(weight, '73.40')
    await userEvent.click(screen.getByRole('button', { name: '−0.05 kg, decrease the weight' }))
    expect(weight).toHaveValue('73.35')
  })

  it('holds the weight at the schema floor of 20', async () => {
    await renderForm()
    const weight = screen.getByLabelText('Weight (kg)')
    await userEvent.type(weight, '20.02')
    await userEvent.click(screen.getByRole('button', { name: '−0.05 kg, decrease the weight' }))
    expect(weight).toHaveValue('20.00')
  })

  it('starts each nudge button name with its visible text, so voice control can find it', async () => {
    await renderForm()
    const names = [
      ['−0.05', '−0.05 kg, decrease the weight'],
      ['+0.05', '+0.05 kg, increase the weight'],
    ] as const
    for (const [visible, name] of names) {
      const button = screen.getByRole('button', { name })
      expect(button).not.toHaveAttribute('aria-label')
      expect(button.textContent.startsWith(visible)).toBe(true)
    }
  })

  it('leaves the nudge buttons disabled while the weight is empty', async () => {
    await renderForm()
    expect(screen.getByRole('button', { name: '+0.05 kg, increase the weight' })).toBeDisabled()
  })

  it('says why the nudge buttons are off while the weight is empty', async () => {
    await renderForm()
    expect(screen.getByText('Enter a weight to use the 0.05 steps.')).toBeInTheDocument()
  })

  it('drops the nudge hint once a weight is there', async () => {
    await renderForm()
    await userEvent.type(screen.getByLabelText('Weight (kg)'), '73.40')
    expect(screen.queryByText('Enter a weight to use the 0.05 steps.')).not.toBeInTheDocument()
  })

  it('calls upsertDay once, with the picked seconds', async () => {
    await renderForm()
    await userEvent.click(pickerOf('Gym time').getByRole('button', { name: '1h' }))
    await userEvent.click(pickerOf('Walk time').getByRole('button', { name: '45m' }))
    await userEvent.type(screen.getByLabelText('Weight (kg)'), '73.40')
    await userEvent.type(screen.getByLabelText('Steps'), '12480')
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

    await waitFor(() => {
      expect(upsertDay).toHaveBeenCalledTimes(1)
    })
    expect(upsertDay).toHaveBeenCalledWith({
      entry_date: DATE,
      walk_seconds: 2700,
      gym_seconds: 3600,
      swim_seconds: null,
      avg_heart_rate: null,
      max_heart_rate: null,
      weight_kg: 73.4,
      calories_burnt: null,
      steps: 12480,
      note: null,
    })
    expect(await screen.findByText('Saved on this device.')).toBeInTheDocument()
  })

  it('never reaches the network while it saves', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await renderForm()
    await userEvent.type(screen.getByLabelText('Steps'), '9000')
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

    await waitFor(() => {
      expect(upsertDay).toHaveBeenCalledTimes(1)
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('says so when the save fails', async () => {
    vi.mocked(upsertDay).mockRejectedValueOnce(new Error('Dexie is closed.'))
    await renderForm()
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))
    expect(await screen.findByText('Dexie is closed.')).toBeInTheDocument()
  })

  it('shows the Saved toast after a save', async () => {
    render(
      <ToastProvider>
        <DailyEntryForm date={DATE} />
      </ToastProvider>,
    )
    await userEvent.type(await screen.findByLabelText('Steps'), '9000')
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

    await waitFor(() => {
      expect(screen.getByTestId('toast-region')).toHaveTextContent('Saved')
    })
  })

  it('shows no Saved toast when the save fails', async () => {
    vi.mocked(upsertDay).mockRejectedValueOnce(new Error('Dexie is closed.'))
    render(
      <ToastProvider>
        <DailyEntryForm date={DATE} />
      </ToastProvider>,
    )
    await userEvent.type(await screen.findByLabelText('Steps'), '9000')
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

    expect(await screen.findByText('Dexie is closed.')).toBeInTheDocument()
    expect(screen.getByTestId('toast-region')).toBeEmptyDOMElement()
  })

  it('fills the form from an entry that already exists for the date', async () => {
    vi.mocked(getDay).mockResolvedValue(STORED)
    await renderForm()

    await waitFor(() => {
      expect(pickerOf('Gym time').getByRole('status')).toHaveTextContent('1:12:05')
    })
    expect(pickerOf('Walk time').getByRole('status')).toHaveTextContent('42:18')
    expect(screen.getByLabelText('Avg heart rate')).toHaveValue('118')
    expect(screen.getByLabelText('Max heart rate')).toHaveValue('164')
    expect(screen.getByLabelText('Weight (kg)')).toHaveValue('73.40')
    expect(screen.getByLabelText('Calories')).toHaveValue('985')
    expect(screen.getByLabelText('Steps')).toHaveValue('12480')
    expect(screen.getByLabelText('Note')).toHaveValue('Push day.')
  })

  it('keeps a stored swim time when the form saves the day', async () => {
    vi.mocked(getDay).mockResolvedValue({ ...STORED, swim_seconds: 1500 })
    await renderForm()
    await waitFor(() => {
      expect(screen.getByLabelText('Steps')).toHaveValue('12480')
    })
    await userEvent.clear(screen.getByLabelText('Steps'))
    await userEvent.type(screen.getByLabelText('Steps'), '9000')
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

    await waitFor(() => {
      expect(upsertDay).toHaveBeenCalledTimes(1)
    })
    expect(upsertDay).toHaveBeenCalledWith(
      expect.objectContaining({ steps: 9000, swim_seconds: 1500 }),
    )
  })

  it('saves a null swim time for a new day', async () => {
    await renderForm()
    await userEvent.type(screen.getByLabelText('Steps'), '9000')
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

    await waitFor(() => {
      expect(upsertDay).toHaveBeenCalledTimes(1)
    })
    expect(upsertDay).toHaveBeenCalledWith(expect.objectContaining({ swim_seconds: null }))
  })

  it('says so when the stored entry cannot be read', async () => {
    vi.mocked(getDay).mockRejectedValueOnce(new Error('no'))
    await renderForm()
    expect(
      await screen.findByText('The saved entry for this day could not be read.'),
    ).toBeInTheDocument()
  })

  it('heads the screen with its title and date only, as the prototype log top bar does', async () => {
    await renderForm()
    const header = screen.getByRole('banner')
    expect(header).not.toHaveTextContent('Gym Tracker')
    expect(screen.getByRole('heading', { level: 1, name: 'Log' })).not.toHaveClass('mt-2')
  })

  it('sets gym and walk time with no text field', async () => {
    await renderForm()
    expect(pickerOf('Gym time').queryByRole('textbox')).not.toBeInTheDocument()
    expect(pickerOf('Walk time').queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('lays the gym time out before the walk time, as step 1.9 names them', async () => {
    await renderForm()
    const gym = screen.getByRole('group', { name: 'Gym time' })
    const walk = screen.getByRole('group', { name: 'Walk time' })
    expect(gym.compareDocumentPosition(walk) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('steps gym and walk time by 1 minute', async () => {
    await renderForm()
    expect(
      screen.getByRole('button', { name: 'Increase Gym time by 1 minute' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Increase Walk time by 1 minute' }),
    ).toBeInTheDocument()
  })

  it('saves no gym time after Clear on a stored value', async () => {
    vi.mocked(getDay).mockResolvedValue(STORED)
    await renderForm()
    await waitFor(() => {
      expect(pickerOf('Gym time').getByRole('status')).toHaveTextContent('1:12:05')
    })

    await userEvent.click(screen.getByRole('button', { name: 'Clear Gym time' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

    await waitFor(() => {
      expect(upsertDay).toHaveBeenCalledWith(expect.objectContaining({ gym_seconds: null }))
    })
  })

  it('hides the offline chip while the network is up', async () => {
    await renderForm()
    expect(screen.queryByText('Offline')).not.toBeInTheDocument()
  })

  it('shows the offline chip and says the data is safe when the network drops', async () => {
    await renderForm()
    setOnline(false)
    window.dispatchEvent(new Event('offline'))

    expect(await screen.findByText('Offline')).toBeInTheDocument()
    expect(screen.getByText(/Saved on this phone first/)).toBeInTheDocument()
  })

  it('goes back to no chip when the network returns', async () => {
    setOnline(false)
    await renderForm()
    expect(await screen.findByText('Offline')).toBeInTheDocument()

    setOnline(true)
    window.dispatchEvent(new Event('online'))
    await waitFor(() => {
      expect(screen.queryByText('Offline')).not.toBeInTheDocument()
    })
  })

  it('reads the phone keypad right for each kind of number', async () => {
    await renderForm()
    expect(screen.getByLabelText('Weight (kg)')).toHaveAttribute('inputMode', 'decimal')
    for (const label of ['Avg heart rate', 'Max heart rate', 'Calories', 'Steps']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('inputMode', 'numeric')
    }
  })

  it('names the day and the field count, as the mockup does', async () => {
    await renderForm()
    expect(screen.getByText('Sat 19 Sep · 8 fields')).toBeInTheDocument()
  })
})

describe('sessionsText', () => {
  it('names one session and the short time', () => {
    expect(sessionsText(1, 3600)).toBe('From 1 session · 1h')
  })

  it('names many sessions and the short time', () => {
    expect(sessionsText(2, 4325)).toBe('From 2 sessions · 1h 12m')
  })
})

describe('finishedCount', () => {
  it('counts only finished sessions that are not deleted', () => {
    const live = session('c3333333-3333-4333-8333-333333333333', '2026-09-19T18:00:00.000Z', null)
    const gone = { ...TWO_SESSIONS[0], deleted_at: '2026-09-19T19:00:00.000Z' } as WorkoutSession
    expect(finishedCount([...TWO_SESSIONS, live, gone])).toBe(2)
  })
})

describe('DailyEntryForm gym time', () => {
  it('reads the sessions of its own date through the repository', async () => {
    await renderForm()
    expect(listSessions).toHaveBeenCalledWith(DATE, DATE)
  })

  it('shows the sum of the sessions when no gym time is typed', async () => {
    vi.mocked(listSessions).mockResolvedValue(TWO_SESSIONS)
    await renderForm()

    expect(await screen.findByText('From 2 sessions · 1h 12m')).toBeVisible()
    expect(gymGroup().getByRole('status')).toHaveTextContent('1:12:05')
  })

  it('opens the picker at the session sum on Set a value', async () => {
    vi.mocked(listSessions).mockResolvedValue(TWO_SESSIONS)
    await renderForm()

    await userEvent.click(await screen.findByRole('button', { name: 'Set a value' }))

    expect(gymGroup().getByRole('status')).toHaveTextContent('1:12:05')
    expect(screen.getByRole('button', { name: 'Clear Gym time' })).toBeVisible()
  })

  it('goes back to the session sum on Clear', async () => {
    vi.mocked(listSessions).mockResolvedValue(TWO_SESSIONS)
    await renderForm()
    await userEvent.click(await screen.findByRole('button', { name: 'Set a value' }))

    await userEvent.click(screen.getByRole('button', { name: 'Clear Gym time' }))

    expect(screen.getByText('From 2 sessions · 1h 12m')).toBeVisible()
  })

  it('saves no gym time while the value comes from the sessions', async () => {
    vi.mocked(listSessions).mockResolvedValue(TWO_SESSIONS)
    await renderForm()
    await screen.findByText('From 2 sessions · 1h 12m')

    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

    await waitFor(() => {
      expect(upsertDay).toHaveBeenCalledWith(expect.objectContaining({ gym_seconds: null }))
    })
  })

  it('lets a typed value win and names the session time under it', async () => {
    vi.mocked(getDay).mockResolvedValue({ ...STORED, gym_seconds: 3600 })
    vi.mocked(listSessions).mockResolvedValue(TWO_SESSIONS)
    await renderForm()

    await waitFor(() => {
      expect(gymGroup().getByRole('status')).toHaveTextContent('1:00:00')
    })
    expect(screen.getByText('The sessions say 1h 12m. Clear to use them.')).toBeVisible()
  })

  it('shows the plain picker for a day with no session', async () => {
    await renderForm()
    expect(gymGroup().getByRole('status')).toHaveTextContent('Not set')
    expect(screen.queryByRole('button', { name: 'Set a value' })).not.toBeInTheDocument()
  })

  it('shows the plain picker and no error when the sessions cannot be read', async () => {
    vi.mocked(listSessions).mockRejectedValue(new Error('no'))
    await renderForm()
    await waitFor(() => {
      expect(listSessions).toHaveBeenCalled()
    })
    expect(gymGroup().getByRole('status')).toHaveTextContent('Not set')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('moves focus into the picker on Set a value', async () => {
    vi.mocked(listSessions).mockResolvedValue(TWO_SESSIONS)
    await renderForm()

    await userEvent.click(await screen.findByRole('button', { name: 'Set a value' }))

    expect(screen.getByRole('group', { name: 'Gym time' })).toHaveFocus()
  })

  it('moves focus to Set a value when Clear brings the session sum back', async () => {
    vi.mocked(listSessions).mockResolvedValue(TWO_SESSIONS)
    await renderForm()
    await userEvent.click(await screen.findByRole('button', { name: 'Set a value' }))

    await userEvent.click(screen.getByRole('button', { name: 'Clear Gym time' }))

    expect(screen.getByRole('button', { name: 'Set a value' })).toHaveFocus()
  })

  it('leaves focus alone when the sessions load', async () => {
    vi.mocked(listSessions).mockResolvedValue(TWO_SESSIONS)
    await renderForm()

    await screen.findByText('From 2 sessions · 1h 12m')

    expect(document.body).toHaveFocus()
  })

  it('reads the sessions through a given source instead of the repository', async () => {
    const readSessions = vi.fn(() => Promise.resolve(TWO_SESSIONS))
    render(<DailyEntryForm date={DATE} readSessions={readSessions} />)

    expect(await screen.findByText('From 2 sessions · 1h 12m')).toBeVisible()
    expect(readSessions).toHaveBeenCalledWith(DATE, DATE)
    expect(listSessions).not.toHaveBeenCalled()
  })
})
