import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../../lib/db/dexie'
import {
  addSet,
  createExercise,
  listExercises,
  listSets,
  startSession,
} from '../../lib/db/repository'
import { ExercisePicker, PICK_TITLE } from '../workout/ExercisePicker'

import {
  BUILT_IN,
  CHANGE_FAILED,
  MANAGE_READ_FAILED,
  MANAGE_TITLE,
  ManageExercisesSheet,
  NO_OWN_EXERCISES,
  REPOSITORY_MANAGE_SOURCE,
} from './ManageExercisesSheet'

import type { ManageExerciseSource } from './ManageExercisesSheet'
import type { Exercise } from '../../lib/db/dexie'

vi.mock('../../lib/supabase/client', () => ({
  createClient: () => {
    throw new Error('no network in a component test')
  },
}))

const BENCH_ID = '33333333-3333-4333-8333-333333333333'

const BENCH: Exercise = {
  id: BENCH_ID,
  user_id: null,
  name: 'Bench Press',
  muscle_group: 'chest',
  is_archived: false,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  deleted_at: null,
}

async function createFly(): Promise<Exercise> {
  return createExercise({ name: 'Cable Fly', muscle_group: 'chest', is_archived: false })
}

function renderSheet(source: ManageExerciseSource = REPOSITORY_MANAGE_SOURCE) {
  const onClose = vi.fn()
  render(<ManageExercisesSheet open onClose={onClose} source={source} />)
  return { onClose, dialog: screen.getByRole('dialog', { name: MANAGE_TITLE }) }
}

async function pickerNames(): Promise<string[]> {
  const view = render(<ExercisePicker open onClose={vi.fn()} onPick={vi.fn()} />)
  const dialog = await screen.findByRole('dialog', { name: PICK_TITLE })
  await waitFor(() => {
    expect(within(dialog).queryByText('All exercises')).toBeInTheDocument()
  })
  const names = within(dialog)
    .getAllByRole('listitem')
    .map((item) => item.querySelector('.font-bold')?.textContent ?? '')
  view.unmount()
  return names
}

function fakeSource(rows: Exercise[], overrides: Partial<ManageExerciseSource> = {}) {
  return {
    listExercises: vi.fn(() => Promise.resolve(rows)),
    renameExercise: vi.fn((id: string, name: string) =>
      Promise.resolve({ ...(rows.find((row) => row.id === id) as Exercise), name }),
    ),
    archiveExercise: vi.fn(() => Promise.resolve()),
    restoreExercise: vi.fn(() => Promise.resolve()),
    ...overrides,
  } satisfies ManageExerciseSource
}

beforeEach(async () => {
  await db.open()
  await Promise.all([
    db.exercises.clear(),
    db.workoutSessions.clear(),
    db.workoutSets.clear(),
    db.outbox.clear(),
    db.syncMeta.clear(),
  ])
  await db.exercises.put(BENCH)
})

