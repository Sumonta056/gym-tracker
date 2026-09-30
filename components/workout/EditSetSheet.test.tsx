import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { editTitle, EditSetSheet } from './EditSetSheet'

import type { EditingSet } from './EditSetSheet'
import type { WorkoutSet } from '../../lib/db/dexie'

function set(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    session_id: '20000000-0000-4000-8000-000000000001',
    exercise_id: '33333333-3333-4333-8333-333333333333',
    set_index: 1,
    reps: 8,
    weight_kg: 72.5,
    rpe: null,
    completed_at: null,
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    deleted_at: null,
    ...overrides,
  }
}

function editing(overrides: Partial<WorkoutSet> = {}): EditingSet {
  return { set: set(overrides), position: 2, exerciseName: 'Bench Press' }
}

function renderSheet(props: Partial<Parameters<typeof EditSetSheet>[0]> = {}) {
  const onSave = vi.fn()
  const onDelete = vi.fn()
  const onClose = vi.fn()
  render(
    <EditSetSheet
      editing={editing()}
      unit="metric"
      onSave={onSave}
      onDelete={onDelete}
      onClose={onClose}
      {...props}
    />,
  )
  return { onSave, onDelete, onClose }
}

function dialog() {
  return screen.getByRole('dialog', { name: 'Edit set 2' })
}

describe('editTitle', () => {
  it('names the set by its position', () => {
    expect(editTitle(3)).toBe('Edit set 3')
  })
})

describe('EditSetSheet', () => {
  it('renders nothing when no set is being edited', () => {
    renderSheet({ editing: null })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('fills the reps and the load of the set, and names the exercise', () => {
    renderSheet()

    expect(within(dialog()).getByLabelText('Reps')).toHaveValue('8')
    expect(within(dialog()).getByLabelText(/^Load/)).toHaveValue('72.5')
    expect(within(dialog()).getByText('Bench Press')).toBeInTheDocument()
  })

  it('saves the changed reps and load', async () => {
    const { onSave } = renderSheet()

    await userEvent.clear(within(dialog()).getByLabelText('Reps'))
    await userEvent.type(within(dialog()).getByLabelText('Reps'), '10')
    await userEvent.clear(within(dialog()).getByLabelText(/^Load/))
    await userEvent.type(within(dialog()).getByLabelText(/^Load/), '75')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Save set' }))

    expect(onSave).toHaveBeenCalledWith({ reps: 10, weight_kg: 75 })
  })

  it('keeps the stored load exactly when it is not changed', async () => {
    const { onSave } = renderImperial()

    await userEvent.click(within(dialog()).getByRole('button', { name: 'Save set' }))

    expect(onSave).toHaveBeenCalledWith({ reps: 8, weight_kg: 60 })
  })

  it('saves an empty load as no load', async () => {
    const { onSave } = renderSheet()

    await userEvent.clear(within(dialog()).getByLabelText(/^Load/))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Save set' }))

    expect(onSave).toHaveBeenCalledWith({ reps: 8, weight_kg: null })
  })

  it('ties the reps error to the field and saves nothing', async () => {
    const { onSave } = renderSheet()

    await userEvent.clear(within(dialog()).getByLabelText('Reps'))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Save set' }))

    const reps = within(dialog()).getByLabelText('Reps')
    expect(reps).toHaveAttribute('aria-invalid', 'true')
    expect(reps).toHaveAccessibleDescription('A set needs at least 1 rep.')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('deletes the set from its Delete button', async () => {
    const { onDelete } = renderSheet()

    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete set' }))

    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('deletes the set with the keyboard alone', async () => {
    const { onDelete } = renderSheet()
    const remove = within(dialog()).getByRole('button', { name: 'Delete set' })

    while (document.activeElement !== remove) {
      await userEvent.tab()
    }
    await userEvent.keyboard('{Enter}')

    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape', async () => {
    const { onClose } = renderSheet()

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('refuses a second tap while a change is saving', () => {
    renderSheet({ busy: true })

    expect(within(dialog()).getByRole('button', { name: 'Save set' })).toBeDisabled()
    expect(within(dialog()).getByRole('button', { name: 'Delete set' })).toBeDisabled()
  })

  it('shows a save failure as an alert inside the sheet', () => {
    renderSheet({ error: 'The set could not be changed on this device.' })

    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      'The set could not be changed on this device.',
    )
  })

  it('shows the load in pounds on an imperial profile', () => {
    renderImperial()

    expect(within(dialog()).getByLabelText(/^Load/)).toHaveValue('132.28')
  })
})

function renderImperial() {
  return renderSheet({ editing: editing({ weight_kg: 60 }), unit: 'imperial' })
}
