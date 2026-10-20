import { configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../../lib/db/dexie'
import {
  addSet,
  getPlanCursor,
  listSets,
  setPlanCursor,
  SignedOutOnThisDevice,
  startPlanSession,
  startSession,
} from '../../lib/db/repository'
import { COACH_PLANS } from '../../lib/plans/coach'
import { FocusModeProvider, useFocusModeOn } from '../ui/FocusMode'
import { ToastProvider } from '../ui/Toast'
import { SUMMARY_TITLE } from '../workout/SessionSummary'

import {
  DELETE_FAILED,
  EDIT_FAILED,
  FINISH_FAILED,
  firstDraft,
  MOVE_FAILED,
  PlanSession,
  READING_STEP,
  REPOSITORY_PLAN_SOURCE,
  REST_SAVE_FAILED,
  resumeIndex,
  SAVE_FAILED,
  shownStatuses,
  skipStep,
  startCursor,
  startDrafts,
  UNDO_FAILED,
} from './PlanSession'
import { FIRST_TIME_HINT } from './PlanSetRows'
import { BACK_LABEL, LEAVE_LABEL } from './PlanStepHeader'

import type { PlanSessionSource } from './PlanSession'
import type { WorkoutSession, WorkoutSet } from '../../lib/db/dexie'
import type { PlanStep } from '../../lib/schema/plan'

configure({ asyncUtilTimeout: 5000 })
vi.setConfig({ testTimeout: 20000 })

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const router = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}))

vi.mock('../../lib/supabase/client', () => ({
  createClient: () => {
    throw new Error('no network in a component test')
  },
}))

const PLAN = COACH_PLANS.find((plan) => plan.id === 'chest-triceps')
const STEPS: PlanStep[] = PLAN === undefined ? [] : PLAN.groups.flatMap((group) => group.steps)

function stepAt(index: number): PlanStep {
  const step = STEPS[index]
  if (step === undefined) throw new Error(`no step ${String(index)}`)
  return step
}

function set(overrides: Partial<WorkoutSet>): WorkoutSet {
  return {
    id: crypto.randomUUID(),
    session_id: 'session',
    exercise_id: stepAt(0).exerciseId,
    set_index: 0,
    reps: 10,
    weight_kg: 14,
    rpe: null,
    completed_at: '2026-10-19T10:00:00.000Z',
    created_at: '2026-10-19T10:00:00.000Z',
    updated_at: '2026-10-19T10:00:00.000Z',
    deleted_at: null,
    ...overrides,
  }
}

async function putFinishedSet(overrides: Partial<WorkoutSet>): Promise<void> {
  const row = set({ session_id: crypto.randomUUID(), ...overrides })

  await db.workoutSessions.put({
    id: row.session_id,
    entry_date: '2026-10-19',
    started_at: '2026-10-19T09:00:00.000Z',
    ended_at: '2026-10-19T11:00:00.000Z',
    status: 'finished',
    plan_ids: ['chest-triceps'],
    created_at: '2026-10-19T09:00:00.000Z',
    updated_at: '2026-10-19T11:00:00.000Z',
    deleted_at: null,
  })
  await db.workoutSets.put(row)
}

function FocusReader() {
  return <p data-testid="focus">{useFocusModeOn() ? 'focus' : 'default'}</p>
}

function show(session: WorkoutSession, source?: PlanSessionSource) {
  return render(
    <ToastProvider>
      <FocusModeProvider>
        <FocusReader />
        <PlanSession
          session={session}
          now={() => new Date()}
          alert={{ unlock: vi.fn(), ring: vi.fn() }}
          {...(source === undefined ? {} : { source })}
        />
      </FocusModeProvider>
    </ToastProvider>,
  )
}

async function heading(name: string) {
  return screen.findByRole('heading', { level: 1, name })
}

