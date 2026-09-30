import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  DELETE_FAILED,
  EDIT_FAILED,
  exerciseOrder,
  exerciseSummary,
  FINISH_FAILED,
  goToWorkouts,
  heroFooter,
  lastOf,
  lastTimeSet,
  LiveSession,
  READ_FAILED,
  recordIds,
  REPOSITORY_LIVE_SOURCE,
  SAVE_FAILED,
  UNDO_FAILED,
  volumeText,
  WORKOUTS_PATH,
} from './LiveSession'
import { startedText } from './SessionTimer'
import { SWIPE_PX } from './SetRow'

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
    const other = within(screen.getByTestId('done-so-far')).getByRole('button', {
      name: /Back Squat/,
    })
    expect(other).toHaveTextContent('1 set · 500 kg')

    await userEvent.click(other)

    expect(await screen.findByRole('region', { name: 'Back Squat' })).toBeInTheDocument()
    expect(
      within(screen.getByTestId('done-so-far')).getByRole('button', { name: /Bench Press/ }),
    ).toHaveTextContent('1 set · 480 kg')
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

function editDialog(position: number) {
  return screen.getByRole('dialog', { name: `Edit set ${String(position)}` })
}

async function openEdit(position: number) {
  await userEvent.click(
    screen.getByRole('button', { name: new RegExp(`^Edit set ${String(position)},`) }),
  )
  return screen.findByRole('dialog', { name: `Edit set ${String(position)}` })
}

async function sessionWithBench(reps = 8, weight_kg = 60) {
  const session = await startSession('2026-09-01')
  const set = await addSet({
    session_id: session.id,
    exercise_id: BENCH_ID,
    reps,
    weight_kg,
    completed_at: '2026-09-01T10:00:00.000Z',
  })
  return { session, set }
}

function failing(overrides: Partial<LiveSessionSource>): LiveSessionSource {
  return { ...REPOSITORY_LIVE_SOURCE, ...overrides }
}

