import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { readRestText, REST_HINT, RestTimeSheet, restSheetTitle } from './RestTimeSheet'

import type { ChangingRest } from './RestTimeSheet'

const BENCH: ChangingRest = {
  exerciseId: '33333333-3333-4333-8333-333333333333',
  exerciseName: 'Bench Press',
  seconds: 90,
}

function renderSheet(props: Partial<Parameters<typeof RestTimeSheet>[0]> = {}) {
  const onSave = vi.fn()
  const onClose = vi.fn()
  render(<RestTimeSheet changing={BENCH} onSave={onSave} onClose={onClose} {...props} />)
  return { onSave, onClose }
}

function field() {
  return screen.getByLabelText('Rest time')
}

describe('readRestText', () => {
  it('reads a clock time as seconds', () => {
    expect(readRestText('1:30')).toEqual({ ok: true, seconds: 90 })
  })

  it('reads seconds and minutes with a unit', () => {
    expect(readRestText('45s')).toEqual({ ok: true, seconds: 45 })
    expect(readRestText('2m')).toEqual({ ok: true, seconds: 120 })
  })

  it('accepts a rest of 0 seconds', () => {
    expect(readRestText('0:00')).toEqual({ ok: true, seconds: 0 })
  })

  it('refuses a rest above the profile limit with the schema message', () => {
    expect(readRestText('1:00:01')).toEqual({
      ok: false,
      reason: 'A rest cannot be longer than 3600 seconds.',
    })
  })

  it('refuses text that is not a duration', () => {
    expect(readRestText('soon').ok).toBe(false)
  })
})

describe('RestTimeSheet', () => {
  it('opens with the exercise in the title and its rest in the field', () => {
    renderSheet()

    expect(screen.getByRole('dialog', { name: restSheetTitle('Bench Press') })).toBeInTheDocument()
    expect(field()).toHaveValue('1:30')
    expect(screen.getByText(REST_HINT)).toBeInTheDocument()
  })

  it('shows no minute rounded preview under the field', () => {
    renderSheet()

    expect(screen.queryByText(/1m$/)).not.toBeInTheDocument()
  })

  it('renders nothing while closed', () => {
    renderSheet({ changing: null })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('hands the new rest to its owner in seconds', async () => {
    const { onSave } = renderSheet()

    await userEvent.clear(field())
    await userEvent.type(field(), '2:15')
    await userEvent.click(screen.getByRole('button', { name: 'Save rest time' }))

    expect(onSave).toHaveBeenCalledWith(135)
  })

  it('ties the reason to the field and saves nothing on a bad rest', async () => {
    const { onSave } = renderSheet()

    await userEvent.clear(field())
    await userEvent.type(field(), '2:00:00')
    await userEvent.click(screen.getByRole('button', { name: 'Save rest time' }))

    expect(onSave).not.toHaveBeenCalled()
    expect(field()).toHaveAttribute('aria-invalid', 'true')
    expect(field()).toHaveAccessibleDescription(/A rest cannot be longer than 3600 seconds\./)
  })

  it('shows an error its owner reports', () => {
    renderSheet({ error: 'Not saved.' })

    expect(screen.getByRole('alert')).toHaveTextContent('Not saved.')
  })

  it('turns the save off while busy', () => {
    renderSheet({ busy: true })

    expect(screen.getByRole('button', { name: 'Save rest time' })).toBeDisabled()
  })

  it('closes through its owner', async () => {
    const { onClose } = renderSheet()

    await userEvent.click(screen.getByRole('button', { name: 'Close Rest for Bench Press' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
