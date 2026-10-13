import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PROFILE } from '../../tests/fixtures/dashboard'
import { SAVED_MESSAGE, ToastProvider } from '../ui/Toast'

import { MAX_HINT } from './heartRate'
import { HeartRateCard } from './HeartRateCard'
import { SAVE_FAILED, SAVED } from './TargetsCard'

import type { Profile } from '../../lib/db/dexie'

const SET: Profile = { ...PROFILE, birth_year: 1996, max_heart_rate: null }

function renderCard(onSave = vi.fn(() => Promise.resolve()), profile: Profile = SET) {
  render(<HeartRateCard profile={profile} onSave={onSave} today="2026-09-23" />)
  return onSave
}

describe('HeartRateCard', () => {
  it('labels both fields', () => {
    renderCard()
    expect(screen.getByLabelText('Birth year')).toHaveValue('1996')
    expect(screen.getByLabelText('Max heart rate (bpm)')).toHaveValue('')
  })

  it('ties the hint to the max field', () => {
    renderCard()
    expect(screen.getByLabelText('Max heart rate (bpm)')).toHaveAccessibleDescription(MAX_HINT)
  })

  it('shows the max the zones use', () => {
    renderCard()
    expect(screen.getByText('The zones use 190 bpm, from your age.')).toBeInTheDocument()
  })

  it('asks for the birth year when the profile holds neither field', () => {
    renderCard(undefined, PROFILE)
    expect(screen.getByText('Add your birth year to see your max.')).toBeInTheDocument()
  })

  it('saves a changed birth year when the field loses focus', async () => {
    const onSave = renderCard()
    const field = screen.getByLabelText('Birth year')
    await userEvent.clear(field)
    await userEvent.type(field, '1990')
    await userEvent.tab()
    expect(onSave).toHaveBeenCalledWith({ birth_year: 1990 })
    expect(await screen.findByText(SAVED)).toBeInTheDocument()
  })

  it('does not save a field that lost focus unchanged', async () => {
    const onSave = renderCard()
    await userEvent.click(screen.getByLabelText('Birth year'))
    await userEvent.tab()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('clears the override when the field is emptied', async () => {
    const onSave = renderCard(undefined, { ...SET, max_heart_rate: 180 })
    await userEvent.clear(screen.getByLabelText('Max heart rate (bpm)'))
    await userEvent.tab()
    expect(onSave).toHaveBeenCalledWith({ max_heart_rate: null })
  })

  it('refuses a birth year outside the range and ties the message to the field', async () => {
    const onSave = renderCard()
    const field = screen.getByLabelText('Birth year')
    await userEvent.clear(field)
    await userEvent.type(field, '1850')
    await userEvent.tab()
    expect(onSave).not.toHaveBeenCalled()
    expect(field).toHaveAttribute('aria-invalid', 'true')
  })

  it('says so when the save fails', async () => {
    renderCard(vi.fn(() => Promise.reject(new Error('disk'))))
    const field = screen.getByLabelText('Max heart rate (bpm)')
    await userEvent.type(field, '185')
    await userEvent.tab()
    expect(await screen.findByText(SAVE_FAILED)).toBeInTheDocument()
    expect(field).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows the Saved toast after a birth year saves', async () => {
    render(
      <ToastProvider>
        <HeartRateCard profile={SET} onSave={vi.fn(() => Promise.resolve())} today="2026-09-23" />
      </ToastProvider>,
    )
    const field = screen.getByLabelText('Birth year')
    await userEvent.clear(field)
    await userEvent.type(field, '1990')
    await userEvent.tab()
    expect(await screen.findByTestId('toast-region')).toHaveTextContent(SAVED_MESSAGE)
  })
})
