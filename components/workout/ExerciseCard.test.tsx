import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { draftFrom, ExerciseCard, lastTimeText, READING_LAST_SET, readDraft } from './ExerciseCard'
import { HOLD_MS } from './SetRow'

import type { WorkoutSet } from '../../lib/db/dexie'

function set(id: string, reps: number, weight_kg: number | null): WorkoutSet {
  return {
    id,
    session_id: '20000000-0000-4000-8000-000000000001',
    exercise_id: '33333333-3333-4333-8333-333333333333',
    set_index: 0,
    reps,
    weight_kg,
    rpe: null,
    completed_at: null,
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    deleted_at: null,
  }
}

const BENCH = { name: 'Bench Press', muscle_group: 'chest' as const }

function renderCard(props: Partial<Parameters<typeof ExerciseCard>[0]> = {}) {
  const onAddSet = vi.fn()
  const onEditSet = vi.fn()
  const onDeleteSet = vi.fn()
  render(
    <ExerciseCard
      exercise={BENCH}
      sets={[]}
      records={new Set()}
      unit="metric"
      source={undefined}
      sourceKey="none"
      onAddSet={onAddSet}
      onEditSet={onEditSet}
      onDeleteSet={onDeleteSet}
      {...props}
    />,
  )
  return {
    onAddSet,
    onEditSet,
    onDeleteSet,
    card: screen.getByRole('region', { name: 'Bench Press' }),
  }
}

describe('draftFrom', () => {
  it('is empty with nothing to copy', () => {
    expect(draftFrom(undefined, 'metric')).toEqual({ reps: '', load: '' })
  })

  it('copies the reps and the load', () => {
    expect(draftFrom(set('a', 8, 72.5), 'metric')).toEqual({ reps: '8', load: '72.5' })
  })

  it('leaves the load empty for a set with no load', () => {
    expect(draftFrom(set('a', 12, null), 'metric')).toEqual({ reps: '12', load: '' })
  })

  it('shows the load in pounds on an imperial profile', () => {
    expect(draftFrom(set('a', 5, 60), 'imperial').load).toBe('132.28')
  })
})

describe('readDraft', () => {
  it('reads reps and a load in kilograms', () => {
    expect(readDraft({ reps: '8', load: '60' }, 'metric', undefined)).toEqual({
      ok: true,
      values: { reps: 8, weight_kg: 60 },
    })
  })

  it('reads an empty load as no load', () => {
    expect(readDraft({ reps: '12', load: ' ' }, 'metric', undefined)).toEqual({
      ok: true,
      values: { reps: 12, weight_kg: null },
    })
  })

  it('reads a decimal comma', () => {
    expect(readDraft({ reps: '5', load: '72,5' }, 'metric', undefined)).toEqual({
      ok: true,
      values: { reps: 5, weight_kg: 72.5 },
    })
  })

  it('keeps the exact copied load when the shown pounds are unchanged', () => {
    const source = set('a', 5, 60)

    expect(readDraft(draftFrom(source, 'imperial'), 'imperial', source)).toEqual({
      ok: true,
      values: { reps: 5, weight_kg: 60 },
    })
  })

  it('turns a typed pound load into kilograms', () => {
    expect(readDraft({ reps: '5', load: '100' }, 'imperial', undefined)).toEqual({
      ok: true,
      values: { reps: 5, weight_kg: 45.36 },
    })
  })

  it('names an empty reps field', () => {
    expect(readDraft({ reps: '', load: '60' }, 'metric', undefined)).toEqual({
      ok: false,
      errors: { reps: 'A set needs at least 1 rep.', load: undefined },
    })
  })

  it('names a load that is not a number', () => {
    const result = readDraft({ reps: '5', load: 'heavy' }, 'metric', undefined)

    expect(result.ok).toBe(false)
    expect(result.ok ? undefined : result.errors.load).toBe('Enter a load in kilograms.')
  })

  it('names reps that are not whole', () => {
    const result = readDraft({ reps: '5.5', load: '' }, 'metric', undefined)

    expect(result.ok ? undefined : result.errors.reps).toBe('Enter a whole number of reps.')
  })
})

