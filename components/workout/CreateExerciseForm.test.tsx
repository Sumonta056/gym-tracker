import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CREATE_FAILED, CreateExerciseActions, CreateExerciseForm } from './CreateExerciseForm'

import type { Exercise } from '../../lib/db/dexie'
import type { ExerciseInput } from '../../lib/schema/exercise'

function created(input: ExerciseInput): Exercise {
  return {
    ...input,
    id: '00000000-0000-4000-8000-000000000099',
    user_id: 'local',
    created_at: '2026-09-20T10:00:00.000Z',
    updated_at: '2026-09-20T10:00:00.000Z',
    deleted_at: null,
  }
}

function setup(props: Partial<Parameters<typeof CreateExerciseForm>[0]> = {}) {
  const onCreate = vi.fn((input: ExerciseInput) => Promise.resolve(created(input)))
  const onCreated = vi.fn()
  const onCancel = vi.fn()
  render(
    <>
      <CreateExerciseForm id="new-exercise" onCreate={onCreate} onCreated={onCreated} {...props} />
      <CreateExerciseActions formId="new-exercise" onCancel={onCancel} />
    </>,
  )
  return { onCreate, onCreated, onCancel }
}

function nameField() {
  return screen.getByRole('textbox', { name: 'Name' })
}

describe('CreateExerciseForm', () => {
  it('asks for a name and a muscle group only', () => {
    setup()
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(screen.getByRole('group', { name: 'Muscle group' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'All' })).not.toBeInTheDocument()
  })

  it('focuses the name field on open', async () => {
    setup()
    await waitFor(() => {
      expect(nameField()).toHaveFocus()
    })
  })

  it('starts from the name and group it is given', () => {
    setup({ initialName: 'Zercher', initialMuscleGroup: 'legs' })
    expect(nameField()).toHaveValue('Zercher')
    expect(screen.getByRole('button', { name: 'Legs' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows an error tied to the name field for an empty name', async () => {
    const { onCreate } = setup({ initialMuscleGroup: 'chest' })

    await userEvent.click(screen.getByRole('button', { name: 'Create and pick' }))

    const field = nameField()
    await waitFor(() => {
      expect(field).toHaveAttribute('aria-invalid', 'true')
    })
    const errorId = field.getAttribute('aria-describedby') ?? ''
    expect(document.getElementById(errorId)).toHaveTextContent('Enter a name for the exercise.')
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('treats a name of spaces as empty', async () => {
    const { onCreate } = setup({ initialName: '   ', initialMuscleGroup: 'chest' })
    await userEvent.click(screen.getByRole('button', { name: 'Create and pick' }))
    expect(await screen.findByText('Enter a name for the exercise.')).toBeInTheDocument()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('shows an error tied to the chips when no group is picked', async () => {
    const { onCreate } = setup({ initialName: 'Zercher squat' })

    await userEvent.click(screen.getByRole('button', { name: 'Create and pick' }))

    const chest = screen.getByRole('button', { name: 'Chest' })
    await waitFor(() => {
      expect(chest).toHaveAccessibleDescription('Pick a muscle group.')
    })
    const errorId = chest.getAttribute('aria-describedby') ?? ''
    expect(document.getElementById(errorId)).toHaveTextContent('Pick a muscle group.')
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('creates the exercise with a trimmed name and hands it back', async () => {
    const { onCreate, onCreated } = setup()

    await userEvent.type(nameField(), '  Hack Squat ')
    await userEvent.click(screen.getByRole('button', { name: 'Legs' }))
    await userEvent.click(screen.getByRole('button', { name: 'Create and pick' }))

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1)
    })
    expect(onCreate).toHaveBeenCalledWith({
      name: 'Hack Squat',
      muscle_group: 'legs',
      is_archived: false,
    })
    expect(onCreated.mock.calls[0]?.[0]).toMatchObject({ name: 'Hack Squat' })
  })

  it('shows the repository message when the save is refused', async () => {
    const onCreate = vi.fn(() => Promise.reject(new Error('This device is signed out.')))
    const { onCreated } = setup({ onCreate, initialName: 'Hack Squat', initialMuscleGroup: 'legs' })

    await userEvent.click(screen.getByRole('button', { name: 'Create and pick' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('This device is signed out.')
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('shows a plain message when the save fails with no reason', async () => {
    const onCreate = vi.fn(() => Promise.reject(new Error('')))
    setup({ onCreate, initialName: 'Hack Squat', initialMuscleGroup: 'legs' })

    await userEvent.click(screen.getByRole('button', { name: 'Create and pick' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(CREATE_FAILED)
  })

  it('shows a plain message when the save fails with a non error', async () => {
    const onCreate = vi.fn<(input: ExerciseInput) => Promise<Exercise>>().mockRejectedValue('no')
    setup({ onCreate, initialName: 'Hack Squat', initialMuscleGroup: 'legs' })

    await userEvent.click(screen.getByRole('button', { name: 'Create and pick' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(CREATE_FAILED)
  })

  it('goes back without a save', async () => {
    const { onCancel, onCreate } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Back to the list' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('submits once when the save button is pressed twice quickly', async () => {
    let finish: (row: Exercise) => void = () => undefined
    const onCreate = vi.fn(
      () =>
        new Promise<Exercise>((resolve) => {
          finish = resolve
        }),
    )
    const { onCreated } = setup({ onCreate, initialName: 'Hack Squat', initialMuscleGroup: 'legs' })
    const save = screen.getByRole('button', { name: 'Create and pick' })

    await userEvent.click(save)
    await userEvent.click(save)
    finish(created({ name: 'Hack Squat', muscle_group: 'legs', is_archived: false }))

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1)
    })
    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  it('lets the user try again after a refused save', async () => {
    const onCreate = vi
      .fn<(input: ExerciseInput) => Promise<Exercise>>()
      .mockRejectedValueOnce(new Error('Try later.'))
      .mockImplementation((input) => Promise.resolve(created(input)))
    const { onCreated } = setup({ onCreate, initialName: 'Hack Squat', initialMuscleGroup: 'legs' })

    await userEvent.click(screen.getByRole('button', { name: 'Create and pick' }))
    await screen.findByRole('alert')
    await userEvent.click(screen.getByRole('button', { name: 'Create and pick' }))

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1)
    })
  })
})
