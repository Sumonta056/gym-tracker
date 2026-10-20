import { configure, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  BODY_HINT,
  FIRST_TIME_HINT,
  lastTimeLine,
  OTHER_LABEL,
  OTHER_WEIGHT,
  PICK_WEIGHT,
  PlanSetRows,
  weightLabel,
  weightOptions,
} from './PlanSetRows'

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
    equipment: 'dumbbell',
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

describe('lastTimeLine', () => {
  it('reads the load and the reps', () => {
    expect(lastTimeLine({ reps: 10, weight_kg: 14 }, 'metric')).toBe('Last time 14 kg × 10')
  })

  it('reads body for a set with no weight', () => {
    expect(lastTimeLine({ reps: 12, weight_kg: null }, 'metric')).toBe('Last time body × 12')
  })
})

describe('weightLabel', () => {
  it('names the weight of a set', () => {
    expect(weightLabel(2)).toBe('Set 2 weight')
  })
})

describe('weightOptions', () => {
  it('labels each kilogram value in the chosen unit', () => {
    const { options } = weightOptions([2.5, 5], '', 'metric')

    expect(options).toEqual([
      { value: '2.5', label: '2.5 kg' },
      { value: '5', label: '5 kg' },
    ])
  })

  it('shows pounds on the imperial setting, with a value that reads back to the same kilograms', () => {
    const { options } = weightOptions([2.5], '', 'imperial')

    expect(options).toEqual([{ value: '5.51', label: '5.5 lb' }])
  })

  it('selects nothing on an empty load', () => {
    expect(weightOptions([2.5, 5], '', 'metric').selected).toBe('')
  })

  it('selects the list value that matches the load', () => {
    expect(weightOptions([2.5, 5], '5.0', 'metric').selected).toBe('5')
  })

  it('adds a stored weight off the list in order, already selected', () => {
    const { options, selected } = weightOptions([2.5, 5], '3', 'metric')

    expect(options.map((option) => option.value)).toEqual(['2.5', '3', '5'])
    expect(options[1]).toEqual({ value: '3', label: '3 kg' })
    expect(selected).toBe('3')
  })

  it('adds a stored weight above the list at the end', () => {
    const { options } = weightOptions([2.5, 5], '60', 'metric')

    expect(options.map((option) => option.value)).toEqual(['2.5', '5', '60'])
  })
})

