import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import {
  agoShort,
  agoSpoken,
  CREATE_TITLE,
  daysBetween,
  ExercisePicker,
  formatLoad,
  PICK_TITLE,
  READ_FAILED,
  RECENT_LIMIT,
  REPOSITORY_SOURCE,
} from './ExercisePicker'

import type { ExerciseSource } from './ExercisePicker'
import type { Exercise, WorkoutSet } from '../../lib/db/dexie'
import type { ExerciseFilter } from '../../lib/db/repository'
import type { ExerciseInput } from '../../lib/schema/exercise'

const NOW = new Date(2026, 8, 20, 18, 0, 0)

function exercise(id: number, name: string, muscle_group: Exercise['muscle_group']): Exercise {
  return {
    id: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    name,
    muscle_group,
    is_archived: false,
    user_id: null,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    deleted_at: null,
  }
}

const BENCH = exercise(1, 'Bench Press', 'chest')
const PULLDOWN = exercise(2, 'Lat Pulldown', 'back')
const SQUAT = exercise(3, 'Back Squat', 'legs')
const FLY = exercise(4, 'Cable Fly', 'chest')

const CATALOGUE = [SQUAT, BENCH, FLY, PULLDOWN]

function lastSet(
  of: Exercise,
  when: Date,
  weight_kg: number | null,
  reps: number,
  completed = true,
): WorkoutSet {
  return {
    id: `10000000-0000-4000-8000-${of.id.slice(-12)}`,
    session_id: '20000000-0000-4000-8000-000000000001',
    exercise_id: of.id,
    set_index: 0,
    reps,
    weight_kg,
    rpe: null,
    completed_at: completed ? when.toISOString() : null,
    created_at: when.toISOString(),
    updated_at: when.toISOString(),
    deleted_at: null,
  }
}

const LAST_SETS = new Map<string, WorkoutSet>([
  [BENCH.id, lastSet(BENCH, new Date(2026, 8, 18, 18, 0), 75, 8)],
  [PULLDOWN.id, lastSet(PULLDOWN, new Date(2026, 8, 16, 18, 0), 60, 10)],
])

function matches(row: Exercise, filter: ExerciseFilter): boolean {
  const query = (filter.query ?? '').toLowerCase()
  const group = filter.muscleGroup === undefined || row.muscle_group === filter.muscleGroup
  return group && row.name.toLowerCase().includes(query)
}

function fakeSource(rows: Exercise[] = CATALOGUE, sets = LAST_SETS) {
  const created: Exercise[] = []
  const source = {
    listExercises: vi.fn((filter: ExerciseFilter) =>
      Promise.resolve(
        [...rows, ...created]
          .filter((row) => matches(row, filter))
          .sort((a, b) => a.name.localeCompare(b.name)),
      ),
    ),
    lastSetsFor: vi.fn((ids: string[]) =>
      Promise.resolve(
        new Map(
          ids.flatMap((id) => {
            const set = sets.get(id)
            return set === undefined ? [] : [[id, set] as const]
          }),
        ),
      ),
    ),
    createExercise: vi.fn((input: ExerciseInput) => {
      const row: Exercise = {
        ...exercise(99, input.name, input.muscle_group),
        user_id: 'local',
      }
      created.push(row)
      return Promise.resolve(row)
    }),
  } satisfies ExerciseSource
  return source
}

function Host({ source, onPick }: { source: ExerciseSource; onPick: (row: Exercise) => void }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
        }}
      >
        Add an exercise
      </button>
      <ExercisePicker
        open={open}
        onClose={() => {
          setOpen(false)
        }}
        onPick={onPick}
        now={() => NOW}
        source={source}
      />
    </>
  )
}

function setup(source: ExerciseSource = fakeSource()) {
  const onPick = vi.fn()
  render(<Host source={source} onPick={onPick} />)
  return { onPick, source }
}

function allList() {
  return screen.getByRole('region', { name: 'All exercises' })
}

