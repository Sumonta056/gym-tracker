import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDay, listSessions, upsertDay } from '../lib/db/repository'
import { localDate } from '../lib/schema/dailyEntry'

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

const READ_FAILED =
  'The saved entry for this day could not be read, so it cannot be saved. Reload to try again.'

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
  swim_seconds: 2700,
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
  render(<DailyEntryForm date={DATE} onDateChange={vi.fn()} />)
  await waitFor(() => {
    expect(getDay).toHaveBeenCalledWith(DATE)
  })
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Save entry' })).toBeEnabled()
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

function swim() {
  return within(screen.getByRole('group', { name: 'Swim time' }))
}

function swimCall(): unknown {
  return vi.mocked(upsertDay).mock.calls[0]?.[0]
}

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
        swim_seconds: null,
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
      swim_seconds: null,
      avg_heart_rate: '',
      max_heart_rate: '',
      weight_kg: '',
      calories_burnt: '',
      steps: '',
      note: '',
    })
  })

  it('gives no swim time for a row saved before version 5', () => {
    const before: DailyEntry = { ...STORED }
    delete before.swim_seconds
    expect(toFormValues(before)).toMatchObject({ swim_seconds: null })
  })

  it('copies the stored swim time', () => {
    expect(toFormValues(STORED)).toMatchObject({ swim_seconds: 2700 })
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
        <DailyEntryForm date={DATE} onDateChange={vi.fn()} />
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
        <DailyEntryForm date={DATE} onDateChange={vi.fn()} />
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

  it('leaves a stored swim time to the repository when only another field changes', async () => {
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
    expect(upsertDay).toHaveBeenCalledWith(expect.objectContaining({ steps: 9000 }))
    expect(swimCall()).not.toHaveProperty('swim_seconds')
  })

  it('sends no swim time when the swim picker is untouched', async () => {
    await renderForm()
    await userEvent.type(screen.getByLabelText('Steps'), '9000')
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

    await waitFor(() => {
      expect(upsertDay).toHaveBeenCalledTimes(1)
    })
    expect(swimCall()).not.toHaveProperty('swim_seconds')
  })

  it('keeps Save disabled until the stored day is read', async () => {
    vi.mocked(getDay).mockReturnValue(new Promise<DailyEntry | undefined>(() => undefined))
    render(<DailyEntryForm date={DATE} onDateChange={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Steps'), '9000')
    const save = screen.getByRole('button', { name: 'Save entry' })
    expect(save).toBeDisabled()

    await userEvent.click(save)

    expect(upsertDay).not.toHaveBeenCalled()
  })

  it('saves nothing on a submit before the stored day is read', async () => {
    vi.mocked(getDay).mockReturnValue(new Promise<DailyEntry | undefined>(() => undefined))
    render(<DailyEntryForm date={DATE} onDateChange={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Steps'), '9000')

    const form = screen.getByRole('button', { name: 'Save entry' }).closest('form')
    if (form === null) throw new Error('no form')
    fireEvent.submit(form)

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(upsertDay).not.toHaveBeenCalled()
  })

  it('asks before it leaves a value typed while the save runs', async () => {
    let finish: (row: DailyEntry) => void = () => undefined
    vi.mocked(upsertDay).mockImplementationOnce(
      () =>
        new Promise<DailyEntry>((resolve) => {
          finish = resolve
        }),
    )
    const onDateChange = vi.fn()
    render(<DailyEntryForm date={DATE} onDateChange={onDateChange} />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save entry' })).toBeEnabled()
    })
    await userEvent.type(screen.getByLabelText('Steps'), '9000')
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))
    await waitFor(() => {
      expect(upsertDay).toHaveBeenCalledTimes(1)
    })

    await userEvent.type(screen.getByLabelText('Calories'), '700')
    finish(STORED)
    expect(await screen.findByText('Saved on this device.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^Previous day,/ }))

    expect(
      await screen.findByRole('dialog', { name: 'Discard the changes to Sat 19 Sep?' }),
    ).toBeVisible()
    expect(onDateChange).not.toHaveBeenCalled()
  })

  it('disables Save again while a new date is read, with no remount', async () => {
    let read: (entry: DailyEntry | undefined) => void = () => undefined
    const { rerender } = render(<DailyEntryForm date={DATE} onDateChange={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save entry' })).toBeEnabled()
    })
    vi.mocked(getDay).mockReturnValue(
      new Promise<DailyEntry | undefined>((resolve) => {
        read = resolve
      }),
    )

    rerender(<DailyEntryForm date="2026-09-18" onDateChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Save entry' })).toBeDisabled()
    read(undefined)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save entry' })).toBeEnabled()
    })
  })

  it('enables Save once a day with no entry is read', async () => {
    render(<DailyEntryForm date={DATE} onDateChange={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save entry' })).toBeEnabled()
    })
    await userEvent.type(screen.getByLabelText('Steps'), '9000')
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

    await waitFor(() => {
      expect(upsertDay).toHaveBeenCalledWith(expect.objectContaining({ steps: 9000 }))
    })
  })

  it('keeps Save disabled after the stored day could not be read, and says why', async () => {
    vi.mocked(getDay).mockRejectedValue(new Error('no'))
    render(<DailyEntryForm date={DATE} onDateChange={vi.fn()} />)
    const message = await screen.findByText(READ_FAILED)
    const save = screen.getByRole('button', { name: 'Save entry' })
    expect(save).toBeDisabled()
    expect(save).toHaveAttribute('aria-describedby', message.id)

    await userEvent.type(screen.getByLabelText('Steps'), '9000')
    await userEvent.click(save)

    expect(upsertDay).not.toHaveBeenCalled()
  })

  it('says so when the stored entry cannot be read', async () => {
    vi.mocked(getDay).mockRejectedValueOnce(new Error('no'))
    render(<DailyEntryForm date={DATE} onDateChange={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(READ_FAILED)
  })

  it('keeps a swim time tapped before the stored day is read', async () => {
    let read: (entry: DailyEntry) => void = () => undefined
    vi.mocked(getDay).mockReturnValue(
      new Promise<DailyEntry | undefined>((resolve) => {
        read = resolve
      }),
    )
    render(<DailyEntryForm date={DATE} onDateChange={vi.fn()} />)
    await userEvent.click(swim().getByRole('button', { name: '30m' }))

    read(STORED)
    await waitFor(() => {
      expect(screen.getByLabelText('Steps')).toHaveValue('12480')
    })
    expect(swim().getByRole('status')).toHaveTextContent('30:00')

    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))
    await waitFor(() => {
      expect(upsertDay).toHaveBeenCalledWith(
        expect.objectContaining({ swim_seconds: 1800, steps: 12480 }),
      )
    })
  })

  it('keeps a value typed before the stored day is read', async () => {
    let read: (entry: DailyEntry) => void = () => undefined
    vi.mocked(getDay).mockReturnValue(
      new Promise<DailyEntry | undefined>((resolve) => {
        read = resolve
      }),
    )
    render(<DailyEntryForm date={DATE} onDateChange={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Calories'), '700')

    read(STORED)
    await waitFor(() => {
      expect(screen.getByLabelText('Steps')).toHaveValue('12480')
    })
    expect(screen.getByLabelText('Calories')).toHaveValue('700')
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
    expect(screen.getByText('Sat 19 Sep · 9 fields')).toBeInTheDocument()
  })

  it('names each day button with the day it opens, at the field height', async () => {
    await renderForm()
    const previous = screen.getByRole('button', { name: 'Previous day, Fri 18 Sep' })
    const next = screen.getByRole('button', { name: 'Next day, Sun 20 Sep' })
    for (const button of [previous, next]) {
      expect(button).toHaveClass('h-[52px]', 'w-11')
    }
  })

  it('hands the previous day to its owner', async () => {
    const onDateChange = vi.fn()
    render(<DailyEntryForm date={DATE} onDateChange={onDateChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Previous day, Fri 18 Sep' }))
    expect(onDateChange).toHaveBeenCalledWith('2026-09-18', 'previous')
  })

  it('hands the next day to its owner on a past day', async () => {
    const onDateChange = vi.fn()
    render(<DailyEntryForm date={DATE} onDateChange={onDateChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Next day, Sun 20 Sep' }))
    expect(onDateChange).toHaveBeenCalledWith('2026-09-20', 'next')
  })

  it('turns a picked future day into today', () => {
    const onDateChange = vi.fn()
    render(<DailyEntryForm date={DATE} onDateChange={onDateChange} />)
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: '2999-01-01' } })
    expect(onDateChange).toHaveBeenCalledWith(localDate(), 'day')
  })

  it('changes nothing when the Day field is emptied', () => {
    const onDateChange = vi.fn()
    render(<DailyEntryForm date={DATE} onDateChange={onDateChange} />)
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: '' } })
    expect(onDateChange).not.toHaveBeenCalled()
  })
})

describe('DailyEntryForm Day field typed with the keyboard', () => {
  function typeDate(field: HTMLElement, value: string) {
    fireEvent.keyDown(field, { key: '1' })
    fireEvent.change(field, { target: { value } })
    fireEvent.keyUp(field, { key: '1' })
  }

  it('changes no day while the segments are typed', () => {
    const onDateChange = vi.fn()
    render(<DailyEntryForm date={DATE} onDateChange={onDateChange} />)
    const field = screen.getByLabelText('Day')

    typeDate(field, '2026-09-01')
    typeDate(field, '2026-09-15')

    expect(onDateChange).not.toHaveBeenCalled()
    expect(field).toHaveValue('2026-09-15')
  })

  it('opens the typed day once on blur', () => {
    const onDateChange = vi.fn()
    render(<DailyEntryForm date={DATE} onDateChange={onDateChange} />)
    const field = screen.getByLabelText('Day')
    typeDate(field, '2026-09-15')

    fireEvent.blur(field)
    fireEvent.blur(field)

    expect(onDateChange).toHaveBeenCalledTimes(1)
    expect(onDateChange).toHaveBeenCalledWith('2026-09-15', 'day')
  })

  it('opens the typed day once on Enter, without saving the form', () => {
    const onDateChange = vi.fn()
    render(<DailyEntryForm date={DATE} onDateChange={onDateChange} />)
    const field = screen.getByLabelText('Day')
    typeDate(field, '2026-09-15')

    fireEvent.keyDown(field, { key: 'Enter' })
    fireEvent.blur(field)

    expect(onDateChange).toHaveBeenCalledTimes(1)
    expect(onDateChange).toHaveBeenCalledWith('2026-09-15', 'day')
    expect(upsertDay).not.toHaveBeenCalled()
  })

  it('shows the current day again when a partial date is left on blur', () => {
    const onDateChange = vi.fn()
    render(<DailyEntryForm date={DATE} onDateChange={onDateChange} />)
    const field = screen.getByLabelText('Day')
    typeDate(field, '')

    fireEvent.blur(field)

    expect(onDateChange).not.toHaveBeenCalled()
    expect(field).toHaveValue(DATE)
  })

  it('turns a typed future day into today on Enter', () => {
    const onDateChange = vi.fn()
    render(<DailyEntryForm date={DATE} onDateChange={onDateChange} />)
    const field = screen.getByLabelText('Day')
    typeDate(field, '2999-01-01')

    fireEvent.keyDown(field, { key: 'Enter' })

    expect(onDateChange).toHaveBeenCalledWith(localDate(), 'day')
  })

  it('opens a day picked with no key pressed at once, as the iOS picker does', () => {
    const onDateChange = vi.fn()
    render(<DailyEntryForm date={DATE} onDateChange={onDateChange} />)
    const field = screen.getByLabelText('Day')

    fireEvent.change(field, { target: { value: '2026-09-15' } })
    fireEvent.blur(field)

    expect(onDateChange).toHaveBeenCalledTimes(1)
    expect(onDateChange).toHaveBeenCalledWith('2026-09-15', 'day')
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
    render(<DailyEntryForm date={DATE} onDateChange={vi.fn()} readSessions={readSessions} />)

    expect(await screen.findByText('From 2 sessions · 1h 12m')).toBeVisible()
    expect(readSessions).toHaveBeenCalledWith(DATE, DATE)
    expect(listSessions).not.toHaveBeenCalled()
  })
})

describe('the Swimming card', () => {
  it('sits after walk time, under its own heading', async () => {
    await renderForm()
    const walk = screen.getByRole('group', { name: 'Walk time' })
    const picker = screen.getByRole('group', { name: 'Swim time' })
    expect(walk.compareDocumentPosition(picker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Swimming' })).toBeVisible()
  })

  it('says the card holds the time in the pool and no distance', async () => {
    await renderForm()
    expect(screen.getByText('The time in the pool today. No distance.')).toBeVisible()
  })

  it('sets swim time with taps only, in 1 minute steps and 4 presets', async () => {
    await renderForm()
    expect(swim().queryByRole('textbox')).not.toBeInTheDocument()
    expect(swim().getByRole('button', { name: 'Increase Swim time by 1 minute' })).toBeVisible()
    expect(
      swim()
        .getAllByRole('button', { pressed: false })
        .map((button) => button.textContent),
    ).toEqual(['15m', '30m', '45m', '1h'])
  })

  it('saves the picked swim time in seconds', async () => {
    await renderForm()
    await userEvent.click(swim().getByRole('button', { name: '30m' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

    await waitFor(() => {
      expect(upsertDay).toHaveBeenCalledWith(expect.objectContaining({ swim_seconds: 1800 }))
    })
  })

  it('saves no swim time after Clear', async () => {
    vi.mocked(getDay).mockResolvedValue(STORED)
    await renderForm()
    await waitFor(() => {
      expect(swim().getByRole('status')).toHaveTextContent('45:00')
    })

    await userEvent.click(screen.getByRole('button', { name: 'Clear Swim time' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

    await waitFor(() => {
      expect(upsertDay).toHaveBeenCalledWith(expect.objectContaining({ swim_seconds: null }))
    })
  })

  it('fills the swim time from the stored entry', async () => {
    vi.mocked(getDay).mockResolvedValue(STORED)
    await renderForm()
    await waitFor(() => {
      expect(swim().getByRole('status')).toHaveTextContent('45:00')
    })
    expect(swim().getByRole('button', { name: '45m' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps the swim time of a past day', async () => {
    render(<DailyEntryForm date="2026-09-10" onDateChange={vi.fn()} />)
    await waitFor(() => {
      expect(getDay).toHaveBeenCalledWith('2026-09-10')
    })

    await userEvent.click(swim().getByRole('button', { name: '30m' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

    await waitFor(() => {
      expect(upsertDay).toHaveBeenCalledWith(
        expect.objectContaining({ entry_date: '2026-09-10', swim_seconds: 1800 }),
      )
    })
  })

  it('keeps a swim time picked while the save runs', async () => {
    let finish: (row: DailyEntry) => void = () => undefined
    vi.mocked(upsertDay).mockImplementationOnce(
      () =>
        new Promise<DailyEntry>((resolve) => {
          finish = resolve
        }),
    )
    await renderForm()
    await userEvent.type(screen.getByLabelText('Steps'), '9000')
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))
    await waitFor(() => {
      expect(upsertDay).toHaveBeenCalledTimes(1)
    })

    await userEvent.click(swim().getByRole('button', { name: '30m' }))
    finish(STORED)
    expect(await screen.findByText('Saved on this device.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

    await waitFor(() => {
      expect(upsertDay).toHaveBeenCalledTimes(2)
    })
    expect(upsertDay).toHaveBeenLastCalledWith(expect.objectContaining({ swim_seconds: 1800 }))
  })

  it('sends no swim time when the swim time is set back to the stored one', async () => {
    vi.mocked(getDay).mockResolvedValue(STORED)
    await renderForm()
    await waitFor(() => {
      expect(swim().getByRole('status')).toHaveTextContent('45:00')
    })

    await userEvent.click(swim().getByRole('button', { name: '30m' }))
    await userEvent.click(swim().getByRole('button', { name: '45m' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

    await waitFor(() => {
      expect(upsertDay).toHaveBeenCalledTimes(1)
    })
    expect(swimCall()).not.toHaveProperty('swim_seconds')
  })

  it('asks before it leaves a day with a changed swim time', async () => {
    const onDateChange = vi.fn()
    render(<DailyEntryForm date={DATE} onDateChange={onDateChange} />)
    await waitFor(() => {
      expect(getDay).toHaveBeenCalledWith(DATE)
    })

    await userEvent.click(swim().getByRole('button', { name: '30m' }))
    await userEvent.click(screen.getByRole('button', { name: 'Previous day, Fri 18 Sep' }))

    expect(
      screen.getByRole('dialog', { name: `Discard the changes to ${prettyDate(DATE)}?` }),
    ).toBeInTheDocument()
    expect(onDateChange).not.toHaveBeenCalled()
  })
})
