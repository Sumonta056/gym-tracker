import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PROFILE } from '../../tests/fixtures/dashboard'
import { SAVED_MESSAGE, ToastProvider } from '../ui/Toast'

import { GOAL_TOO_SHORT } from './targets'
import { SAVE_FAILED, SAVED, TargetsCard } from './TargetsCard'

vi.mock('../ui/DurationPicker', () => ({
  DurationPicker: ({
    id,
    label,
    value,
    onChange,
    errorId,
  }: {
    id: string
    label: string
    value: number | null
    onChange: (seconds: number | null) => void
    errorId?: string
  }) => (
    <div role="group" aria-label={label} aria-describedby={errorId}>
      <span id={id}>{`${label}: ${value === null ? 'none' : String(value)}`}</span>
      <button
        type="button"
        onClick={() => {
          onChange(3600)
        }}
      >{`Set ${label}`}</button>
      <button
        type="button"
        onClick={() => {
          onChange(null)
        }}
      >{`Clear ${label}`}</button>
      <button
        type="button"
        onClick={() => {
          onChange(30)
        }}
      >{`Short ${label}`}</button>
    </div>
  ),
}))

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

  it('shows the Saved toast after a target saves', async () => {
    render(
      <ToastProvider>
        <TargetsCard profile={SET} unit="metric" onSave={vi.fn(() => Promise.resolve())} />
      </ToastProvider>,
    )
    const field = screen.getByLabelText('Daily step goal')
    await userEvent.clear(field)
    await userEvent.type(field, '9000')
    await userEvent.tab()

    await waitFor(() => {
      expect(screen.getByTestId('toast-region')).toHaveTextContent('Saved')
    })
  })
})

describe('TargetsCard goals', () => {
  it('labels the calorie goal and the sessions per week goal', () => {
    renderCard()
    expect(screen.getByLabelText('Daily calorie goal (kcal)')).toHaveValue('')
    expect(screen.getByLabelText('Sessions per week goal')).toHaveValue('')
  })

  it('shows the 2 duration goals', () => {
    renderCard()
    expect(screen.getByText('Daily gym time goal: none')).toBeInTheDocument()
    expect(screen.getByText('Daily walk time goal: none')).toBeInTheDocument()
  })

  it('saves a calorie goal when the field loses focus', async () => {
    const onSave = renderCard()
    await userEvent.type(screen.getByLabelText('Daily calorie goal (kcal)'), '800')
    await userEvent.tab()
    expect(onSave).toHaveBeenCalledWith({ calorie_goal: 800 })
  })

  it('saves no calorie goal when the field is cleared', async () => {
    const onSave = vi.fn(() => Promise.resolve())
    render(<TargetsCard profile={{ ...SET, calorie_goal: 800 }} unit="metric" onSave={onSave} />)
    await userEvent.clear(screen.getByLabelText('Daily calorie goal (kcal)'))
    await userEvent.tab()
    expect(onSave).toHaveBeenCalledWith({ calorie_goal: null })
  })

  it('refuses 15 sessions a week and ties the message to the field', async () => {
    const onSave = renderCard()
    const field = screen.getByLabelText('Sessions per week goal')
    await userEvent.type(field, '15')
    await userEvent.tab()
    expect(onSave).not.toHaveBeenCalled()
    expect(field).toHaveAttribute('aria-invalid', 'true')
  })

  it('saves a gym time goal from the picker', async () => {
    const onSave = renderCard()
    await userEvent.click(screen.getByRole('button', { name: 'Set Daily gym time goal' }))
    expect(onSave).toHaveBeenCalledWith({ gym_goal_seconds: 3600 })
    expect(await screen.findByText(SAVED)).toBeInTheDocument()
  })

  it('saves no walk time goal when the picker is cleared', async () => {
    const onSave = vi.fn(() => Promise.resolve())
    render(
      <TargetsCard profile={{ ...SET, walk_goal_seconds: 1800 }} unit="metric" onSave={onSave} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Clear Daily walk time goal' }))
    expect(onSave).toHaveBeenCalledWith({ walk_goal_seconds: null })
  })

  it('refuses a picker goal under 1 minute and saves nothing', async () => {
    const onSave = renderCard()
    await userEvent.click(screen.getByRole('button', { name: 'Short Daily gym time goal' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('ties a picker error to its picker', async () => {
    renderCard()
    await userEvent.click(screen.getByRole('button', { name: 'Short Daily gym time goal' }))
    expect(screen.getByRole('group', { name: 'Daily gym time goal' })).toHaveAccessibleDescription(
      GOAL_TOO_SHORT,
    )
    expect(screen.getByRole('group', { name: 'Daily walk time goal' })).not.toHaveAttribute(
      'aria-describedby',
    )
  })

  it('spaces a picker error like a field error', async () => {
    renderCard()
    await userEvent.click(screen.getByRole('button', { name: 'Short Daily gym time goal' }))
    expect(screen.getByRole('alert')).toHaveClass('mt-[7px]')
  })

  it('shows the picked value before the save ends', async () => {
    renderCard(vi.fn(() => new Promise<void>(() => undefined)))
    await userEvent.click(screen.getByRole('button', { name: 'Set Daily gym time goal' }))
    expect(screen.getByText('Daily gym time goal: 3600')).toBeInTheDocument()
  })

  it('puts the stored value back when the picker save fails', async () => {
    renderCard(vi.fn(() => Promise.reject(new Error('locked'))))
    await userEvent.click(screen.getByRole('button', { name: 'Set Daily gym time goal' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(SAVE_FAILED)
    expect(screen.getByText('Daily gym time goal: none')).toBeInTheDocument()
  })

  it('shows the Saved toast after a time goal saves', async () => {
    render(
      <ToastProvider>
        <TargetsCard profile={SET} unit="metric" onSave={vi.fn(() => Promise.resolve())} />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Set Daily gym time goal' }))
    expect(await screen.findByTestId('toast-region')).toHaveTextContent(SAVED_MESSAGE)
  })
})
