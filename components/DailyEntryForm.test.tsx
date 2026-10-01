import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { acceptGymTimeOffer, getDay, gymTimeOfferOn, upsertDay } from '../lib/db/repository'
import { localDate } from '../lib/schema/dailyEntry'

import { DailyEntryForm, nextWeight, prettyDate, toFormValues } from './DailyEntryForm'
import { GYM_TIME_SAVE_FAILED } from './workout/GymTimeOffer'

import type { DailyEntry } from '../lib/db/dexie'
import type { GymTimeOffer } from '../lib/workout/gymTime'

vi.mock('../lib/db/repository', () => ({
  getDay: vi.fn(() => Promise.resolve(undefined)),
  upsertDay: vi.fn(() => Promise.resolve()),
  gymTimeOfferOn: vi.fn(() => Promise.resolve(null)),
  acceptGymTimeOffer: vi.fn(() => Promise.resolve()),
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

async function firstOffer(): Promise<HTMLElement> {
  const [offer] = await screen.findAllByRole('region', { name: 'Gym time from the session' })

  if (offer === undefined) {
    throw new Error('no offer')
  }

  return offer
}

async function firstUse(): Promise<HTMLElement> {
  return within(await firstOffer()).getByRole('button', { name: 'Use 1:12:05 for gym time' })
}

async function renderForm() {
  render(<DailyEntryForm date={DATE} />)
  await waitFor(() => {
    expect(getDay).toHaveBeenCalledWith(DATE)
  })
}

const SESSION_ID = '99999999-9999-4999-8999-999999999999'

const OFFER: GymTimeOffer = {
  sessionId: SESSION_ID,
  entryDate: DATE,
  sessionSeconds: 4325,
  loggedSeconds: 3900,
}

beforeEach(() => {
  vi.mocked(getDay).mockResolvedValue(undefined)
  vi.mocked(upsertDay).mockResolvedValue(undefined as never)
  vi.mocked(gymTimeOfferOn).mockResolvedValue(null)
  vi.mocked(acceptGymTimeOffer).mockResolvedValue(undefined as never)
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
      walk_seconds: '',
      gym_seconds: '',
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
      'Gym time',
      'Walk time',
      'Avg heart rate',
      'Max heart rate',
      'Weight (kg)',
      'Calories',
      'Steps',
      'Note',
    ]) {
      expect(screen.getByLabelText(label)).toBeInstanceOf(HTMLInputElement)
    }
  })

  it('blocks the save and names the problem when a duration cannot be read', async () => {
    await renderForm()
    await userEvent.type(screen.getByLabelText('Gym time'), 'about an hour')
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

    const field = screen.getByLabelText('Gym time')
    await waitFor(() => {
      expect(field).toHaveAttribute('aria-invalid', 'true')
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a duration such as 1:12:05, 72m or 1h 12m.',
    )
    expect(field.getAttribute('aria-describedby')).toContain(`${field.id}-error`)
    expect(upsertDay).not.toHaveBeenCalled()
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

  it('calls upsertDay once, with parsed seconds and never the raw text', async () => {
    await renderForm()
    await userEvent.type(screen.getByLabelText('Gym time'), '1h 12m')
    await userEvent.type(screen.getByLabelText('Walk time'), '42:18')
    await userEvent.type(screen.getByLabelText('Weight (kg)'), '73.40')
    await userEvent.type(screen.getByLabelText('Steps'), '12480')
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

    await waitFor(() => {
      expect(upsertDay).toHaveBeenCalledTimes(1)
    })
    expect(upsertDay).toHaveBeenCalledWith({
      entry_date: DATE,
      walk_seconds: 2538,
      gym_seconds: 4320,
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

  it('fills the form from an entry that already exists for the date', async () => {
    vi.mocked(getDay).mockResolvedValue(STORED)
    await renderForm()

    await waitFor(() => {
      expect(screen.getByLabelText('Gym time')).toHaveValue('1:12:05')
    })
    expect(screen.getByLabelText('Walk time')).toHaveValue('42:18')
    expect(screen.getByLabelText('Avg heart rate')).toHaveValue('118')
    expect(screen.getByLabelText('Max heart rate')).toHaveValue('164')
    expect(screen.getByLabelText('Weight (kg)')).toHaveValue('73.40')
    expect(screen.getByLabelText('Calories')).toHaveValue('985')
    expect(screen.getByLabelText('Steps')).toHaveValue('12480')
    expect(screen.getByLabelText('Note')).toHaveValue('Push day.')
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

  it('lays the gym time out before the walk time, as step 1.9 names them', async () => {
    await renderForm()
    const gym = screen.getByLabelText('Gym time')
    const walk = screen.getByLabelText('Walk time')
    expect(gym.compareDocumentPosition(walk) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows the parsed duration under the field as the user types', async () => {
    await renderForm()
    await userEvent.type(screen.getByLabelText('Gym time'), '72m')
    expect(screen.getByText('1:12:00 · 1h 12m')).toBeInTheDocument()
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

  it('shows no gym time offer for a date with nothing to offer', async () => {
    await renderForm()

    await waitFor(() => {
      expect(gymTimeOfferOn).toHaveBeenCalledWith(DATE)
    })
    expect(screen.queryAllByRole('region', { name: 'Gym time from the session' })).toHaveLength(0)
  })

  it('shows the session length and the logged gym time side by side', async () => {
    vi.mocked(gymTimeOfferOn).mockResolvedValue(OFFER)
    await renderForm()

    const offer = await firstOffer()

    expect(offer).toHaveTextContent(
      'The session on Sat 19 Sep was 1:12:05. Your log says 1:05:00. Use the session for gym time?',
    )
    expect(within(offer).getByRole('button', { name: 'Use 1:12:05 for gym time' })).toBeVisible()
  })

  it('says today for an offer on today', async () => {
    const today = localDate()
    vi.mocked(gymTimeOfferOn).mockResolvedValue({ ...OFFER, entryDate: today })
    render(<DailyEntryForm date={today} />)

    expect(await firstOffer()).toHaveTextContent("Today's session was 1:12:05.")
  })

  it('says the log has no gym time when the day holds none', async () => {
    vi.mocked(gymTimeOfferOn).mockResolvedValue({ ...OFFER, loggedSeconds: null })
    await renderForm()

    expect(await firstOffer()).toHaveTextContent('Your log has no gym time.')
  })

  it('writes the session length on Use, fills the field and hides the offer', async () => {
    vi.mocked(getDay).mockResolvedValue({ ...STORED, gym_seconds: 3900 })
    vi.mocked(gymTimeOfferOn).mockResolvedValueOnce(OFFER).mockResolvedValue(null)
    await renderForm()

    await userEvent.click(await firstUse())

    expect(acceptGymTimeOffer).toHaveBeenCalledWith(SESSION_ID)
    await waitFor(() => {
      expect(screen.queryAllByRole('region', { name: 'Gym time from the session' })).toHaveLength(0)
    })
    expect(screen.getByLabelText('Gym time')).toHaveValue('1:12:05')
    expect(screen.getByLabelText('Steps')).toHaveValue('12480')
    expect(upsertDay).not.toHaveBeenCalled()
  })

  it('keeps the offer and says so when Use cannot be saved', async () => {
    vi.mocked(gymTimeOfferOn).mockResolvedValue(OFFER)
    vi.mocked(acceptGymTimeOffer).mockRejectedValueOnce(new Error('disk full'))
    await renderForm()

    await userEvent.click(await firstUse())

    expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent(GYM_TIME_SAVE_FAILED)
    expect(screen.getAllByRole('region', { name: 'Gym time from the session' })[0]).toBeVisible()
  })

  it('reads the offer again after a save', async () => {
    await renderForm()
    vi.mocked(gymTimeOfferOn).mockResolvedValue(OFFER)

    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

    expect(await firstOffer()).toBeVisible()
  })

  it('shows no offer when the offer cannot be read', async () => {
    vi.mocked(gymTimeOfferOn).mockRejectedValue(new Error('no'))
    await renderForm()

    await waitFor(() => {
      expect(gymTimeOfferOn).toHaveBeenCalled()
    })
    expect(screen.queryAllByRole('region', { name: 'Gym time from the session' })).toHaveLength(0)
  })

  it('places the offer after gym time on the phone and after heart rate on wider screens', async () => {
    vi.mocked(gymTimeOfferOn).mockResolvedValue(OFFER)
    await renderForm()
    await firstOffer()

    const [phone, wide] = screen
      .getAllByRole('region', { name: 'Gym time from the session' })
      .map((offer) => offer.parentElement)
    const gym = screen.getByLabelText('Gym time')
    const avg = screen.getByLabelText('Avg heart rate')
    const max = screen.getByLabelText('Max heart rate')
    const follows = (first: Node, second: Node) =>
      Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)

    expect(phone).toHaveClass('flex', 'md:hidden')
    expect(wide).toHaveClass('hidden', 'md:col-span-2', 'md:flex')
    expect(phone && follows(gym, phone) && follows(phone, avg)).toBe(true)
    expect(wide && follows(max, wide)).toBe(true)
  })
})