describe('ExercisePicker', () => {
  it('renders nothing while closed', () => {
    render(<ExercisePicker open={false} onClose={vi.fn()} onPick={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('reads from the repository by default', () => {
    expect(REPOSITORY_SOURCE.listExercises).toBeTypeOf('function')
    expect(REPOSITORY_SOURCE.lastSetsFor).toBeTypeOf('function')
    expect(REPOSITORY_SOURCE.createExercise).toBeTypeOf('function')
  })

  it('opens as a dialog named by its title with the search field', async () => {
    setup()
    expect(screen.getByRole('dialog', { name: PICK_TITLE })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search exercises' })).toBeInTheDocument()
    expect(
      await within(await screen.findByRole('region', { name: 'All exercises' })).findAllByRole(
        'button',
      ),
    ).toHaveLength(4)
  })

  it('narrows the list as the search changes', async () => {
    const { source } = setup()
    await screen.findByRole('region', { name: 'All exercises' })

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search exercises' }), 'bench')

    const matchesList = await screen.findByRole('region', { name: 'Matches' })
    expect(within(matchesList).getAllByRole('button')).toHaveLength(1)
    expect(within(matchesList).getByRole('button', { name: /Bench Press/ })).toBeInTheDocument()
    expect(source.listExercises).toHaveBeenLastCalledWith({ query: 'bench' })
  })

  it('hides the recent list while a search is typed', async () => {
    setup()
    await screen.findByRole('region', { name: 'Recent' })

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search exercises' }), 'b')

    await screen.findByRole('region', { name: 'Matches' })
    expect(screen.queryByRole('region', { name: 'Recent' })).not.toBeInTheDocument()
  })

  it('shows the create option and a message for an empty result', async () => {
    setup()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search exercises' }), 'zercher')

    expect(await screen.findByRole('status')).toHaveTextContent('No exercise matches “zercher”.')
    expect(screen.queryByRole('region', { name: 'Matches' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create a new exercise' })).toBeInTheDocument()
  })

  it('says so when the device holds no exercise yet', async () => {
    setup(fakeSource([], new Map()))
    expect(await screen.findByRole('status')).toHaveTextContent('No exercises on this device yet.')
  })

  it('shows an alert when the exercises cannot be read', async () => {
    const source = fakeSource()
    source.listExercises.mockRejectedValue(new Error('Dexie is closed.'))
    setup(source)
    expect(await screen.findByRole('alert')).toHaveTextContent(READ_FAILED)
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('filters by the muscle group chip', async () => {
    const { source } = setup()
    await screen.findByRole('region', { name: 'All exercises' })
    const chips = screen.getByRole('group', { name: 'Muscle group' })

    await userEvent.click(within(chips).getByRole('button', { name: 'Chest' }))

    expect(within(chips).getByRole('button', { name: 'Chest' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(chips).getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await waitFor(() => {
      expect(within(allList()).getAllByRole('button')).toHaveLength(2)
    })
    expect(source.listExercises).toHaveBeenLastCalledWith({ query: '', muscleGroup: 'chest' })
  })

  it('clears the filter with the All chip', async () => {
    const { source } = setup()
    const chips = screen.getByRole('group', { name: 'Muscle group' })
    await userEvent.click(within(chips).getByRole('button', { name: 'Legs' }))
    await waitFor(() => {
      expect(within(allList()).getAllByRole('button')).toHaveLength(1)
    })

    await userEvent.click(within(chips).getByRole('button', { name: 'All' }))

    await waitFor(() => {
      expect(within(allList()).getAllByRole('button')).toHaveLength(4)
    })
    expect(within(chips).getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(source.listExercises).toHaveBeenLastCalledWith({ query: '' })
  })

  it('lists recent exercises newest first with the last load, reps and age', async () => {
    setup()
    const recent = await screen.findByRole('region', { name: 'Recent' })
    const rows = within(recent).getAllByRole('button')

    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('Bench Press')
    expect(rows[0]).toHaveTextContent('Chest · 75 kg × 8')
    expect(rows[0]).toHaveAccessibleName(/2 days ago/)
    expect(rows[1]).toHaveTextContent('Back · 60 kg × 10')
    expect(rows[1]).toHaveTextContent('4d')
  })

  it('shows the recent load in pounds when the profile is imperial', async () => {
    render(
      <ExercisePicker
        open
        onClose={vi.fn()}
        onPick={vi.fn()}
        unitSystem="imperial"
        now={() => NOW}
        source={fakeSource()}
      />,
    )
    const recent = await screen.findByRole('region', { name: 'Recent' })
    expect(within(recent).getAllByRole('button')[0]).toHaveTextContent('165.35 lb × 8')
  })

  it('keeps the recent list to the limit', async () => {
    const many = Array.from({ length: RECENT_LIMIT + 2 }, (_, at) =>
      exercise(at + 10, `Move ${String(at)}`, 'arms'),
    )
    const sets = new Map(
      many.map((row, at) => [row.id, lastSet(row, new Date(2026, 8, 10 + at), 10, 10)] as const),
    )
    setup(fakeSource(many, sets))
    const recent = await screen.findByRole('region', { name: 'Recent' })
    const rows = within(recent).getAllByRole('button')
    expect(rows).toHaveLength(RECENT_LIMIT)
    expect(rows[0]).toHaveTextContent(`Move ${String(RECENT_LIMIT + 1)}`)
  })

  it('calls the handler once and closes the sheet on a pick', async () => {
    const { onPick } = setup()
    const row = await within(
      await screen.findByRole('region', { name: 'All exercises' }),
    ).findByRole('button', { name: /Cable Fly/ })

    await userEvent.click(row)

    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick).toHaveBeenCalledWith(FLY)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('picks from the recent list', async () => {
    const { onPick } = setup()
    const recent = await screen.findByRole('region', { name: 'Recent' })

    await userEvent.click(within(recent).getAllByRole('button')[0] as HTMLElement)

    expect(onPick).toHaveBeenCalledWith(BENCH)
  })

  it('closes on Escape without a pick', async () => {
    const { onPick } = setup()
    await screen.findByRole('region', { name: 'All exercises' })

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onPick).not.toHaveBeenCalled()
  })

  it('traps focus inside the sheet', async () => {
    setup()
    await screen.findByRole('region', { name: 'All exercises' })
    const dialog = screen.getByRole('dialog')

    for (let step = 0; step < 20; step += 1) {
      await userEvent.tab()
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    }
  })

  it('opens the create form with the search text as the name', async () => {
    setup()
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search exercises' }),
      'Zercher squat',
    )
    await screen.findByRole('status')

    await userEvent.click(screen.getByRole('button', { name: 'Create a new exercise' }))

    expect(screen.getByRole('dialog', { name: CREATE_TITLE })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Zercher squat')
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus()
  })

  it('carries the chosen chip into the create form', async () => {
    setup()
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Muscle group' })).getByRole('button', {
        name: 'Back',
      }),
    )

    await userEvent.click(screen.getByRole('button', { name: 'Create a new exercise' }))

    expect(screen.getByRole('button', { name: 'Back' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('creates the exercise and then picks it', async () => {
    const { onPick, source } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Create a new exercise' }))

    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Hack Squat')
    await userEvent.click(screen.getByRole('button', { name: 'Legs' }))
    await userEvent.click(screen.getByRole('button', { name: 'Create and pick' }))

    await waitFor(() => {
      expect(onPick).toHaveBeenCalledTimes(1)
    })
    expect(source.createExercise).toHaveBeenCalledWith({
      name: 'Hack Squat',
      muscle_group: 'legs',
      is_archived: false,
    })
    expect(onPick.mock.calls[0]?.[0]).toMatchObject({ name: 'Hack Squat', muscle_group: 'legs' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('goes back to the list and focuses the create button', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Create a new exercise' }))

    await userEvent.click(screen.getByRole('button', { name: 'Back to the list' }))

    expect(screen.getByRole('dialog', { name: PICK_TITLE })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create a new exercise' })).toHaveFocus()
  })

  it('returns focus to the opener when it closes', async () => {
    const source = fakeSource()
    const onPick = vi.fn()
    function Closed() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setOpen(true)
            }}
          >
            Add an exercise
          </button>
          <ExercisePicker
            open={open}
            onClose={() => {
              setOpen(false)
            }}
            onPick={onPick}
            source={source}
          />
        </>
      )
    }
    render(<Closed />)
    const opener = screen.getByRole('button', { name: 'Add an exercise' })

    await userEvent.click(opener)
    await userEvent.keyboard('{Escape}')

    expect(opener).toHaveFocus()
  })

  it('locks the page scroll while it is open', async () => {
    setup()
    expect(document.body.style.overflow).toBe('hidden')
    await userEvent.keyboard('{Escape}')
    expect(document.body.style.overflow).toBe('')
  })

  it('ignores a slow answer for an old search', async () => {
    const source = fakeSource()
    const release: Array<() => void> = []
    const list = source.listExercises.getMockImplementation()
    source.listExercises.mockImplementation((filter: ExerciseFilter) => {
      if (filter.query === 'b') {
        return new Promise<Exercise[]>((resolve) => {
          release.push(() => {
            resolve([SQUAT])
          })
        })
      }
      return list?.(filter) ?? Promise.resolve([])
    })
    setup(source)
    const search = screen.getByRole('searchbox', { name: 'Search exercises' })

    await userEvent.type(search, 'be')
    await screen.findByRole('region', { name: 'Matches' })
    release.forEach((resolve) => {
      resolve()
    })

    await waitFor(() => {
      const found = within(screen.getByRole('region', { name: 'Matches' })).getAllByRole('button')
      expect(found.map((row) => row.textContent)).toEqual([expect.stringContaining('Bench Press')])
    })
  })

  it('rejects a slow failure for an old search', async () => {
    const source = fakeSource()
    const reject: Array<() => void> = []
    const list = source.listExercises.getMockImplementation()
    source.listExercises.mockImplementation((filter: ExerciseFilter) => {
      if (filter.query === 'b') {
        return new Promise<Exercise[]>((_, fail) => {
          reject.push(() => {
            fail(new Error('late'))
          })
        })
      }
      return list?.(filter) ?? Promise.resolve([])
    })
    setup(source)

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search exercises' }), 'be')
    await screen.findByRole('region', { name: 'Matches' })
    reject.forEach((fail) => {
      fail()
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('daysBetween', () => {
  it('returns 0 for a time earlier the same day', () => {
    expect(daysBetween(new Date(2026, 8, 20, 6), NOW)).toBe(0)
  })

  it('counts calendar days, not 24 hour spans', () => {
    expect(daysBetween(new Date(2026, 8, 19, 23, 59), new Date(2026, 8, 20, 0, 1))).toBe(1)
  })

  it('never returns a negative age for a clock ahead of now', () => {
    expect(daysBetween(new Date(2026, 8, 22), NOW)).toBe(0)
  })
})

describe('agoShort and agoSpoken', () => {
  it('reads Today for 0 days', () => {
    expect(agoShort(0)).toBe('Today')
    expect(agoSpoken(0)).toBe('today')
  })

  it('reads 1d and 1 day ago for one day', () => {
    expect(agoShort(1)).toBe('1d')
    expect(agoSpoken(1)).toBe('1 day ago')
  })

  it('reads 5d and 5 days ago for five days', () => {
    expect(agoShort(5)).toBe('5d')
    expect(agoSpoken(5)).toBe('5 days ago')
  })
})

describe('formatLoad', () => {
  it('shows the load and the reps in kilograms', () => {
    expect(formatLoad(lastSet(BENCH, NOW, 72.5, 8), 'metric')).toBe('72.5 kg × 8')
  })

  it('shows reps alone for a set with no load', () => {
    expect(formatLoad(lastSet(BENCH, NOW, null, 12), 'metric')).toBe('12 reps')
  })

  it('uses the creation time when a set has no completion time', async () => {
    const sets = new Map([[BENCH.id, lastSet(BENCH, new Date(2026, 8, 17), 50, 5, false)]])
    setup(fakeSource([BENCH], sets))
    const recent = await screen.findByRole('region', { name: 'Recent' })
    expect(within(recent).getByRole('button')).toHaveTextContent('3d')
  })
})

describe('ExercisePicker layout', () => {
  it('pins the create button in the sheet footer, outside the scrolling list', async () => {
    setup()
    await screen.findByRole('region', { name: 'All exercises' })
    const footer = screen.getByTestId('sheet-footer')
    const body = screen.getByTestId('sheet-body')
    expect(footer).toContainElement(screen.getByRole('button', { name: 'Create a new exercise' }))
    expect(body).toContainElement(screen.getByRole('region', { name: 'All exercises' }))
  })

  it('reads the last sets once for the whole list', async () => {
    const { source } = setup()
    await screen.findByRole('region', { name: 'Recent' })
    expect(source.lastSetsFor).toHaveBeenCalledTimes(1)
    expect(source.lastSetsFor).toHaveBeenCalledWith(
      CATALOGUE.map((row) => row.id).sort((a, b) => {
        const name = (id: string) => CATALOGUE.find((row) => row.id === id)?.name ?? ''
        return name(a).localeCompare(name(b))
      }),
    )
  })

  it('pins the create form actions in the footer and submits the form from there', async () => {
    const { onPick } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Create a new exercise' }))
    const footer = screen.getByTestId('sheet-footer')
    expect(footer).toContainElement(screen.getByRole('button', { name: 'Create and pick' }))
    expect(footer).toContainElement(screen.getByRole('button', { name: 'Back to the list' }))

    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Hack Squat{Enter}')
    await userEvent.click(screen.getByRole('button', { name: 'Legs' }))
    await userEvent.click(screen.getByRole('button', { name: 'Create and pick' }))

    await waitFor(() => {
      expect(onPick).toHaveBeenCalledTimes(1)
    })
  })
})