describe('editing a set', () => {
  it('changes the volume total when a set is edited', async () => {
    await sessionWithBench()
    await renderLive()
    expect(summary()).toHaveTextContent('Volume 480 kg')

    const dialog = await openEdit(1)
    await userEvent.clear(within(dialog).getByLabelText('Reps'))
    await userEvent.type(within(dialog).getByLabelText('Reps'), '10')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save set' }))

    await waitFor(() => {
      expect(summary()).toHaveTextContent('Volume 600 kg · 1 set · 1 exercise')
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('changes the load of the set in storage, keeping its id', async () => {
    const { set } = await sessionWithBench()
    await renderLive()

    const dialog = await openEdit(1)
    await userEvent.clear(within(dialog).getByLabelText(/^Load/))
    await userEvent.type(within(dialog).getByLabelText(/^Load/), '62.5')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save set' }))

    await waitFor(async () => {
      expect((await listSets(set.session_id)).map((row) => [row.id, row.weight_kg])).toEqual([
        [set.id, 62.5],
      ])
    })
  })

  it('says so inside the sheet when the change cannot be saved', async () => {
    await sessionWithBench()
    await renderLive({ source: failing({ updateSet: () => Promise.reject(new Error('full')) }) })

    const dialog = await openEdit(1)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save set' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(EDIT_FAILED)
    expect(editDialog(1)).toBeInTheDocument()
  })

  it('names a signed-out device when a change is refused', async () => {
    await sessionWithBench()
    await renderLive({
      source: failing({ updateSet: () => Promise.reject(new SignedOutOnThisDevice()) }),
    })

    const dialog = await openEdit(1)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save set' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      new SignedOutOnThisDevice().message,
    )
  })

  it('closes the sheet with no change on its close button', async () => {
    await sessionWithBench()
    await renderLive()

    await openEdit(1)
    await userEvent.click(screen.getByRole('button', { name: 'Close Edit set 1' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(summary()).toHaveTextContent('Volume 480 kg')
  })

  it('shows the badge on an edited earlier set even when a later set is heavier', async () => {
    const session = await startSession('2026-09-02')
    await db.workoutSets.put(pastSet({ weight_kg: 80, completed_at: '2026-09-01T10:00:00.000Z' }))
    await addSet({
      session_id: session.id,
      exercise_id: BENCH_ID,
      reps: 5,
      weight_kg: 70,
      completed_at: '2026-09-02T10:00:00.000Z',
    })
    await addSet({
      session_id: session.id,
      exercise_id: BENCH_ID,
      reps: 5,
      weight_kg: 90,
      completed_at: '2026-09-02T10:05:00.000Z',
    })
    await renderLive()

    const dialog = await openEdit(1)
    await userEvent.clear(within(dialog).getByLabelText(/^Load/))
    await userEvent.type(within(dialog).getByLabelText(/^Load/), '85')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save set' }))

    await waitFor(() => {
      expect(within(card('Bench Press')).getAllByText('PR')).toHaveLength(2)
    })
  })
})

describe('deleting a set and the undo', () => {
  it('brings a deleted set back on Undo, with the same id', async () => {
    const { session, set } = await sessionWithBench()
    await renderLive()

    const dialog = await openEdit(1)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete set' }))

    expect(await screen.findByText('Set 1 deleted.')).toBeInTheDocument()
    expect(screen.getByText('Set 1 deleted.').closest('[role="status"]')).not.toBeNull()
    await waitFor(() => {
      expect(summary()).toHaveTextContent('Volume 0 kg · 0 sets')
    })
    expect(await listSets(session.id)).toEqual([])

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))

    await waitFor(() => {
      expect(summary()).toHaveTextContent('Volume 480 kg · 1 set')
    })
    expect((await listSets(session.id)).map((row) => row.id)).toEqual([set.id])
    expect(screen.queryByText('Set 1 deleted.')).not.toBeInTheDocument()
  })

  it('deletes a set with the keyboard alone', async () => {
    const { session } = await sessionWithBench()
    await renderLive()
    const row = screen.getByRole('button', { name: /^Edit set 1,/ })

    row.focus()
    await userEvent.keyboard('{Enter}')
    const dialog = await screen.findByRole('dialog', { name: 'Edit set 1' })
    const remove = within(dialog).getByRole('button', { name: 'Delete set' })
    while (document.activeElement !== remove) {
      await userEvent.tab()
    }
    await userEvent.keyboard('{Enter}')

    expect(await screen.findByText('Set 1 deleted.')).toBeInTheDocument()
    expect(await listSets(session.id)).toEqual([])
  })

  it('deletes a set on a swipe to the left, with the same undo', async () => {
    const { session } = await sessionWithBench()
    await renderLive()
    const row = screen.getByRole('button', { name: /^Edit set 1,/ })

    fireEvent.pointerDown(row, { clientX: 200, clientY: 10 })
    fireEvent.pointerMove(row, { clientX: 200 - SWIPE_PX, clientY: 10 })

    expect(await screen.findByText('Set 1 deleted.')).toBeInTheDocument()
    expect(await listSets(session.id)).toEqual([])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('says so on the page when a swiped delete fails', async () => {
    await sessionWithBench()
    await renderLive({ source: failing({ deleteSet: () => Promise.reject(new Error('full')) }) })
    const row = screen.getByRole('button', { name: /^Edit set 1,/ })

    fireEvent.pointerDown(row, { clientX: 200, clientY: 10 })
    fireEvent.pointerMove(row, { clientX: 200 - SWIPE_PX, clientY: 10 })

    expect(await screen.findByRole('alert')).toHaveTextContent(DELETE_FAILED)
    expect(screen.queryByText('Set 1 deleted.')).not.toBeInTheDocument()
  })

  it('says so inside the sheet when a delete from it fails', async () => {
    await sessionWithBench()
    await renderLive({ source: failing({ deleteSet: () => Promise.reject(new Error('full')) }) })

    const dialog = await openEdit(1)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete set' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(DELETE_FAILED)
  })

  it('says so when the undo fails', async () => {
    await sessionWithBench()
    await renderLive({ source: failing({ restoreSet: () => Promise.reject(new Error('full')) }) })

    const dialog = await openEdit(1)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete set' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(UNDO_FAILED)
  })

  it('takes no second delete while one is saving', async () => {
    await sessionWithBench()
    let finish: () => void = () => undefined
    const deleteSet = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    await renderLive({ source: failing({ deleteSet }) })
    const row = screen.getByRole('button', { name: /^Edit set 1,/ })

    for (let swipe = 0; swipe < 2; swipe += 1) {
      fireEvent.pointerDown(row, { clientX: 200, clientY: 10 })
      fireEvent.pointerMove(row, { clientX: 200 - SWIPE_PX, clientY: 10 })
    }
    finish()

    expect(deleteSet).toHaveBeenCalledTimes(1)
    await screen.findByText('Set 1 deleted.')
  })

  it('takes no edit save while a save is running', async () => {
    await sessionWithBench()
    const updateSet = vi.fn(() => new Promise<WorkoutSet>(() => undefined))
    await renderLive({ source: failing({ updateSet }) })

    const dialog = await openEdit(1)
    const save = within(dialog).getByRole('button', { name: 'Save set' })
    await userEvent.click(save)
    fireEvent.submit(save.closest('form') as HTMLFormElement)

    expect(updateSet).toHaveBeenCalledTimes(1)
  })

  it('counts the sets again after a delete, so the next set keeps its place', async () => {
    const { session } = await sessionWithBench()
    await addSet({
      session_id: session.id,
      exercise_id: BENCH_ID,
      reps: 6,
      weight_kg: 70,
      completed_at: '2026-09-01T10:05:00.000Z',
    })
    await renderLive()

    const dialog = await openEdit(1)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete set' }))

    expect(
      await screen.findByRole('button', { name: 'Edit set 1, 70 kg, 6 reps' }),
    ).toBeInTheDocument()
  })
})

describe('the last time line', () => {
  it('shows the last set of an earlier session with its estimated one-rep max', async () => {
    await db.workoutSets.bulkPut([
      pastSet({ weight_kg: 70, reps: 8, completed_at: '2026-08-30T10:00:00.000Z' }),
      pastSet({ weight_kg: 72.5, reps: 8, completed_at: '2026-08-31T10:00:00.000Z' }),
    ])
    await sessionWithBench(8, 75)
    await renderLive()

    expect(
      within(card('Bench Press')).getByText('Last time 72.5 kg × 8 · estimated 1RM 92 kg'),
    ).toBeInTheDocument()
  })

  it('shows it before the first set of an exercise too', async () => {
    await db.workoutSets.put(pastSet({ weight_kg: 100, reps: 5 }))
    await startSession('2026-09-02')
    await renderLive()
    await pickExercise('Bench Press')

    expect(
      await within(card('Bench Press')).findByText('Last time 100 kg × 5 · estimated 1RM 117 kg'),
    ).toBeInTheDocument()
  })

  it('shows no line for an exercise done only in this session', async () => {
    await sessionWithBench()
    await renderLive()

    expect(within(card('Bench Press')).queryByText(/^Last time/)).not.toBeInTheDocument()
  })
})

describe('lastTimeSet', () => {
  it('takes the last set of the exercise from another session', () => {
    const older = pastSet({ id: 'older', completed_at: '2026-08-30T10:00:00.000Z' })
    const newer = pastSet({ id: 'newer', completed_at: '2026-08-31T10:00:00.000Z' })
    const today = pastSet({
      id: 'today',
      session_id: 'live',
      completed_at: '2026-09-01T10:00:00.000Z',
    })
    const squat = pastSet({
      id: 'squat',
      exercise_id: SQUAT_ID,
      completed_at: '2026-09-01T09:00:00.000Z',
    })

    expect(lastTimeSet([older, newer, today, squat], 'live', BENCH_ID)?.id).toBe('newer')
  })

  it('returns undefined when the exercise has no earlier session', () => {
    expect(lastTimeSet([pastSet({ session_id: 'live' })], 'live', BENCH_ID)).toBeUndefined()
  })
})

describe('exerciseSummary', () => {
  it('names an exercise with no sets', () => {
    expect(exerciseSummary([], 'metric')).toBe('No sets')
  })

  it('counts the sets and the volume', () => {
    expect(exerciseSummary([pastSet({ reps: 5, weight_kg: 100 })], 'metric')).toBe('1 set · 500 kg')
  })
})

describe('the laptop layout', () => {
  it('lists every exercise, the active one marked current, and opens one on a tap', async () => {
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
    const list = screen.getByRole('region', { name: 'Exercises' })

    const bench = within(list).getByRole('button', { name: /Bench Press/ })
    expect(bench).toHaveAttribute('aria-current', 'true')
    expect(bench).toHaveTextContent('Chest')
    expect(bench).toHaveTextContent('1 set · 480 kg')

    await userEvent.click(within(list).getByRole('button', { name: /Back Squat/ }))

    expect(await screen.findByRole('region', { name: 'Back Squat' })).toBeInTheDocument()
    expect(within(list).getByRole('button', { name: /Back Squat/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(within(list).getByRole('button', { name: /Bench Press/ })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('shows the list only at 1024 px and up, and the Done so far card below it', async () => {
    const session = await startSession('2026-09-01')
    await addSet({ session_id: session.id, exercise_id: SQUAT_ID, reps: 5, weight_kg: 100 })
    await addSet({ session_id: session.id, exercise_id: BENCH_ID, reps: 5, weight_kg: 100 })
    await renderLive()

    expect(screen.getByTestId('exercise-list')).toHaveClass('hidden', 'lg:flex')
    expect(screen.getByTestId('done-so-far')).toHaveClass('lg:hidden')
  })

  it('puts the active exercise in the right column at 1024 px and up', async () => {
    await sessionWithBench()
    await renderLive()

    expect(screen.getByTestId('live-grid')).toHaveClass(
      'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]',
    )
    expect(screen.getByTestId('live-active')).toHaveClass('lg:col-2')
  })

  it('names an exercise the catalogue no longer holds', async () => {
    const session = await startSession('2026-09-01')
    await addSet({
      session_id: session.id,
      exercise_id: crypto.randomUUID(),
      reps: 5,
      weight_kg: 50,
    })
    await addSet({ session_id: session.id, exercise_id: BENCH_ID, reps: 5, weight_kg: 50 })
    await renderLive()

    expect(
      within(screen.getByRole('region', { name: 'Exercises' })).getByRole('button', {
        name: /Unknown exercise/,
      }),
    ).toBeInTheDocument()
  })
})
