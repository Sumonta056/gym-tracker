import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../../lib/db/dexie'
import {
  addSet,
  archiveExercise,
  createExercise,
  getActiveSession,
  listSets,
  SignedOutOnThisDevice,
  startSession,
} from '../../lib/db/repository'

import { READING_LAST_SET } from './ExerciseCard'
import { PICK_TITLE } from './ExercisePicker'
import {
  earlierThan,
  exerciseOrder,
  FINISH_FAILED,
  goToWorkouts,
  heroFooter,
  lastOf,
  LiveSession,
  READ_FAILED,
  recordIds,
  REPOSITORY_LIVE_SOURCE,
  SAVE_FAILED,
  startedText,
  volumeText,
  WORKOUTS_PATH,
} from './LiveSession'

import type { LiveSessionSource } from './LiveSession'
import type { Exercise, WorkoutSession, WorkoutSet } from '../../lib/db/dexie'

vi.mock('../sync/SyncChip', () => ({
  SyncChip: () => <span>Synced</span>,
}))

vi.mock('../../lib/supabase/client', () => ({
  createClient: () => {
    throw new Error('no network in a component test')
  },
}))

const BENCH_ID = '33333333-3333-4333-8333-333333333333'
const SQUAT_ID = '44444444-4444-4444-8444-444444444444'

function globalExercise(
  id: string,
  name: string,
  muscle_group: Exercise['muscle_group'],
): Exercise {
  return {
    id,
    user_id: null,
    name,
    muscle_group,
    is_archived: false,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    deleted_at: null,
  }
}

function pastSet(overrides: Partial<WorkoutSet>): WorkoutSet {
  return {
    id: crypto.randomUUID(),
    session_id: crypto.randomUUID(),
    exercise_id: BENCH_ID,
    set_index: 0,
    reps: 5,
    weight_kg: 100,
    rpe: null,
    completed_at: '2026-09-01T10:00:00.000Z',
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    deleted_at: null,
    ...overrides,
  }
}