describe('ExerciseCard', () => {
  it('names the exercise and its muscle group', () => {
    const { card } = renderCard()

    expect(within(card).getByRole('heading', { level: 2, name: 'Bench Press' })).toBeInTheDocument()
    expect(within(card).getByText('Chest')).toBeInTheDocument()
  })

  it('lists the sets in order and badges the record', () => {
    const { card } = renderCard({
      sets: [set('a', 12, 60), set('b', 8, 75)],
      records: new Set(['b']),
    })

    const rows = within(card).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('60 kg')
    expect(within(rows[1] as HTMLElement).getByText('PR')).toBeInTheDocument()
  })

  it('copies the source set into the fields and adds it on one tap', async () => {
    const { card, onAddSet } = renderCard({ source: set('a', 8, 60), sourceKey: 'a' })

    await userEvent.click(within(card).getByRole('button', { name: 'Add set to Bench Press' }))

    expect(onAddSet).toHaveBeenCalledWith({ reps: 8, weight_kg: 60 })
  })

  it('keeps the typed values when a new source arrives under the same key', async () => {
    const onAddSet = vi.fn()
    const props = {
      exercise: BENCH,
      sets: [],
      records: new Set<string>(),
      unit: 'metric' as const,
      sourceKey: 'bench',
      onAddSet,
      onEditSet: vi.fn(),
      onDeleteSet: vi.fn(),
    }
    const { rerender } = render(<ExerciseCard {...props} source={set('a', 8, 60)} />)
    const card = screen.getByRole('region', { name: 'Bench Press' })

    await userEvent.clear(within(card).getByLabelText('Reps'))
    await userEvent.type(within(card).getByLabelText('Reps'), '10')
    await userEvent.clear(within(card).getByLabelText(/^Load/))
    await userEvent.type(within(card).getByLabelText(/^Load/), '70')
    rerender(<ExerciseCard {...props} source={set('b', 8, 60)} />)

    expect(within(card).getByLabelText('Reps')).toHaveValue('10')
    expect(within(card).getByLabelText(/^Load/)).toHaveValue('70')
    await userEvent.click(within(card).getByRole('button', { name: 'Add set to Bench Press' }))
    expect(onAddSet).toHaveBeenCalledWith({ reps: 10, weight_kg: 70 })
  })

  it('adds the typed values', async () => {
    const { card, onAddSet } = renderCard()

    await userEvent.type(within(card).getByLabelText('Reps'), '10')
    await userEvent.type(within(card).getByLabelText(/^Load/), '50')
    await userEvent.click(within(card).getByRole('button', { name: 'Add set to Bench Press' }))

    expect(onAddSet).toHaveBeenCalledWith({ reps: 10, weight_kg: 50 })
  })

  it('ties the error to the field and adds nothing', async () => {
    const { card, onAddSet } = renderCard()

    await userEvent.click(within(card).getByRole('button', { name: 'Add set to Bench Press' }))

    const reps = within(card).getByLabelText('Reps')
    expect(reps).toHaveAttribute('aria-invalid', 'true')
    expect(reps).toHaveAccessibleDescription('A set needs at least 1 rep.')
    expect(onAddSet).not.toHaveBeenCalled()
  })

  it('refuses a second tap while a set is saving', () => {
    const { card } = renderCard({ busy: true })

    expect(within(card).getByRole('button', { name: 'Add set to Bench Press' })).toBeDisabled()
  })

  it('marks the active card as selected', () => {
    const { card } = renderCard()

    expect(card).toHaveAttribute('data-selected', 'true')
  })

  it('holds the fields back while the last set is read, so typing is never lost', () => {
    const { card } = renderCard({ readingSource: true })

    expect(within(card).getByRole('status')).toHaveTextContent(READING_LAST_SET)
    expect(within(card).queryByLabelText('Reps')).not.toBeInTheDocument()
  })
})

describe('lastTimeText', () => {
  it('names the load, the reps and the estimated one-rep max', () => {
    expect(lastTimeText(set('a', 8, 72.5), 'metric')).toBe(
      'Last time 72.5 kg × 8 · estimated 1RM 92 kg',
    )
  })

  it('gives the load itself as the one-rep max of a single rep', () => {
    expect(lastTimeText(set('a', 1, 100), 'metric')).toBe(
      'Last time 100 kg × 1 · estimated 1RM 100 kg',
    )
  })

  it('shows pounds on an imperial profile', () => {
    expect(lastTimeText(set('a', 5, 60), 'imperial')).toBe(
      'Last time 132.28 lb × 5 · estimated 1RM 154 lb',
    )
  })

  it('names the reps only for a set with no load', () => {
    expect(lastTimeText(set('a', 12, null), 'metric')).toBe('Last time 12 reps')
  })

  it('leaves the one-rep max out when it cannot be estimated', () => {
    expect(lastTimeText(set('a', 0, 50), 'metric')).toBe('Last time 50 kg × 0')
  })
})

describe('ExerciseCard rows and the last time line', () => {
  it('shows the last time line under the sets', () => {
    const { card } = renderCard({ lastTime: 'Last time 72.5 kg × 8 · estimated 1RM 92 kg' })

    expect(within(card).getByText('Last time 72.5 kg × 8 · estimated 1RM 92 kg')).toHaveClass(
      'text-muted',
    )
  })

  it('shows no last time line for an exercise never done before', () => {
    const { card } = renderCard()

    expect(within(card).queryByText(/^Last time/)).not.toBeInTheDocument()
  })

  it('opens a set for editing on a tap of its row, with its position', async () => {
    const first = set('a', 8, 60)
    const second = set('b', 6, 70)
    const { card, onEditSet } = renderCard({ sets: [first, second] })

    await userEvent.click(within(card).getByRole('button', { name: /^Edit set 2/ }))

    expect(onEditSet).toHaveBeenCalledWith(second, 2)
  })

  it('deletes a set on a long press of its row, with its position', () => {
    vi.useFakeTimers()
    const only = set('a', 8, 60)
    const { card, onDeleteSet, onEditSet } = renderCard({ sets: [only] })
    const row = within(card).getByRole('button', { name: /^Edit set 1/ })

    fireEvent.pointerDown(row, { clientX: 100, clientY: 10 })
    act(() => {
      vi.advanceTimersByTime(HOLD_MS)
    })
    fireEvent.pointerUp(row)
    fireEvent.click(row)
    vi.useRealTimers()

    expect(onDeleteSet).toHaveBeenCalledWith(only, 1)
    expect(onEditSet).not.toHaveBeenCalled()
  })
})