describe('ManageExercisesSheet acceptance', () => {
  it('renames an exercise so the picker shows the new name at once', async () => {
    const fly = await createFly()
    const { dialog } = renderSheet()

    await userEvent.click(await within(dialog).findByRole('button', { name: 'Rename Cable Fly' }))
    const input = within(dialog).getByLabelText('New name for Cable Fly')
    await userEvent.clear(input)
    await userEvent.type(input, 'Low Cable Fly')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Save the new name for Cable Fly' }),
    )

    expect(
      await within(dialog).findByRole('button', { name: 'Rename Low Cable Fly' }),
    ).toHaveFocus()
    expect((await db.exercises.get(fly.id))?.name).toBe('Low Cable Fly')
    expect(await pickerNames()).toContain('Low Cable Fly')
  })

  it('archives an exercise out of the picker and restores it back', async () => {
    await createFly()
    const { dialog } = renderSheet()

    await userEvent.click(await within(dialog).findByRole('button', { name: 'Archive Cable Fly' }))
    expect(await within(dialog).findByRole('button', { name: 'Restore Cable Fly' })).toHaveFocus()
    expect(await pickerNames()).not.toContain('Cable Fly')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Restore Cable Fly' }))
    expect(await within(dialog).findByRole('button', { name: 'Archive Cable Fly' })).toHaveFocus()
    expect(await pickerNames()).toContain('Cable Fly')
  })

  it('gives a global exercise no Rename or Archive button, only the Built in label', async () => {
    const { dialog } = renderSheet()

    const builtIn = await within(dialog).findByRole('region', { name: `${BUILT_IN} · 1` })
    expect(within(builtIn).getByText('Bench Press')).toBeInTheDocument()
    expect(within(builtIn).getByText(BUILT_IN)).toBeInTheDocument()
    expect(within(builtIn).queryAllByRole('button')).toHaveLength(0)
    expect(within(dialog).queryByRole('button', { name: /Bench Press/ })).not.toBeInTheDocument()
  })

  it('keeps a past set of an archived exercise and its name', async () => {
    const fly = await createFly()
    const session = await startSession('2026-09-20')
    const set = await addSet({ session_id: session.id, exercise_id: fly.id, reps: 10 })
    const { dialog } = renderSheet()

    await userEvent.click(await within(dialog).findByRole('button', { name: 'Archive Cable Fly' }))
    const archived = await within(dialog).findByRole('region', { name: 'Archived · 1' })

    expect(within(archived).getByText('Cable Fly')).toBeInTheDocument()
    expect((await listSets(session.id)).map((row) => row.id)).toEqual([set.id])
    const names = new Map(
      (await listExercises({ includeArchived: true })).map((row) => [row.id, row.name]),
    )
    expect(names.get(set.exercise_id)).toBe('Cable Fly')
  })

  it('names the exercise in every button', async () => {
    await createFly()
    const archivedRow = await createExercise({
      name: 'Hip Thrust',
      muscle_group: 'legs',
      is_archived: false,
    })
    await db.exercises.update(archivedRow.id, { is_archived: true })
    const { dialog } = renderSheet()

    await within(dialog).findByRole('button', { name: 'Restore Hip Thrust' })
    const rowButtons = within(dialog)
      .getAllByRole('button')
      .filter((button) => button.closest('li') !== null)
    expect(rowButtons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Rename Cable Fly',
      'Archive Cable Fly',
      'Restore Hip Thrust',
    ])

    await userEvent.click(within(dialog).getByRole('button', { name: 'Rename Cable Fly' }))
    expect(
      within(dialog).getByRole('button', { name: 'Save the new name for Cable Fly' }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: 'Cancel renaming Cable Fly' }),
    ).toBeInTheDocument()
  })
})