beforeEach(async () => {
  await db.open()
  await Promise.all([
    db.exercises.clear(),
    db.workoutSessions.clear(),
    db.workoutSets.clear(),
    db.outbox.clear(),
    db.syncMeta.clear(),
    db.profiles.clear(),
  ])
  await db.exercises.bulkPut([
    globalExercise(BENCH_ID, 'Bench Press', 'chest'),
    globalExercise(SQUAT_ID, 'Back Squat', 'legs'),
  ])
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function renderLive(props: Parameters<typeof LiveSession>[0] = {}) {
  const onFinished = vi.fn()
  const view = render(<LiveSession onFinished={onFinished} {...props} />)
  await screen.findByRole('heading', { level: 1, name: 'Session' })
  return { ...view, onFinished }
}

function card(name: string) {
  return screen.getByRole('region', { name })
}

function summary() {
  return screen.getByTestId('session-summary')
}

async function pickExercise(name: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Add exercise' }))
  const dialog = await screen.findByRole('dialog', { name: PICK_TITLE })
  const row = await within(dialog).findAllByRole('button', { name: new RegExp(`^${name}`) })
  await userEvent.click(row[0] as HTMLElement)
  await screen.findByRole('region', { name })
}

async function addSetTo(name: string) {
  const before = (await listSets((await getActiveSession())?.id ?? '')).length
  await userEvent.click(within(card(name)).getByRole('button', { name: `Add set to ${name}` }))
  await waitFor(async () => {
    expect((await listSets((await getActiveSession())?.id ?? '')).length).toBe(before + 1)
  })
}

describe('LiveSession acceptance', () => {
  it('copies the previous reps and load when Add set is tapped', async () => {
    const session = await startSession('2026-09-01')
    await addSet({ session_id: session.id, exercise_id: BENCH_ID, reps: 8, weight_kg: 60 })
    await renderLive()

    const bench = card('Bench Press')
    expect(within(bench).getByLabelText('Reps')).toHaveValue('8')
    expect(within(bench).getByLabelText(/^Load/)).toHaveValue('60')

    await addSetTo('Bench Press')

    const sets = await listSets(session.id)
    expect(sets.map((set) => [set.reps, set.weight_kg])).toEqual([
      [8, 60],
      [8, 60],
    ])
    await waitFor(() => {
      expect(within(card('Bench Press')).getAllByRole('listitem')).toHaveLength(2)
    })
  })

  it('changes the volume total when a set is added', async () => {
    const session = await startSession('2026-09-01')
    await addSet({ session_id: session.id, exercise_id: BENCH_ID, reps: 8, weight_kg: 60 })
    await renderLive()

    expect(summary()).toHaveTextContent('Volume 480 kg · 1 set · 1 exercise')

    await addSetTo('Bench Press')

    await waitFor(() => {
      expect(summary()).toHaveTextContent('Volume 960 kg · 2 sets · 1 exercise')
    })
  })

  it('shows the PR badge on a heavier set and not on an equal one', async () => {
    await db.workoutSets.put(pastSet({ weight_kg: 100, reps: 5 }))
    await startSession('2026-09-02')
    await renderLive()
    await pickExercise('Bench Press')

    await waitFor(() => {
      expect(within(card('Bench Press')).getByLabelText(/^Load/)).toHaveValue('100')
    })
    await addSetTo('Bench Press')
    await waitFor(() => {
      expect(within(card('Bench Press')).getAllByRole('listitem')).toHaveLength(1)
    })
    expect(within(card('Bench Press')).queryByText('PR')).not.toBeInTheDocument()

    const load = within(card('Bench Press')).getByLabelText(/^Load/)
    await userEvent.clear(load)
    await userEvent.type(load, '102.5')
    await addSetTo('Bench Press')

    await waitFor(() => {
      expect(within(card('Bench Press')).getAllByRole('listitem')).toHaveLength(2)
    })
    const rows = within(card('Bench Press')).getAllByRole('listitem')
    expect(within(rows[0] as HTMLElement).queryByText('PR')).not.toBeInTheDocument()
    expect(within(rows[1] as HTMLElement).getByText('PR')).toBeInTheDocument()
  })

  it('shows no PR badge on the first set of an exercise', async () => {
    const session = await startSession('2026-09-01')
    await addSet({ session_id: session.id, exercise_id: BENCH_ID, reps: 8, weight_kg: 60 })
    await renderLive()

    await waitFor(() => {
      expect(within(card('Bench Press')).getAllByRole('listitem')).toHaveLength(1)
    })
    expect(within(card('Bench Press')).queryByText('PR')).not.toBeInTheDocument()
  })
})

function heldReadBack() {
  let calls = 0
  let release: () => void = () => undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const source: LiveSessionSource = {
    ...REPOSITORY_LIVE_SOURCE,
    listSets: async (sessionId) => {
      calls += 1
      if (calls > 1) {
        await gate
      }
      return listSets(sessionId)
    },
  }
  return { source, release }
}

async function typeWhileTheSetIsReadBack(field: 'Reps' | 'Load', value: string) {
  const session = await startSession('2026-09-01')
  await addSet({ session_id: session.id, exercise_id: BENCH_ID, reps: 8, weight_kg: 60 })
  const { source, release } = heldReadBack()
  await renderLive({ source })

  await userEvent.click(
    within(card('Bench Press')).getByRole('button', { name: 'Add set to Bench Press' }),
  )
  await waitFor(async () => {
    expect(await listSets(session.id)).toHaveLength(2)
  })

  const input = within(card('Bench Press')).getByLabelText(field === 'Reps' ? 'Reps' : /^Load/)
  await userEvent.clear(input)
  await userEvent.type(input, value)

  await act(async () => {
    release()
    await Promise.resolve()
  })
  await waitFor(() => {
    expect(within(card('Bench Press')).getAllByRole('listitem')).toHaveLength(2)
  })
  await waitFor(() => {
    expect(
      within(card('Bench Press')).getByRole('button', { name: 'Add set to Bench Press' }),
    ).toBeEnabled()
  })

  return session
}

describe('typing while an added set is read back', () => {
  it('keeps a load typed before the read back ends, and logs it on the next set', async () => {
    const session = await typeWhileTheSetIsReadBack('Load', '70')

    expect(within(card('Bench Press')).getByLabelText(/^Load/)).toHaveValue('70')

    await addSetTo('Bench Press')
    expect((await listSets(session.id)).map((set) => [set.reps, set.weight_kg])).toEqual([
      [8, 60],
      [8, 60],
      [8, 70],
    ])
    await waitFor(() => {
      expect(within(card('Bench Press')).getAllByRole('listitem')).toHaveLength(3)
    })
  })

  it('keeps reps typed before the read back ends, and logs them on the next set', async () => {
    const session = await typeWhileTheSetIsReadBack('Reps', '10')

    expect(within(card('Bench Press')).getByLabelText('Reps')).toHaveValue('10')

    await addSetTo('Bench Press')
    expect((await listSets(session.id)).map((set) => [set.reps, set.weight_kg])).toEqual([
      [8, 60],
      [8, 60],
      [10, 60],
    ])
    await waitFor(() => {
      expect(within(card('Bench Press')).getAllByRole('listitem')).toHaveLength(3)
    })
  })
})

describe('the session timer on the live screen', () => {
  it('reads from started_at after a remount', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date('2026-09-01T17:30:00.000Z'))
    const session = await startSession('2026-09-01')
    expect(session.started_at).toBe('2026-09-01T17:30:00.000Z')

    vi.setSystemTime(new Date('2026-09-01T18:12:17.000Z'))
    const first = await renderLive()
    const timer = screen.getByRole('timer', { name: 'Elapsed time' })
    expect(timer).toHaveTextContent('42:17')

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(timer).toHaveTextContent('42:20')

    first.unmount()
    vi.setSystemTime(new Date('2026-09-01T18:40:05.000Z'))
    await renderLive()

    expect(screen.getByRole('timer', { name: 'Elapsed time' })).toHaveTextContent('1:10:05')
  })
})

