import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { MAX_REST_SECONDS } from '../../lib/schema/profile'

import { RestTimeSheet, restSheetTitle } from './RestTimeSheet'

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

function picker() {
  return screen.getByRole('group', { name: 'Rest time' })
}

describe('RestTimeSheet', () => {
  it('keeps Save rest time in the sheet footer, so it stays above the keyboard', () => {
    renderSheet()

    const save = within(screen.getByTestId('sheet-footer')).getByRole('button', {
      name: 'Save rest time',
    })
    expect(save).toHaveAttribute('type', 'submit')
    expect(document.getElementById(save.getAttribute('form') ?? '')).toBeInstanceOf(HTMLFormElement)
  })

  it('opens with the exercise in the title and its rest in the picker', () => {
    renderSheet()

    expect(screen.getByRole('dialog', { name: restSheetTitle('Bench Press') })).toBeInTheDocument()
    expect(within(picker()).getByRole('status')).toHaveTextContent('1:30')
    expect(within(picker()).getByRole('button', { name: '1:30' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('holds no text field, so no keyboard opens', () => {
    renderSheet()

    expect(within(screen.getByRole('dialog')).queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('renders nothing while closed', () => {
    renderSheet({ changing: null })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('hands a preset rest to its owner in seconds', async () => {
    const { onSave } = renderSheet()

    await userEvent.click(within(picker()).getByRole('button', { name: '2m' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save rest time' }))

    expect(onSave).toHaveBeenCalledWith(120)
  })

  it('adds 15 seconds from the plus button', async () => {
    const { onSave } = renderSheet()

    await userEvent.click(screen.getByRole('button', { name: 'Increase Rest time by 15 seconds' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save rest time' }))

    expect(onSave).toHaveBeenCalledWith(105)
  })

  it('stops at the profile limit for a rest', () => {
    renderSheet({ changing: { ...BENCH, seconds: MAX_REST_SECONDS } })

    expect(screen.getByRole('button', { name: 'Increase Rest time by 15 seconds' })).toBeDisabled()
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