beforeEach(async () => {
  router.push.mockReset()
  await db.open()
  await Promise.all([
    db.workoutSessions.clear(),
    db.workoutSets.clear(),
    db.outbox.clear(),
    db.syncMeta.clear(),
    db.profiles.clear(),
    db.planCursors.clear(),
  ])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('resumeIndex', () => {
  it('picks the first step with no sets', () => {
    expect(resumeIndex(STEPS, [set({ exercise_id: stepAt(0).exerciseId })])).toBe(1)
  })

  it('picks the last step when every step has a set', () => {
    const sets = STEPS.map((step) => set({ exercise_id: step.exerciseId }))
    expect(resumeIndex(STEPS, sets)).toBe(STEPS.length - 1)
  })

  it('ignores a deleted set', () => {
    expect(resumeIndex(STEPS, [set({ deleted_at: '2026-10-19T10:00:00.000Z' })])).toBe(0)
  })
})

describe('startCursor', () => {
  it('builds a cursor at the resume step when none is saved', () => {
    expect(startCursor('s', STEPS, [], undefined)).toEqual({
      sessionId: 's',
      stepIndex: 0,
      skipped: [],
    })
  })

  it('keeps a saved cursor, held inside the plan', () => {
    expect(startCursor('s', STEPS, [], { sessionId: 's', stepIndex: 40, skipped: ['a'] })).toEqual({
      sessionId: 's',
      stepIndex: STEPS.length - 1,
      skipped: ['a'],
    })
    expect(
      startCursor('s', STEPS, [], { sessionId: 's', stepIndex: -2, skipped: [] }).stepIndex,
    ).toBe(0)
  })
})

describe('shownStatuses', () => {
  it('shows the cursor step as now even with a set logged', () => {
    const cursor = { sessionId: 'session', stepIndex: 0, skipped: [] }
    expect(shownStatuses(STEPS, [set({})], cursor)[0]).toBe('now')
  })
})

describe('firstDraft and startDrafts', () => {
  it('fills the reps from the target and leaves the load empty on a first time', () => {
    expect(firstDraft(stepAt(0), undefined, 'metric')).toEqual({ reps: '10', load: '' })
  })

  it('copies the last set on a repeat', () => {
    expect(firstDraft(stepAt(0), set({ reps: 8, weight_kg: 16 }), 'metric')).toEqual({
      reps: '8',
      load: '16',
    })
  })

  it('leaves the load empty on a body-weight step, even after a weighted set', () => {
    const dips = { ...stepAt(0), bodyweight: true }
    expect(firstDraft(dips, set({ reps: 15, weight_kg: 5 }), 'metric')).toEqual({
      reps: '15',
      load: '',
    })
  })

  it('creates as many rows as the target holds sets, less the sets logged', () => {
    expect(startDrafts(stepAt(0), 0, undefined, 'metric')).toHaveLength(3)
    expect(startDrafts(stepAt(0), 1, undefined, 'metric')).toHaveLength(2)
    expect(startDrafts(stepAt(0), 5, undefined, 'metric')).toHaveLength(0)
  })
})

describe('skipStep', () => {
  it('records the slug and moves on', () => {
    expect(skipStep({ sessionId: 's', stepIndex: 1, skipped: [] }, 'b', 8)).toEqual({
      sessionId: 's',
      stepIndex: 2,
      skipped: ['b'],
    })
  })

  it('records a slug once and stays on the last step', () => {
    expect(skipStep({ sessionId: 's', stepIndex: 8, skipped: ['z'] }, 'z', 8)).toEqual({
      sessionId: 's',
      stepIndex: 8,
      skipped: ['z'],
    })
  })
})

describe('PlanSession', () => {
  it('opens on step 1 with the leave link, the frame on Play and focus mode on', async () => {
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    show(session)

    expect(await heading(stepAt(0).name)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: LEAVE_LABEL })).toHaveAttribute('href', '/workouts')
    expect(screen.getByText(`Step 1 of ${String(STEPS.length)} · Chest`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Target 3 × 10–12')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: `Watch ${stepAt(0).name}` })).toBeInTheDocument()
    expect(screen.getByTestId('focus')).toHaveTextContent('focus')
  })

  it('leaves the rows empty with the hint on a first time', async () => {
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    show(session)

    await heading(stepAt(0).name)
    expect(await screen.findByText(FIRST_TIME_HINT)).toBeInTheDocument()
    expect(screen.getByLabelText('Set 1 load')).toHaveValue('')
    expect(screen.getByLabelText('Set 3 load')).toHaveValue('')
    expect(screen.queryByText(/^Last time/)).toBeNull()
  })

  it('fills 3 rows from the last finished set on a repeat', async () => {
    await putFinishedSet({ reps: 10, weight_kg: 14 })
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    show(session)

    await heading(stepAt(0).name)
    expect(await screen.findByLabelText('Set 3 load')).toHaveValue('14')
    expect(screen.getByLabelText('Set 1 reps')).toHaveValue('10')
    expect(screen.getByText('Last time 14 kg × 10')).toBeInTheDocument()
  })

  it('shows reading while the last set is read', async () => {
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    const source = {
      ...REPOSITORY_PLAN_SOURCE,
      lastSetFor: () => new Promise<undefined>(() => undefined),
    }
    show(session, source)

    await heading(stepAt(0).name)
    expect(screen.getByText(READING_STEP)).toBeInTheDocument()
  })

  it('copies the row above on + Add set', async () => {
    await putFinishedSet({ reps: 10, weight_kg: 14 })
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    show(session)

    const load = await screen.findByLabelText('Set 3 load')
    fireEvent.change(load, { target: { value: '18' } })
    await userEvent.click(screen.getByRole('button', { name: `Add set to ${stepAt(0).name}` }))
    expect(screen.getByLabelText('Set 4 load')).toHaveValue('18')
  })

  it('logs a ticked row and starts the rest timer', async () => {
    await putFinishedSet({ reps: 10, weight_kg: 14 })
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    show(session)

    await screen.findByLabelText('Set 1 load')
    await userEvent.click(screen.getByRole('button', { name: 'Set 1 done' }))

    expect(await screen.findByRole('region', { name: 'Rest timer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set 1 done' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getAllByRole('button', { name: /^Set \d done$/ })).toHaveLength(3)
    const sets = await listSets(session.id)
    expect(sets.map((row) => [row.exercise_id, row.reps, row.weight_kg])).toEqual([
      [stepAt(0).exerciseId, 10, 14],
    ])
  })

  it('moves the cursor by 1 on Next and saves it', async () => {
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    show(session)

    await heading(stepAt(0).name)
    await userEvent.click(screen.getByRole('button', { name: /^Next step/ }))

    expect(await heading(stepAt(1).name)).toBeInTheDocument()
    expect(await getPlanCursor(session.id)).toEqual({
      sessionId: session.id,
      stepIndex: 1,
      skipped: [],
    })
    expect(screen.getByRole('button', { name: 'Play' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('moves the cursor back by 1 on Back', async () => {
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    await setPlanCursor({ sessionId: session.id, stepIndex: 2, skipped: [] })
    show(session)

    await heading(stepAt(2).name)
    await userEvent.click(screen.getByRole('button', { name: BACK_LABEL }))

    expect(await heading(stepAt(1).name)).toBeInTheDocument()
    expect((await getPlanCursor(session.id))?.stepIndex).toBe(1)
  })

  it('resets the frame to Play on every step', async () => {
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    show(session)

    await heading(stepAt(0).name)
    await userEvent.click(screen.getByRole('button', { name: 'Muscles' }))
    await userEvent.click(screen.getByRole('button', { name: /^Next step/ }))

    await heading(stepAt(1).name)
    expect(screen.getByRole('button', { name: 'Play' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('records the slug on Skip and moves on', async () => {
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    show(session)

    await heading(stepAt(0).name)
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }))

    expect(await heading(stepAt(1).name)).toBeInTheDocument()
    expect(await getPlanCursor(session.id)).toEqual({
      sessionId: session.id,
      stepIndex: 1,
      skipped: [stepAt(0).slug],
    })
    expect(
      screen.getByText(`Step 1, ${stepAt(0).name}: skipped`, { selector: '.sr-only' }),
    ).toBeInTheDocument()
  })

  it('shows a skipped step that later gets a set as done', async () => {
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    await setPlanCursor({ sessionId: session.id, stepIndex: 1, skipped: [stepAt(0).slug] })
    await addSet({
      session_id: session.id,
      exercise_id: stepAt(0).exerciseId,
      reps: 10,
      weight_kg: 12,
      completed_at: new Date().toISOString(),
    })
    show(session)

    await heading(stepAt(1).name)
    expect(
      screen.getByText(`Step 1, ${stepAt(0).name}: done`, { selector: '.sr-only' }),
    ).toBeInTheDocument()
  })

  it('shows the map and the tags for the same muscles on Muscles', async () => {
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    show(session)

    await heading(stepAt(0).name)
    await userEvent.click(screen.getByRole('button', { name: 'Muscles' }))

    expect(
      screen.getByRole('img', { name: 'Main: Chest. Helpers: Shoulders, Triceps.' }),
    ).toBeVisible()
    const tags = within(screen.getByRole('list', { name: 'Muscles' })).getAllByRole('listitem')
    expect(tags.map((tag) => tag.textContent)).toEqual([
      'Chest, main',
      'Shoulders, helper',
      'Triceps, helper',
    ])
  })

  it('resumes at the same step with the same skips after a remount', async () => {
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    const first = show(session)

    await heading(stepAt(0).name)
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }))
    await heading(stepAt(1).name)
    await userEvent.click(screen.getByRole('button', { name: /^Next step/ }))
    await heading(stepAt(2).name)
    first.unmount()

    show(session)
    expect(await heading(stepAt(2).name)).toBeInTheDocument()
    expect(
      screen.getByText(`Step 1, ${stepAt(0).name}: skipped`, { selector: '.sr-only' }),
    ).toBeInTheDocument()
  })

  it('resumes at the first step with no sets when no cursor is saved', async () => {
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    await addSet({
      session_id: session.id,
      exercise_id: stepAt(0).exerciseId,
      reps: 10,
      weight_kg: 12,
      completed_at: new Date().toISOString(),
    })
    show(session)

    expect(await heading(stepAt(1).name)).toBeInTheDocument()
  })

  it('keeps the step and says so when the cursor cannot be saved', async () => {
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    const source = {
      ...REPOSITORY_PLAN_SOURCE,
      setPlanCursor: () => Promise.reject(new Error('disk full')),
    }
    show(session, source)

    await heading(stepAt(0).name)
    await userEvent.click(screen.getByRole('button', { name: /^Next step/ }))

    expect(await screen.findByText(MOVE_FAILED)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: stepAt(0).name })).toBeInTheDocument()
  })

  it('names the signed-out refusal when a move is refused', async () => {
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    const refusal = new SignedOutOnThisDevice()
    show(session, { ...REPOSITORY_PLAN_SOURCE, setPlanCursor: () => Promise.reject(refusal) })

    await heading(stepAt(0).name)
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }))

    expect(await screen.findByText(refusal.message)).toBeInTheDocument()
  })

  it('shows Body on Bench Dips and saves a null load, also on a first time', async () => {
    const dips = STEPS.findIndex((step) => step.bodyweight)
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    await setPlanCursor({ sessionId: session.id, stepIndex: dips, skipped: [] })
    show(session)

    await heading(stepAt(dips).name)
    expect((await screen.findAllByTestId('body-cell')).length).toBe(3)
    expect(screen.queryByText(FIRST_TIME_HINT)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Set 1 done' }))

    await waitFor(async () => {
      expect((await listSets(session.id)).map((row) => row.weight_kg)).toEqual([null])
    })
  })

  it('hides Skip on the last step', async () => {
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    await setPlanCursor({ sessionId: session.id, stepIndex: STEPS.length - 1, skipped: [] })
    show(session)

    await heading(stepAt(STEPS.length - 1).name)
    expect(screen.getByRole('button', { name: 'Finish session' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull()
  })

  it('reads Finish session on the last step and shows the summary', async () => {
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    await setPlanCursor({ sessionId: session.id, stepIndex: STEPS.length - 1, skipped: [] })
    show(session)

    await heading(stepAt(STEPS.length - 1).name)
    await userEvent.click(screen.getByRole('button', { name: 'Finish session' }))

    const summary = await screen.findByRole('dialog', { name: SUMMARY_TITLE })
    expect(await getPlanCursor(session.id)).toBeUndefined()
    await userEvent.click(within(summary).getAllByRole('button').at(-1) as HTMLElement)
    expect(router.push).toHaveBeenCalledWith('/workouts')
  })

  it('removes a logged set from its tick, and brings it back on Undo', async () => {
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    await addSet({
      session_id: session.id,
      exercise_id: stepAt(0).exerciseId,
      reps: 10,
      weight_kg: 12,
      completed_at: new Date().toISOString(),
    })
    await setPlanCursor({ sessionId: session.id, stepIndex: 0, skipped: [] })
    show(session)

    await heading(stepAt(0).name)
    const tick = await screen.findByRole('button', { name: 'Set 1 done', pressed: true })
    await userEvent.click(tick)

    await waitFor(async () => {
      expect(await listSets(session.id)).toHaveLength(0)
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    await waitFor(async () => {
      expect(await listSets(session.id)).toHaveLength(1)
    })
  })

  it('changes a logged set through the edit sheet', async () => {
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    await addSet({
      session_id: session.id,
      exercise_id: stepAt(0).exerciseId,
      reps: 10,
      weight_kg: 12,
      completed_at: new Date().toISOString(),
    })
    await setPlanCursor({ sessionId: session.id, stepIndex: 0, skipped: [] })
    show(session)

    await userEvent.click(await screen.findByRole('button', { name: /^Edit set 1/ }))
    const sheet = await screen.findByRole('dialog')
    const reps = within(sheet).getByLabelText('Reps')
    await userEvent.clear(reps)
    await userEvent.type(reps, '9')
    await userEvent.click(within(sheet).getByRole('button', { name: /^Save/ }))

    await waitFor(async () => {
      expect((await listSets(session.id))[0]?.reps).toBe(9)
    })
  })

  it('shows the read failure when the device cannot be read', async () => {
    const session = await startSession('2026-10-20')
    show(
      { ...session, plan_ids: ['chest-triceps'] },
      { ...REPOSITORY_PLAN_SOURCE, listSets: () => Promise.reject(new Error('broken')) },
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The session could not be read on this device.',
    )
  })

  it('skips the rest and adds 30 s from the rest card', async () => {
    await putFinishedSet({ reps: 10, weight_kg: 14 })
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    show(session)

    await screen.findByLabelText('Set 1 load')
    await userEvent.click(screen.getByRole('button', { name: 'Set 1 done' }))
    const rest = await screen.findByRole('region', { name: 'Rest timer' })
    await userEvent.click(within(rest).getByRole('button', { name: /\+30/ }))
    await userEvent.click(within(rest).getByRole('button', { name: /^Skip/ }))

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Rest timer' })).toBeNull()
    })
  })
})

describe('PlanSession when a write fails', () => {
  async function withLoggedSet(): Promise<WorkoutSession> {
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    await addSet({
      session_id: session.id,
      exercise_id: stepAt(0).exerciseId,
      reps: 10,
      weight_kg: 12,
      completed_at: new Date().toISOString(),
    })
    await setPlanCursor({ sessionId: session.id, stepIndex: 0, skipped: [] })
    return session
  }

  it('says so when a ticked set cannot be saved', async () => {
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    show(session, { ...REPOSITORY_PLAN_SOURCE, addSet: () => Promise.reject(new Error('full')) })

    await screen.findByLabelText('Set 1 load')
    fireEvent.change(screen.getByLabelText('Set 1 load'), { target: { value: '10' } })
    await userEvent.click(screen.getByRole('button', { name: 'Set 1 done' }))

    expect(await screen.findByText(SAVE_FAILED)).toBeInTheDocument()
  })

  it('says so when a set cannot be removed', async () => {
    const session = await withLoggedSet()
    show(session, { ...REPOSITORY_PLAN_SOURCE, deleteSet: () => Promise.reject(new Error('x')) })

    await userEvent.click(await screen.findByRole('button', { name: 'Set 1 done', pressed: true }))

    expect(await screen.findByText(DELETE_FAILED)).toBeInTheDocument()
  })

  it('says so in the sheet when a set cannot be deleted from it', async () => {
    const session = await withLoggedSet()
    show(session, { ...REPOSITORY_PLAN_SOURCE, deleteSet: () => Promise.reject(new Error('x')) })

    await userEvent.click(await screen.findByRole('button', { name: /^Edit set 1/ }))
    const sheet = await screen.findByRole('dialog')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Delete set' }))

    expect(await within(sheet).findByText(DELETE_FAILED)).toBeInTheDocument()
  })

  it('deletes a set from the sheet', async () => {
    const session = await withLoggedSet()
    show(session)

    await userEvent.click(await screen.findByRole('button', { name: /^Edit set 1/ }))
    const sheet = await screen.findByRole('dialog')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Delete set' }))

    await waitFor(async () => {
      expect(await listSets(session.id)).toHaveLength(0)
    })
  })

  it('says so in the sheet when a change cannot be saved, and closes on Escape', async () => {
    const session = await withLoggedSet()
    show(session, { ...REPOSITORY_PLAN_SOURCE, updateSet: () => Promise.reject(new Error('x')) })

    await userEvent.click(await screen.findByRole('button', { name: /^Edit set 1/ }))
    const sheet = await screen.findByRole('dialog')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save set' }))
    expect(await within(sheet).findByText(EDIT_FAILED)).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('says so when a removed set cannot be brought back, and drops the toast on dismiss', async () => {
    const session = await withLoggedSet()
    show(session, { ...REPOSITORY_PLAN_SOURCE, restoreSet: () => Promise.reject(new Error('x')) })

    await userEvent.click(await screen.findByRole('button', { name: 'Set 1 done', pressed: true }))
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }))

    expect(await screen.findByText(UNDO_FAILED)).toBeInTheDocument()
  })

  it('says so when the session cannot be finished', async () => {
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    await setPlanCursor({ sessionId: session.id, stepIndex: STEPS.length - 1, skipped: [] })
    show(session, {
      ...REPOSITORY_PLAN_SOURCE,
      finishSession: () => Promise.reject(new Error('x')),
    })

    await userEvent.click(await screen.findByRole('button', { name: 'Finish session' }))

    expect(await screen.findByText(FINISH_FAILED)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Finish session' })).toBeEnabled()
  })

  it('calls onFinished when given, after the summary', async () => {
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    await setPlanCursor({ sessionId: session.id, stepIndex: STEPS.length - 1, skipped: [] })
    const onFinished = vi.fn()
    render(
      <ToastProvider>
        <PlanSession session={session} onFinished={onFinished} />
      </ToastProvider>,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Finish session' }))
    const summary = await screen.findByRole('dialog', { name: SUMMARY_TITLE })
    await userEvent.click(within(summary).getAllByRole('button').at(-1) as HTMLElement)

    expect(onFinished).toHaveBeenCalledOnce()
    expect(router.push).not.toHaveBeenCalled()
  })

  it('treats a failed last set read as a first time', async () => {
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    show(session, { ...REPOSITORY_PLAN_SOURCE, lastSetFor: () => Promise.reject(new Error('x')) })

    expect(await screen.findByText(FIRST_TIME_HINT)).toBeInTheDocument()
  })

  it('changes the rest time from the rest card, and says so when it cannot', async () => {
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    let fail = true
    show(session, {
      ...REPOSITORY_PLAN_SOURCE,
      saveRestSeconds: (exerciseId, seconds) =>
        fail
          ? Promise.reject(new Error('x'))
          : REPOSITORY_PLAN_SOURCE.saveRestSeconds(exerciseId, seconds),
    })

    fireEvent.change(await screen.findByLabelText('Set 1 load'), { target: { value: '10' } })
    await userEvent.click(screen.getByRole('button', { name: 'Set 1 done' }))
    const rest = await screen.findByRole('region', { name: 'Rest timer' })
    await userEvent.click(within(rest).getByRole('button', { name: /^Change the rest time/ }))
    const sheet = await screen.findByRole('dialog')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save rest time' }))
    expect(await within(sheet).findByText(REST_SAVE_FAILED)).toBeInTheDocument()

    fail = false
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save rest time' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('closes the rest sheet on Escape', async () => {
    const session = await startPlanSession(['chest-triceps'], '2026-10-20')
    show(session)

    fireEvent.change(await screen.findByLabelText('Set 1 load'), { target: { value: '10' } })
    await userEvent.click(screen.getByRole('button', { name: 'Set 1 done' }))
    const rest = await screen.findByRole('region', { name: 'Rest timer' })
    await userEvent.click(within(rest).getByRole('button', { name: /^Change the rest time/ }))
    await screen.findByRole('dialog')
    await userEvent.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })
})
