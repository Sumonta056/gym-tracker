import { configure, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { BODY_HINT, FIRST_TIME_HINT, lastTimePill, PlanSetRows } from './PlanSetRows'

import type { PlanSetRowsProps } from './PlanSetRows'
import type { WorkoutSet } from '../../lib/db/dexie'
import type { DraftText } from '../workout/ExerciseCard'

configure({ asyncUtilTimeout: 5000 })
vi.setConfig({ testTimeout: 20000 })

function loggedSet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: crypto.randomUUID(),
    session_id: 'session',
    exercise_id: 'exercise',
    set_index: 0,
    reps: 10,
    weight_kg: 14,
    rpe: null,
    completed_at: '2026-10-20T09:00:00.000Z',
    created_at: '2026-10-20T09:00:00.000Z',
    updated_at: '2026-10-20T09:00:00.000Z',
    deleted_at: null,
    ...overrides,
  }
}

function setup(overrides: Partial<PlanSetRowsProps> = {}) {
  const props: PlanSetRowsProps = {
    name: 'Flat Dumbbell Press',
    unit: 'metric',
    sets: [],
    drafts: [],
    previous: undefined,
    bodyweight: false,
    onDraftChange: vi.fn(),
    onLog: vi.fn(),
    onAddRow: vi.fn(),
    onEdit: vi.fn(),
    onUndo: vi.fn(),
    ...overrides,
  }
  render(<PlanSetRows {...props} />)
  return props
}

const REPEAT: DraftText = { reps: '10', load: '14' }

describe('lastTimePill', () => {
  it('reads the load and the reps', () => {
    expect(lastTimePill({ reps: 10, weight_kg: 14 }, 'metric')).toBe('Last time 14 kg × 10')
  })

  it('reads body for a set with no weight', () => {
    expect(lastTimePill({ reps: 12, weight_kg: null }, 'metric')).toBe('Last time body × 12')
  })
})

describe('PlanSetRows', () => {
  it('shows the drafts filled from the last set on a repeat, with no hint', () => {
    setup({ drafts: [REPEAT, REPEAT, REPEAT], previous: { reps: 10, weight_kg: 14 } })

    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByLabelText('Set 1 load')).toHaveValue('14')
    expect(screen.getByLabelText('Set 3 reps')).toHaveValue('10')
    expect(screen.queryByText(FIRST_TIME_HINT)).toBeNull()
  })

  it('leaves the weight empty on a first time, with the hint tied to it', () => {
    setup({ drafts: [{ reps: '10', load: '' }] })

    const load = screen.getByLabelText('Set 1 load')
    expect(load).toHaveValue('')
    expect(screen.getByText(FIRST_TIME_HINT)).toBeInTheDocument()
    expect(load).toHaveAccessibleDescription(FIRST_TIME_HINT)
  })

  it('shows Body in place of the load on a body-weight step, also on a first time', () => {
    setup({ drafts: [{ reps: '12', load: '' }], bodyweight: true })

    expect(screen.queryByLabelText('Set 1 load')).toBeNull()
    expect(screen.getByTestId('body-cell')).toHaveTextContent(BODY_HINT)
    expect(screen.queryByText(FIRST_TIME_HINT)).toBeNull()
  })

  it('logs a ticked body-weight draft with a null weight', async () => {
    const props = setup({ drafts: [{ reps: '12', load: '20' }], bodyweight: true })

    await userEvent.click(screen.getByRole('button', { name: 'Set 1 done' }))
    expect(props.onLog).toHaveBeenCalledWith(0, { reps: 12, weight_kg: null })
  })

  it('shows Body on a logged body-weight set', () => {
    setup({ sets: [loggedSet({ weight_kg: null })], bodyweight: true })

    expect(screen.getByRole('button', { name: /^Edit set 1/ })).toHaveTextContent(/^Body/)
  })

  it('infers nothing from a last set with no weight on a weighted step', () => {
    setup({ drafts: [{ reps: '12', load: '' }], previous: { reps: 12, weight_kg: null } })

    expect(screen.getByLabelText('Set 1 load')).not.toHaveAttribute('placeholder')
  })

  it('logs a ticked draft with a null weight when the load is left empty', async () => {
    const props = setup({
      drafts: [{ reps: '12', load: '' }],
      previous: { reps: 12, weight_kg: 10 },
    })

    await userEvent.click(screen.getByRole('button', { name: 'Set 1 done' }))
    expect(props.onLog).toHaveBeenCalledWith(0, { reps: 12, weight_kg: null })
  })

  it('logs a ticked draft with its load in kilograms', async () => {
    const props = setup({ drafts: [REPEAT, { reps: '8', load: '16' }] })

    await userEvent.click(screen.getByRole('button', { name: 'Set 2 done' }))
    expect(props.onLog).toHaveBeenCalledWith(1, { reps: 8, weight_kg: 16 })
  })

  it('refuses a draft with no reps and ties the error to the field', async () => {
    const props = setup({ drafts: [{ reps: '', load: '14' }] })

    await userEvent.click(screen.getByRole('button', { name: 'Set 1 done' }))
    expect(props.onLog).not.toHaveBeenCalled()
    const reps = screen.getByLabelText('Set 1 reps')
    expect(reps).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(reps.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id)
  })

  it('passes a typed value up', () => {
    const props = setup({ drafts: [REPEAT] })

    fireEvent.change(screen.getByLabelText('Set 1 load'), { target: { value: '15' } })
    fireEvent.change(screen.getByLabelText('Set 1 reps'), { target: { value: '9' } })
    expect(props.onDraftChange).toHaveBeenCalledWith(0, { reps: '10', load: '15' })
    expect(props.onDraftChange).toHaveBeenCalledWith(0, { reps: '9', load: '14' })
  })

  it('shows a logged set before the drafts, with a pressed tick', () => {
    setup({ sets: [loggedSet()], drafts: [REPEAT, REPEAT] })

    expect(screen.getByRole('button', { name: 'Set 1 done' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Set 2 done' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'Edit set 1, 14 kg, 10 reps' })).toBeInTheDocument()
  })

  it('opens the edit sheet from a logged row and undoes from its tick', async () => {
    const set = loggedSet()
    const props = setup({ sets: [set] })

    await userEvent.click(screen.getByRole('button', { name: 'Edit set 1, 14 kg, 10 reps' }))
    expect(props.onEdit).toHaveBeenCalledWith(set, 1)
    await userEvent.click(screen.getByRole('button', { name: 'Set 1 done' }))
    expect(props.onUndo).toHaveBeenCalledWith(set, 1)
  })

  it('asks for a new row on + Add set', async () => {
    const props = setup({ drafts: [REPEAT] })

    await userEvent.click(screen.getByRole('button', { name: 'Add set to Flat Dumbbell Press' }))
    expect(props.onAddRow).toHaveBeenCalledOnce()
  })

  it('makes every tick 44 px square', () => {
    setup({ sets: [loggedSet()], drafts: [REPEAT] })

    for (const tick of screen.getAllByRole('button', { name: /done$/ })) {
      expect(tick).toHaveClass('size-11')
    }
  })
})