describe('ManageExercisesSheet', () => {
  it('renders nothing while closed', () => {
    render(<ManageExercisesSheet open={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('lists the active exercises before the archived ones, with counts', async () => {
    const hip: Exercise = {
      ...BENCH,
      id: '44444444-4444-4444-8444-444444444444',
      user_id: 'local',
      name: 'Hip Thrust',
      muscle_group: 'legs',
      is_archived: true,
    }
    const fly: Exercise = {
      ...BENCH,
      id: '55555555-5555-4555-8555-555555555555',
      user_id: 'local',
      name: 'Cable Fly',
    }
    const { dialog } = renderSheet(fakeSource([BENCH, hip, fly]))

    const yours = await within(dialog).findByRole('region', { name: 'Yours · 1 active' })
    const archived = within(dialog).getByRole('region', { name: 'Archived · 1' })
    expect(yours.compareDocumentPosition(archived) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(yours).getByText('Chest')).toHaveClass('text-muted')
    expect(within(archived).getByText('Hip Thrust', { selector: 'span' })).toHaveClass('text-muted')
    expect(within(archived).getByText('Legs')).toBeInTheDocument()
  })

  it('reads every exercise, archived ones included', async () => {
    const source = fakeSource([BENCH])
    renderSheet(source)
    await screen.findByRole('region', { name: `${BUILT_IN} · 1` })
    expect(source.listExercises).toHaveBeenCalledWith({ includeArchived: true })
  })

  it('says so when the user has no exercise of their own', async () => {
    const { dialog } = renderSheet(fakeSource([BENCH]))
    expect(await within(dialog).findByText(NO_OWN_EXERCISES)).toBeInTheDocument()
    expect(within(dialog).queryByRole('region', { name: /Archived/ })).not.toBeInTheDocument()
  })

  it('leaves the built in section out when there is no global exercise', async () => {
    const own: Exercise = { ...BENCH, user_id: 'local' }
    const { dialog } = renderSheet(fakeSource([own]))
    await within(dialog).findByRole('button', { name: 'Rename Bench Press' })
    expect(within(dialog).queryByRole('region', { name: /Built in/ })).not.toBeInTheDocument()
  })

  it('shows an alert when the exercises cannot be read', async () => {
    const { dialog } = renderSheet(
      fakeSource([], { listExercises: vi.fn(() => Promise.reject(new Error('closed'))) }),
    )
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(MANAGE_READ_FAILED)
  })

  it('shows an alert and keeps the row when an archive fails', async () => {
    const own: Exercise = { ...BENCH, user_id: 'local' }
    const { dialog } = renderSheet(
      fakeSource([own], { archiveExercise: vi.fn(() => Promise.reject(new Error('signed out'))) }),
    )
    await userEvent.click(
      await within(dialog).findByRole('button', { name: 'Archive Bench Press' }),
    )
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(CHANGE_FAILED)
    expect(within(dialog).getByRole('button', { name: 'Archive Bench Press' })).toBeInTheDocument()
  })

  it('shows an alert and keeps the rename open when a rename fails', async () => {
    const own: Exercise = { ...BENCH, user_id: 'local' }
    const { dialog } = renderSheet(
      fakeSource([own], { renameExercise: vi.fn(() => Promise.reject(new Error('signed out'))) }),
    )
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Rename Bench Press' }))
    await userEvent.type(within(dialog).getByLabelText('New name for Bench Press'), ' 2')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Save the new name for Bench Press' }),
    )
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(CHANGE_FAILED)
    expect(within(dialog).getByLabelText('New name for Bench Press')).toHaveValue('Bench Press 2')
  })

  it('ignores a second change while the first one runs', async () => {
    const own: Exercise = { ...BENCH, user_id: 'local' }
    let finish: () => void = () => undefined
    const archiveExercise = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    const { dialog } = renderSheet(fakeSource([own], { archiveExercise }))
    const button = await within(dialog).findByRole('button', { name: 'Archive Bench Press' })
    await userEvent.click(button)
    await userEvent.click(button)
    expect(archiveExercise).toHaveBeenCalledTimes(1)
    finish()
    await waitFor(() => {
      expect(archiveExercise).toHaveBeenCalledTimes(1)
    })
  })

  it('selects the current name when a rename starts', async () => {
    const own: Exercise = { ...BENCH, user_id: 'local' }
    const { dialog } = renderSheet(fakeSource([own]))
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Rename Bench Press' }))
    const input = within(dialog).getByLabelText<HTMLInputElement>('New name for Bench Press')
    expect(input).toHaveFocus()
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 'Bench Press'.length])
  })

  it('refuses an empty name with the schema message tied to the input', async () => {
    const own: Exercise = { ...BENCH, user_id: 'local' }
    const source = fakeSource([own])
    const { dialog } = renderSheet(source)
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Rename Bench Press' }))
    const input = within(dialog).getByLabelText('New name for Bench Press')
    await userEvent.clear(input)
    await userEvent.type(input, '   {Enter}')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Enter a name for the exercise.')
    expect(source.renameExercise).not.toHaveBeenCalled()
  })

  it('writes nothing when the name is unchanged, and returns focus to Rename', async () => {
    const own: Exercise = { ...BENCH, user_id: 'local' }
    const source = fakeSource([own])
    const { dialog } = renderSheet(source)
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Rename Bench Press' }))
    await userEvent.type(within(dialog).getByLabelText('New name for Bench Press'), '  {Enter}')
    expect(source.renameExercise).not.toHaveBeenCalled()
    expect(within(dialog).getByRole('button', { name: 'Rename Bench Press' })).toHaveFocus()
  })

  it('cancels a rename and returns focus to Rename', async () => {
    const own: Exercise = { ...BENCH, user_id: 'local' }
    const source = fakeSource([own])
    const { dialog } = renderSheet(source)
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Rename Bench Press' }))
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel renaming Bench Press' }),
    )
    expect(source.renameExercise).not.toHaveBeenCalled()
    expect(within(dialog).getByRole('button', { name: 'Rename Bench Press' })).toHaveFocus()
  })

  it('sends the trimmed name to the repository', async () => {
    const own: Exercise = { ...BENCH, user_id: 'local' }
    const source = fakeSource([own])
    const { dialog } = renderSheet(source)
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Rename Bench Press' }))
    const input = within(dialog).getByLabelText('New name for Bench Press')
    await userEvent.clear(input)
    await userEvent.type(input, '  Flat Bench  {Enter}')
    await waitFor(() => {
      expect(source.renameExercise).toHaveBeenCalledWith(BENCH_ID, 'Flat Bench')
    })
  })

  it('closes through its close button', async () => {
    const { dialog, onClose } = renderSheet(fakeSource([BENCH]))
    await userEvent.click(within(dialog).getByRole('button', { name: `Close ${MANAGE_TITLE}` }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('draws every row action as a 44 px pill', async () => {
    const own: Exercise = { ...BENCH, user_id: 'local' }
    const { dialog } = renderSheet(fakeSource([own]))
    expect(await within(dialog).findByRole('button', { name: 'Archive Bench Press' })).toHaveClass(
      'min-h-11',
      'rounded-full',
    )
  })
})