describe('LiveSession', () => {
  it('finishes the session and hands back to the caller', async () => {
    const session = await startSession('2026-09-01')
    const { onFinished } = await renderLive()

    await userEvent.click(screen.getByRole('button', { name: 'Finish session' }))

    await waitFor(() => {
      expect(onFinished).toHaveBeenCalledTimes(1)
    })
    expect((await db.workoutSessions.get(session.id))?.status).toBe('finished')
  })

  it('returns to the workouts screen after Finish by default', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { assign })
    await startSession('2026-09-01')
    render(<LiveSession />)

    await userEvent.click(await screen.findByRole('button', { name: 'Finish session' }))

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith(WORKOUTS_PATH)
    })
  })

  it('still names a set of an archived exercise', async () => {
    const fly = await createExercise({
      name: 'Cable Fly',
      muscle_group: 'chest',
      is_archived: false,
    })
    const session = await startSession('2026-09-01')
    await addSet({ session_id: session.id, exercise_id: fly.id, reps: 12, weight_kg: 20 })
    await archiveExercise(fly.id)

    await renderLive()

    expect(await screen.findByRole('heading', { level: 2, name: 'Cable Fly' })).toBeInTheDocument()
  })

  it('copies the last set of an earlier session for the first set of an exercise', async () => {
    await db.workoutSets.put(pastSet({ exercise_id: SQUAT_ID, reps: 6, weight_kg: 90 }))
    const session = await startSession('2026-09-02')
    await renderLive()

    await pickExercise('Back Squat')
    await waitFor(() => {
      expect(within(card('Back Squat')).getByLabelText('Reps')).toHaveValue('6')
    })
    await addSetTo('Back Squat')

    const [set] = await listSets(session.id)
    expect([set?.reps, set?.weight_kg]).toEqual([6, 90])
  })

  it('shows the fields only once the last set of the exercise is read', async () => {
    let release: (set: WorkoutSet | undefined) => void = () => undefined
    const source: LiveSessionSource = {
      ...REPOSITORY_LIVE_SOURCE,
      lastSetFor: () =>
        new Promise((resolve) => {
          release = resolve
        }),
    }
    await startSession('2026-09-02')
    await renderLive({ source })
    await pickExercise('Back Squat')

    expect(within(card('Back Squat')).getByRole('status')).toHaveTextContent(READING_LAST_SET)
    expect(within(card('Back Squat')).queryByLabelText('Reps')).not.toBeInTheDocument()

    act(() => {
      release(pastSet({ exercise_id: SQUAT_ID, reps: 4, weight_kg: 110 }))
    })

    expect(await within(card('Back Squat')).findByLabelText('Reps')).toHaveValue('4')
  })

  it('treats a failed read of the last set as no last set', async () => {
    const source: LiveSessionSource = {
      ...REPOSITORY_LIVE_SOURCE,
      lastSetFor: () => Promise.reject(new Error('broken')),
    }
    await startSession('2026-09-02')
    await renderLive({ source })
    await pickExercise('Back Squat')

    expect(await within(card('Back Squat')).findByLabelText('Reps')).toHaveValue('')
  })

  it('leaves the fields empty for an exercise never done before', async () => {
    await startSession('2026-09-02')
    await renderLive()

    await pickExercise('Back Squat')

    await waitFor(() => {
      expect(within(card('Back Squat')).getByLabelText('Reps')).toHaveValue('')
    })
    expect(within(card('Back Squat')).getByText(/No sets yet/)).toBeInTheDocument()
  })

  it('names the reps problem and saves nothing on an empty reps field', async () => {
    const session = await startSession('2026-09-02')
    await renderLive()
    await pickExercise('Back Squat')

    await userEvent.click(screen.getByRole('button', { name: 'Add set to Back Squat' }))

    expect(await screen.findByText('A set needs at least 1 rep.')).toBeInTheDocument()
    expect(await listSets(session.id)).toEqual([])
  })

  it('lists the other exercises and opens one on a tap', async () => {
    const session = await startSession('2026-09-01')
    await addSet({
      session_id: session.id,
      exercise_id: SQUAT_ID,
      reps: 5,
      weight_kg: 100,
      completed_at: '2026-09-01T10:00:00.000Z',
    })
    await addSet({
      session_id: session.id,
      exercise_id: BENCH_ID,
      reps: 8,
      weight_kg: 60,
      completed_at: '2026-09-01T10:05:00.000Z',
    })
    await renderLive()

    expect(card('Bench Press')).toBeInTheDocument()
    const other = screen.getByRole('button', { name: /Back Squat/ })
    expect(other).toHaveTextContent('1 set · 500 kg')

    await userEvent.click(other)

    expect(await screen.findByRole('region', { name: 'Back Squat' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bench Press/ })).toHaveTextContent('1 set · 480 kg')
  })

  it('shows the start time of the session', async () => {
    const session = await startSession('2026-09-01')
    await renderLive()

    expect(screen.getByText(`Started ${startedText(session.started_at)}`)).toBeInTheDocument()
  })

  it('says no session is running and links back to Workouts', async () => {
    render(<LiveSession />)

    expect(await screen.findByText('No session is running on this device.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Workouts' })).toHaveAttribute(
      'href',
      WORKOUTS_PATH,
    )
  })

  it('says so when the session cannot be read', async () => {
    const source: LiveSessionSource = {
      ...REPOSITORY_LIVE_SOURCE,
      getActiveSession: () => Promise.reject(new Error('broken')),
    }
    render(<LiveSession source={source} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(READ_FAILED)
  })

  it('says so when a set cannot be saved', async () => {
    const session = await startSession('2026-09-01')
    await addSet({ session_id: session.id, exercise_id: BENCH_ID, reps: 8, weight_kg: 60 })
    const source: LiveSessionSource = {
      ...REPOSITORY_LIVE_SOURCE,
      addSet: () => Promise.reject(new Error('disk full')),
    }
    await renderLive({ source })

    await userEvent.click(screen.getByRole('button', { name: 'Add set to Bench Press' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(SAVE_FAILED)
  })

  it('names a signed-out device when a set is refused', async () => {
    const session = await startSession('2026-09-01')
    await addSet({ session_id: session.id, exercise_id: BENCH_ID, reps: 8, weight_kg: 60 })
    const source: LiveSessionSource = {
      ...REPOSITORY_LIVE_SOURCE,
      addSet: () => Promise.reject(new SignedOutOnThisDevice()),
    }
    await renderLive({ source })

    await userEvent.click(screen.getByRole('button', { name: 'Add set to Bench Press' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(new SignedOutOnThisDevice().message)
  })

  it('says so when the session cannot be finished, and stays', async () => {
    await startSession('2026-09-01')
    const source: LiveSessionSource = {
      ...REPOSITORY_LIVE_SOURCE,
      finishSession: () => Promise.reject(new Error('disk full')),
    }
    const { onFinished } = await renderLive({ source })

    await userEvent.click(screen.getByRole('button', { name: 'Finish session' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(FINISH_FAILED)
    expect(onFinished).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Finish session' })).toBeEnabled()
  })

  it('asks for an exercise before the first set', async () => {
    await startSession('2026-09-01')
    await renderLive()

    expect(screen.getByText('Add an exercise to log your first set.')).toBeInTheDocument()
    expect(summary()).toHaveTextContent('Volume 0 kg · 0 sets · 0 exercises')
  })

  it('shows the volume in pounds on an imperial profile', async () => {
    const session = await startSession('2026-09-01')
    await addSet({ session_id: session.id, exercise_id: BENCH_ID, reps: 10, weight_kg: 100 })
    const source: LiveSessionSource = {
      ...REPOSITORY_LIVE_SOURCE,
      readUnit: () => Promise.resolve('imperial'),
    }
    await renderLive({ source })

    expect(summary()).toHaveTextContent('Volume 2,205 lb')
  })

  it('reads the unit from the profile', async () => {
    expect(await REPOSITORY_LIVE_SOURCE.readUnit()).toBe('metric')
  })
})

function liveSet(overrides: Partial<WorkoutSet>): WorkoutSet {
  return pastSet({ session_id: 'live', ...overrides })
}

describe('earlierThan', () => {
  it('orders by the completion time first', () => {
    const first = liveSet({
      completed_at: '2026-09-01T10:00:00.000Z',
      created_at: '2026-09-01T12:00:00.000Z',
    })
    const second = liveSet({
      completed_at: '2026-09-01T11:00:00.000Z',
      created_at: '2026-09-01T09:00:00.000Z',
    })

    expect(earlierThan(first, second)).toBe(true)
    expect(earlierThan(second, first)).toBe(false)
  })

  it('reads created_at when a set has no completion time', () => {
    const first = liveSet({ completed_at: null, created_at: '2026-09-01T09:00:00.000Z' })
    const second = liveSet({ completed_at: '2026-09-01T10:00:00.000Z' })

    expect(earlierThan(first, second)).toBe(true)
  })

  it('breaks a tie by set_index, then by id', () => {
    const low = liveSet({ id: 'b', set_index: 0 })
    const high = liveSet({ id: 'a', set_index: 1 })
    const twin = liveSet({ id: 'c', set_index: 0 })

    expect(earlierThan(low, high)).toBe(true)
    expect(earlierThan(low, twin)).toBe(true)
    expect(earlierThan(low, low)).toBe(false)
  })
})

describe('recordIds', () => {
  it('compares each set with the sets before it only', () => {
    const lighter = liveSet({ id: 'a', weight_kg: 60, completed_at: '2026-09-01T10:00:00.000Z' })
    const heavier = liveSet({ id: 'b', weight_kg: 70, completed_at: '2026-09-01T10:05:00.000Z' })

    expect(recordIds([lighter, heavier], [lighter, heavier])).toEqual(new Set(['b']))
  })

  it('marks no first set of an exercise', () => {
    const first = liveSet({ id: 'a', weight_kg: 60, completed_at: '2026-09-01T10:00:00.000Z' })

    expect(recordIds([first], [first])).toEqual(new Set())
  })

  it('marks no set that only equals an earlier one', () => {
    const earlier = liveSet({ id: 'a', weight_kg: 60, completed_at: '2026-09-01T10:00:00.000Z' })
    const equal = liveSet({ id: 'b', weight_kg: 60, completed_at: '2026-09-01T10:05:00.000Z' })

    expect(recordIds([equal], [earlier, equal])).toEqual(new Set())
  })
})

describe('exerciseOrder', () => {
  it('keeps the order of first use, then the picked exercises', () => {
    const sets = [
      liveSet({ exercise_id: 'x' }),
      liveSet({ exercise_id: 'y' }),
      liveSet({ exercise_id: 'x' }),
    ]

    expect(exerciseOrder(sets, ['z', 'y'])).toEqual(['x', 'y', 'z'])
  })
})

describe('lastOf', () => {
  it('returns undefined for no sets', () => {
    expect(lastOf([])).toBeUndefined()
  })

  it('returns the set done last', () => {
    const later = liveSet({ completed_at: '2026-09-01T11:00:00.000Z' })

    expect(lastOf([later, liveSet({})])).toBe(later)
  })
})

describe('volumeText and heroFooter', () => {
  const sets = [
    liveSet({ reps: 10, weight_kg: 100 }),
    liveSet({ reps: 12, weight_kg: 60, exercise_id: SQUAT_ID }),
  ]

  it('groups the volume with the unit symbol', () => {
    expect(volumeText(sets, 'metric')).toBe('1,720 kg')
  })

  it('counts the sets and the exercises', () => {
    expect(heroFooter(sets, 'metric')).toBe('Volume 1,720 kg · 2 sets · 2 exercises')
  })
})

describe('goToWorkouts', () => {
  it('loads the workouts screen as a document, so it opens offline from the cache', () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { assign })

    goToWorkouts()

    expect(assign).toHaveBeenCalledWith('/workouts')
  })
})

describe('the repository source', () => {
  it('reads the active session through the repository', async () => {
    const session: WorkoutSession = await startSession('2026-09-01')

    expect(await REPOSITORY_LIVE_SOURCE.getActiveSession()).toEqual(session)
  })
})