describe('PlanSetRows', () => {
  it('shows the dumbbell list and Other… in the weight select', () => {
    setup({ drafts: [{ reps: '10', load: '15' }] })

    const select = screen.getByRole('combobox', { name: 'Set 1 weight' })
    const options = within(select).getAllByRole('option')
    expect(options).toHaveLength(21)
    expect(options[0]).toHaveTextContent('2.5 kg')
    expect(options[19]).toHaveTextContent('50 kg')
    expect(options[20]).toHaveTextContent(OTHER_LABEL)
    expect(select).toHaveValue('15')
  })

  it('shows the cable list for a cable step', () => {
    setup({ drafts: [{ reps: '10', load: '20' }], equipment: 'cable' })

    const options = within(screen.getByRole('combobox', { name: 'Set 1 weight' })).getAllByRole(
      'option',
    )
    expect(options[0]).toHaveTextContent('5 kg')
    expect(options[19]).toHaveTextContent('100 kg')
  })

  it('shows Pick in the select on a first time', () => {
    setup({ drafts: [{ reps: '10', load: '' }] })

    const select = screen.getByRole('combobox', { name: 'Set 1 weight' })
    expect(select).toHaveValue('')
    expect(within(select).getByRole('option', { name: PICK_WEIGHT })).toBeDisabled()
  })

  it('passes a picked weight up', () => {
    const props = setup({ drafts: [REPEAT] })

    fireEvent.change(screen.getByRole('combobox', { name: 'Set 1 weight' }), {
      target: { value: '17.5' },
    })
    expect(props.onDraftChange).toHaveBeenCalledWith(0, { reps: '10', load: '17.5' })
  })

  it('turns the cell into a typed field on Other…, with focus in it', () => {
    const props = setup({ drafts: [REPEAT] })

    fireEvent.change(screen.getByRole('combobox', { name: 'Set 1 weight' }), {
      target: { value: OTHER_WEIGHT },
    })
    expect(props.onDraftChange).not.toHaveBeenCalled()
    const field = screen.getByRole('textbox', { name: 'Set 1 weight' })
    expect(field).toHaveFocus()
    expect(field).toHaveValue('14')
    fireEvent.change(field, { target: { value: '13' } })
    expect(props.onDraftChange).toHaveBeenCalledWith(0, { reps: '10', load: '13' })
  })

  it('shows a typed field for a load that is not a number', () => {
    setup({ drafts: [{ reps: '10', load: 'abc' }] })

    expect(screen.getByRole('textbox', { name: 'Set 1 weight' })).toHaveValue('abc')
  })

  it('keeps the weight select 44 px tall with a turned chevron', () => {
    setup({ drafts: [REPEAT] })

    const select = screen.getByRole('combobox', { name: 'Set 1 weight' })
    expect(select).toHaveClass('min-h-11', 'appearance-none')
    expect(select.parentElement?.querySelector('[data-icon="chevron"]')).toHaveClass('rotate-90')
  })

  it('shows the drafts filled from the last set on a repeat, with no hint', () => {
    setup({ drafts: [REPEAT, REPEAT, REPEAT], previous: { reps: 10, weight_kg: 14 } })

    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByLabelText('Set 1 weight')).toHaveValue('14')
    expect(screen.getByLabelText('Set 3 reps')).toHaveValue('10')
    expect(screen.queryByText(FIRST_TIME_HINT)).toBeNull()
  })

  it('leaves the weight empty on a first time, with the hint tied to it', () => {
    setup({ drafts: [{ reps: '10', load: '' }] })

    const load = screen.getByLabelText('Set 1 weight')
    expect(load).toHaveValue('')
    expect(screen.getByText(FIRST_TIME_HINT)).toBeInTheDocument()
    expect(load).toHaveAccessibleDescription(FIRST_TIME_HINT)
  })

  it('shows Body in place of the load on a body-weight step, also on a first time', () => {
    setup({ drafts: [{ reps: '12', load: '' }], equipment: 'body only' })

    expect(screen.queryByLabelText('Set 1 weight')).toBeNull()
    expect(screen.getByTestId('body-cell')).toHaveTextContent(BODY_HINT)
    expect(screen.queryByText(FIRST_TIME_HINT)).toBeNull()
  })

  it('logs a ticked body-weight draft with a null weight', async () => {
    const props = setup({ drafts: [{ reps: '12', load: '20' }], equipment: 'body only' })

    await userEvent.click(screen.getByRole('button', { name: 'Set 1 done' }))
    expect(props.onLog).toHaveBeenCalledWith(0, { reps: 12, weight_kg: null })
  })

  it('shows Body on a logged body-weight set', () => {
    setup({ sets: [loggedSet({ weight_kg: null })], equipment: 'body only' })

    expect(screen.getByRole('button', { name: /^Edit set 1/ })).toHaveTextContent(/^Body/)
  })

  it('infers nothing from a last set with no weight on a weighted step', () => {
    setup({ drafts: [{ reps: '12', load: '' }], previous: { reps: 12, weight_kg: null } })

    expect(screen.getByLabelText('Set 1 weight')).not.toHaveAttribute('placeholder')
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

    fireEvent.change(screen.getByLabelText('Set 1 weight'), { target: { value: '15' } })
    fireEvent.change(screen.getByLabelText('Set 1 reps'), { target: { value: '9' } })
    expect(props.onDraftChange).toHaveBeenCalledWith(0, { reps: '10', load: '15' })
    expect(screen.getByLabelText('Set 1 weight')).toHaveValue('14')
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

  it('draws + Add set 44 px tall with 14 px text, as plates 18 and 18b', () => {
    setup({ drafts: [REPEAT] })

    const add = screen.getByRole('button', { name: 'Add set to Flat Dumbbell Press' })
    expect(add).toHaveClass('min-h-11', 'text-sm')
    expect(add).not.toHaveClass('min-h-[54px]')
  })

  it('makes every tick 44 px square', () => {
    setup({ sets: [loggedSet()], drafts: [REPEAT] })

    for (const tick of screen.getAllByRole('button', { name: /done$/ })) {
      expect(tick).toHaveClass('size-11')
    }
  })
})
