import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PROFILE } from '../../tests/fixtures/dashboard'

import { SAVE_FAILED, SAVED, TargetsCard } from './TargetsCard'

const SET = { ...PROFILE, target_weight_kg: 71, height_cm: 174 }

function renderCard(
  onSave = vi.fn(() => Promise.resolve()),
  unit: 'metric' | 'imperial' = 'metric',
) {
  render(<TargetsCard profile={SET} unit={unit} onSave={onSave} />)
  return onSave
}

describe('TargetsCard', () => {
  it('labels every target field', () => {
    renderCard()
    expect(screen.getByLabelText('Target weight (kg)')).toHaveValue('71.0')
    expect(screen.getByLabelText('Daily step goal')).toHaveValue('12000')
    expect(screen.getByLabelText('Height (cm)')).toHaveValue('174')
  })

  it('shows the target weight in pounds for imperial', () => {
    renderCard(undefined, 'imperial')
    expect(screen.getByLabelText('Target weight (lb)')).toHaveValue('156.5')
  })

  it('saves a changed target when the field loses focus', async () => {
    const onSave = renderCard()
    const field = screen.getByLabelText('Daily step goal')
    await userEvent.clear(field)
    await userEvent.type(field, '9000')
    await userEvent.tab()
    expect(onSave).toHaveBeenCalledWith({ step_goal: 9000 })
    expect(await screen.findByText(SAVED)).toBeInTheDocument()
  })

  it('saves an imperial target weight in kilograms', async () => {
    const onSave = renderCard(undefined, 'imperial')
    const field = screen.getByLabelText('Target weight (lb)')
    await userEvent.clear(field)
    await userEvent.type(field, '150')
    await userEvent.tab()
    expect(onSave).toHaveBeenCalledWith({ target_weight_kg: 68.04 })
  })

  it('saves nothing when the text did not change', async () => {
    const onSave = renderCard(undefined, 'imperial')
    await userEvent.click(screen.getByLabelText('Target weight (lb)'))
    await userEvent.tab()
    await userEvent.type(screen.getByLabelText('Daily step goal'), '{End}')
    await userEvent.tab()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('refuses an invalid target and ties the message to the field', async () => {
    const onSave = renderCard()
    const field = screen.getByLabelText('Daily step goal')
    await userEvent.clear(field)
    await userEvent.tab()
    expect(onSave).not.toHaveBeenCalled()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a whole number of steps.')
  })

  it('reports a save the device refused', async () => {
    renderCard(vi.fn(() => Promise.reject(new Error('locked'))))
    const field = screen.getByLabelText('Height (cm)')
    await userEvent.clear(field)
    await userEvent.type(field, '180')
    await userEvent.tab()
    expect(await screen.findByRole('alert')).toHaveTextContent(SAVE_FAILED)
  })
})
