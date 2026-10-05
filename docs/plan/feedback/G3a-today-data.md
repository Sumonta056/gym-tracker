# Step G3a — The data for a full Today

**Branch:** `fix/g3a-today-data`, in worktree `../gym-tracker-g3a`, cut from `fix/feedback-fixes` ·
**Wave:** 9 · **Size:** M · **Depends on:** W0, C2, C3, E5, F1, G1, G2 · **Unlocks:** G3b,
H1 · **Agent to use:** `test-writer`

G3 is split in 2 steps, 1 session each: G3a builds the data
(`summary.ts` and `useDashboard`), G3b builds the cards. This step changes no visible UI.

## Before you start

1. Make the worktree:

   ```bash
   cd /Users/cefalo_1/Documents/Projects/gym-tracker
   git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-g3a -b fix/g3a-today-data fix/feedback-fixes
   cd ../gym-tracker-g3a
   cp ../gym-tracker/.env.local ../gym-tracker/.env.test.local .
   export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"
   pnpm install
   ```

   If you are already in that worktree on that branch, skip this block.

2. Dependency checks. Run them from the worktree root. Each line prints `FAIL` and the
   step name when that step is not in `fix/feedback-fixes`:

   ```bash
   test -f scripts/e2e-lock.mjs || echo "FAIL W0: scripts/e2e-lock.mjs is missing"
   grep -qs "export function effectiveGymSeconds" lib/metrics/gymTime.ts || echo "FAIL C2: effectiveGymSeconds is missing in lib/metrics/gymTime.ts"
   grep -qs "export function sessionsByDate" lib/metrics/sessionDays.ts || echo "FAIL C3: sessionsByDate is missing in lib/metrics/sessionDays.ts"
   grep -qs "listSessions(week.from, today)" components/dashboard/useDashboard.ts || echo "FAIL C3: useDashboard does not read the week sessions"
   test -f tests/e2e/swim.spec.ts || echo "FAIL E5: tests/e2e/swim.spec.ts is missing"
   grep -qs "swim_seconds" components/DailyEntryForm.tsx || echo "FAIL E5: the swim field is missing in components/DailyEntryForm.tsx"
   grep -qs "export function sessionStats" lib/metrics/sessionStats.ts || echo "FAIL F1: sessionStats is missing in lib/metrics/sessionStats.ts"
   grep -qs "export const WEEK_START" components/profile/UnitsCard.tsx || echo "FAIL G1: WEEK_START is missing in components/profile/UnitsCard.tsx"
   test -f components/charts/WalkChart.tsx || echo "FAIL G2: components/charts/WalkChart.tsx is missing"
   grep -qs "sessionsGoal" components/dashboard/summary.ts || echo "FAIL G2: sessionsGoal is missing in components/dashboard/summary.ts"
   ```

   If any check fails, the step it names is not merged into `fix/feedback-fixes`. Stop. Report which
   check failed. Do not do that step's work here.

3. Already done check:

   ```bash
   grep -qs "export const NO_LIFTS" components/dashboard/summary.ts && echo "G3a is already done"
   ```

   If it prints, stop and report.

## Names this step uses from earlier steps

- C2, `lib/metrics/gymTime.ts`:

  ```ts
  export type GymTimeSource = 'typed' | 'sessions' | 'none'
  export function effectiveGymSeconds(
    entry: Pick<DailyEntry, 'gym_seconds'> | undefined,
    sessions: Pick<WorkoutSession, 'entry_date' | 'started_at' | 'ended_at' | 'deleted_at'>[],
  ): { seconds: number; source: GymTimeSource }
  ```

  `sessions` holds the sessions of 1 `entry_date` only. The caller groups them. A typed
  value, also `0`, wins with source `'typed'`. Else the sum of the finished sessions
  (`ended_at !== null && deleted_at === null`) with source `'sessions'`. Else `0` with
  source `'none'`. A running session adds 0.

- C3, `components/dashboard/summary.ts` and `useDashboard.ts`. `summarise` has a 5th
  parameter `sessions: readonly WorkoutSession[] = []`, the sessions of this week, and
  computes `week: weekTotals(past, weekRange, sessions)`. `readDashboard` reads
  `listSessions(week.from, today)` with `const week = weekOf(today)`. The C3 tests
  "counts a finished session with no typed gym time in the week" (`summary.test.tsx`) and
  "reads the sessions of the current week up to today" (`useDashboard.test.tsx`) exist.
- F1, `lib/metrics/sessionStats.ts`:

  ```ts
  export type SessionRecord = { exerciseId: string; weightKg: number; reps: number }
  export type SessionStats = {
    durationSeconds: number
    setCount: number
    exerciseCount: number
    volumeKg: number
    newRecords: SessionRecord[]
  }
  export function sessionStats(
    session: WorkoutSession,
    sets: WorkoutSet[],
    earlierSets: WorkoutSet[],
  ): SessionStats
  ```

- D1 and G1: the local `Profile` holds `calorie_goal`, `walk_goal_seconds` and
  `sessions_per_week_goal` as **optional** nullable numbers. Read each with `?? null`.
- G2: `DashboardSummary` already has `sessionsGoal: number | null`.
- E5: daily entries hold `swim_seconds`. This step does not read it.
- A1 may have wrapped `readDashboard` in `safeQuery`. Keep that wrap.

## Context to read first

1. This file. "Names this step uses from earlier steps" holds `effectiveGymSeconds` and
   `sessionStats`. Use them exactly.
2. `docs/specs/2026-10-05-feedback-fixes-design.md`, item 8, and section 3.2 (one source of gym time).
3. `components/dashboard/summary.ts` and its test — `DashboardSummary` and `summarise`.
4. `components/dashboard/useDashboard.ts` and its test — the repository mock.
5. `components/dashboard/Dashboard.test.tsx` — it mocks the repository too.
6. `lib/metrics/gymTime.ts` from C2, `lib/metrics/sessionStats.ts` from F1, `lib/metrics/round.ts`.
7. `lib/db/repository.ts` — `listSessions(from, to)`, `listSetsInRange(from, to)`,
   `setsForExercises(ids)`.

## State before the step

- `summarise(entries, profile, today, now, sessions)` reads the daily entries, the profile
  and the week's sessions (C3). The sessions feed only the week totals. After G2 it also
  returns `sessionsGoal`.
- `useDashboard` reads `listRange`, `getProfile` and `listSessions(week.from, today)`. It
  reads no set.
- Today's gym time is `entry.gym_seconds`. A day with only a session shows no gym time.

## Goal

`DashboardSummary` holds every value G3b shows: the gym time from `effectiveGymSeconds`,
today's finished workouts with their `sessionStats`, and the calorie goal, the walk goal,
the target weight and the gap to it.

## Decisions in this step

- `summarise` takes a 5th parameter, `lifts: TodayLifts = NO_LIFTS`. It **replaces** the C3
  parameter `sessions`. `lifts.sessions` holds the same week of sessions that C3 reads,
  and the week totals read `lifts.sessions`. Today's gym time and workouts filter
  `lifts.sessions` to today. The default keeps every call with 4 arguments valid.
- `useDashboard` keeps the C3 read of the week's sessions. It adds today's sets, plus the
  earlier sets of today's exercises for the records. It stays 1 live query, so a set
  added in `/workout` or a sync updates Today.
- A workout row is a finished, not-deleted session of today, oldest first. A running session
  gives gym time 0 (C2) and no row.
- `weightGapKg` is the distance from the latest weight to the target, always positive,
  rounded to 2 decimals. The words ("to go", "On target") are G3b's.
- If A1 wrapped `readDashboard` in `safeQuery`, keep that wrap.

## Do

1. Run the `test-writer` agent with the acceptance list. The tests come first.
2. `components/dashboard/summary.ts`:

   ```ts
   import { effectiveGymSeconds } from '../../lib/metrics/gymTime'
   import { roundTo2 } from '../../lib/metrics/round'
   import { sessionStats } from '../../lib/metrics/sessionStats'

   import type { DailyEntry, Profile, WorkoutSession, WorkoutSet } from '../../lib/db/dexie'
   import type { GymTimeSource } from '../../lib/metrics/gymTime'
   import type { SessionStats } from '../../lib/metrics/sessionStats'

   export type TodayLifts = {
     sessions: WorkoutSession[]
     sets: WorkoutSet[]
     earlierSets: WorkoutSet[]
   }

   export const NO_LIFTS: TodayLifts = { sessions: [], sets: [], earlierSets: [] }

   export type TodayWorkout = { session: WorkoutSession; stats: SessionStats }

   export type TodayGym = { seconds: number; source: GymTimeSource }

   export function todayWorkouts(lifts: TodayLifts, today: string): TodayWorkout[] {
     return lifts.sessions
       .filter(
         (session) =>
           session.entry_date === today && session.deleted_at === null && session.ended_at !== null,
       )
       .sort((left, right) => Date.parse(left.started_at) - Date.parse(right.started_at))
       .map((session) => ({
         session,
         stats: sessionStats(session, lifts.sets, lifts.earlierSets),
       }))
   }

   export function weightGap(latestKg: number | null, targetKg: number | null): number | null {
     return latestKg === null || targetKg === null ? null : roundTo2(Math.abs(latestKg - targetKg))
   }
   ```

   `DashboardSummary` gets:

   ```ts
   gym: TodayGym
   workouts: TodayWorkout[]
   calorieGoal: number | null
   walkGoalSeconds: number | null
   targetWeightKg: number | null
   weightGapKg: number | null
   ```

   `summarise(entries, profile, today, now, lifts = NO_LIFTS)` fills them, and the C3
   week line reads `lifts.sessions`:

   ```ts
   week: weekTotals(past, weekRange, lifts.sessions),
   gym: effectiveGymSeconds(
     entry,
     lifts.sessions.filter((session) => session.entry_date === today),
   ),
   workouts: todayWorkouts(lifts, today),
   calorieGoal: profile.calorie_goal ?? null,
   walkGoalSeconds: profile.walk_goal_seconds ?? null,
   targetWeightKg: profile.target_weight_kg,
   weightGapKg: weightGap(latest?.kg ?? null, profile.target_weight_kg),
   ```

   Keep every other field as it is. The goal columns are optional in the local `Profile`
   (D1), so each read uses `?? null`.

   In `summary.test.tsx`, change the C3 test "counts a finished session with no typed gym
   time in the week" to pass `{ ...NO_LIFTS, sessions: [sessionOn('2026-09-22')] }` as
   the 5th argument. Its expectation stays the same.

3. `components/dashboard/useDashboard.ts`, `readDashboard`:

   ```ts
   const week = weekOf(today)
   const [entries, profile, sessions, sets] = await Promise.all([
     listRange(HISTORY_START, today),
     getProfile(),
     listSessions(week.from, today),
     listSetsInRange(today, today),
   ])
   const earlierSets = await setsForExercises([...new Set(sets.map((set) => set.exercise_id))])

   return {
     status: 'ready',
     summary: summarise(entries, profile, today, now, { sessions, sets, earlierSets }),
   }
   ```

   Import `listSetsInRange` and `setsForExercises` from `../../lib/db/repository`.
   `listSessions` is already imported (C3). A failure in any read gives the
   same `READ_ERROR` state as today.

4. `components/dashboard/Dashboard.test.tsx`: the repository mock gets `listSessions` (if
   C3 did not add it), `listSetsInRange` and `setsForExercises` as `vi.fn()`, each
   resolved to `[]` in `beforeEach`. Without this, every Dashboard test falls into the
   error state.

## Acceptance criteria

- [ ] `summarise` with no lifts keeps every earlier field and gives gym `source: 'typed'` or `'none'`.
- [ ] Gym time comes from today's sessions when no gym time is typed, with `source: 'sessions'`.
- [ ] A typed gym time wins over the sessions.
- [ ] A session of another day adds nothing to today's gym time.
- [ ] `workouts` lists today's finished sessions oldest first, each with its `sessionStats`.
- [ ] `workouts` leaves out a running session and a soft-deleted session.
- [ ] A workout counts a new record against the earlier sets.
- [ ] The calorie goal, the walk goal and the target weight come from the profile.
- [ ] `weightGapKg` is the positive gap to the target, and null with no target or no weight.
- [ ] `useDashboard` keeps the C3 read of the week's sessions, and reads the sets of today
      only. Tests: "reads the sessions of the current week up to today" (C3) and "reads
      the sets of today only" in `useDashboard.test.tsx`.
- [ ] `useDashboard` reads the earlier sets of the exercises done today.
- [ ] A failed session read gives `READ_ERROR`.
- [ ] Every Dashboard test still passes.
- [ ] The C3 week totals still count a finished session with no typed gym time. Test:
      "counts a finished session with no typed gym time in the week" in
      `summary.test.tsx`, with `lifts` as its 5th argument.
- [ ] A session of an earlier day of this week counts in the week totals, but adds no
      workout row and no gym time to today. Test: "leaves out a session of another day"
      and "adds no session of another day to the gym time of today".
- [ ] A profile with no goal fields gives `calorieGoal: null` and `walkGoalSeconds: null`.
      Test: `it('has no goal for a profile with no goal field')` in `summary.test.tsx`.
- [ ] No visible screen changes. Manual check: `/` at 390 px looks the same as before this step.

## Tests

`components/dashboard/summary.test.tsx`, add:

```tsx
import { BENCH, liftSet, sessionOn } from '../../tests/fixtures/lifts'

import { NO_LIFTS, summarise, todayWorkouts, weightGap } from './summary'

describe('summarise for a full Today', () => {
  it('takes gym time from the sessions when none is typed', () => {
    const lifts = { ...NO_LIFTS, sessions: [sessionOn(TODAY)] }
    const entries = [entryOn(TODAY, { gym_seconds: null })]

    expect(summarise(entries, PROFILE, TODAY, NOW, lifts).gym).toEqual({
      seconds: 3600,
      source: 'sessions',
    })
  })

  it('keeps a typed gym time over the sessions', () => {
    const lifts = { ...NO_LIFTS, sessions: [sessionOn(TODAY)] }
    const entries = [entryOn(TODAY, { gym_seconds: 1200 })]

    expect(summarise(entries, PROFILE, TODAY, NOW, lifts).gym).toEqual({
      seconds: 1200,
      source: 'typed',
    })
  })

  it('adds no session of another day to the gym time of today', () => {
    const lifts = { ...NO_LIFTS, sessions: [sessionOn('2026-09-22')] }

    expect(summarise([], PROFILE, TODAY, NOW, lifts).gym.source).toBe('none')
  })

  it('has no gym time and no workout with no lifts', () => {
    const summary = summarise([], PROFILE, TODAY, NOW)

    expect([summary.gym, summary.workouts]).toEqual([{ seconds: 0, source: 'none' }, []])
  })

  it('takes the calorie goal, the walk goal and the target weight from the profile', () => {
    const profile = {
      ...PROFILE,
      calorie_goal: 800,
      walk_goal_seconds: 3600,
      target_weight_kg: 71.25,
    }
    const summary = summarise([entryOn(TODAY)], profile, TODAY, NOW)

    expect([summary.calorieGoal, summary.walkGoalSeconds, summary.targetWeightKg]).toEqual([
      800, 3600, 71.25,
    ])
  })

  it('has no goal for a profile with no goal field', () => {
    const summary = summarise([entryOn(TODAY)], PROFILE, TODAY, NOW)

    expect([summary.calorieGoal, summary.walkGoalSeconds]).toEqual([null, null])
  })

  it('measures the gap from the latest weight to the target', () => {
    const profile = { ...PROFILE, target_weight_kg: 71.25 }

    expect(summarise([entryOn(TODAY, { weight_kg: 73.65 })], profile, TODAY, NOW).weightGapKg).toBe(
      2.4,
    )
  })
})

describe('todayWorkouts', () => {
  const morning = sessionOn(TODAY, {
    id: '00000000-0000-4000-8000-0000000000e1',
    started_at: `${TODAY}T07:00:00.000Z`,
    ended_at: `${TODAY}T08:00:00.000Z`,
  })
  const evening = sessionOn(TODAY, {
    id: '00000000-0000-4000-8000-0000000000e2',
    started_at: `${TODAY}T18:00:00.000Z`,
    ended_at: `${TODAY}T18:30:00.000Z`,
  })

  it('lists the finished sessions of today oldest first, with their stats', () => {
    const sets = [liftSet(evening, BENCH, 10, 60)]
    const rows = todayWorkouts({ sessions: [evening, morning], sets, earlierSets: [] }, TODAY)

    expect(
      rows.map((row) => [row.session.id, row.stats.setCount, row.stats.durationSeconds]),
    ).toEqual([
      [morning.id, 0, 3600],
      [evening.id, 1, 1800],
    ])
  })

  it('leaves out a running session and a soft-deleted session', () => {
    const running = sessionOn(TODAY, { id: crypto.randomUUID(), status: 'active', ended_at: null })
    const removed = sessionOn(TODAY, {
      id: crypto.randomUUID(),
      deleted_at: `${TODAY}T20:00:00.000Z`,
    })

    expect(todayWorkouts({ ...NO_LIFTS, sessions: [running, removed] }, TODAY)).toEqual([])
  })

  it('leaves out a session of another day', () => {
    expect(todayWorkouts({ ...NO_LIFTS, sessions: [sessionOn('2026-09-22')] }, TODAY)).toEqual([])
  })

  it('counts a new record against the earlier sets', () => {
    const earlier = [liftSet(sessionOn('2026-09-20'), BENCH, 8, 60)]
    const sets = [liftSet(evening, BENCH, 5, 65)]
    const [row] = todayWorkouts({ sessions: [evening], sets, earlierSets: earlier }, TODAY)

    expect(row?.stats.newRecords).toEqual([{ exerciseId: BENCH, weightKg: 65, reps: 5 }])
  })
})

describe('weightGap', () => {
  it('is the positive gap to a lower target', () => {
    expect(weightGap(73.65, 71.25)).toBe(2.4)
  })

  it('is the positive gap to a higher target', () => {
    expect(weightGap(70, 72.5)).toBe(2.5)
  })

  it('is null with no target or no weight', () => {
    expect([weightGap(70, null), weightGap(null, 72)]).toEqual([null, null])
  })
})
```

`components/dashboard/useDashboard.test.tsx`: the mock and `beforeEach` gain the 2 new
reads. `listSessions` is there from C3. Keep the C3 test "reads the sessions of the
current week up to today".

```tsx
vi.mock('../../lib/db/repository', () => ({
  getProfile: vi.fn(),
  listRange: vi.fn(),
  listSessions: vi.fn(),
  listSetsInRange: vi.fn(),
  setsForExercises: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(listRange).mockResolvedValue([entryOn(TODAY)])
  vi.mocked(getProfile).mockResolvedValue(PROFILE)
  vi.mocked(listSessions).mockResolvedValue([])
  vi.mocked(listSetsInRange).mockResolvedValue([])
  vi.mocked(setsForExercises).mockResolvedValue([])
})
```

```tsx
it('reads the sets of today only', async () => {
  renderHook(() => useDashboard(clock))
  await waitFor(() => {
    expect(listSetsInRange).toHaveBeenCalledWith(TODAY, TODAY)
  })
})

it('reads the earlier sets of the exercises done today', async () => {
  const session = sessionOn(TODAY)
  vi.mocked(listSessions).mockResolvedValue([session])
  vi.mocked(listSetsInRange).mockResolvedValue([
    liftSet(session, BENCH, 10, 60),
    liftSet(session, BENCH, 8, 65),
  ])
  renderHook(() => useDashboard(clock))
  await waitFor(() => {
    expect(setsForExercises).toHaveBeenCalledWith([BENCH])
  })
})

it('builds the summary with the workouts of today', async () => {
  const session = sessionOn(TODAY)
  vi.mocked(listSessions).mockResolvedValue([session])
  const { result } = renderHook(() => useDashboard(clock))
  await waitFor(() => {
    expect(result.current.status).toBe('ready')
  })
  expect(
    result.current.status === 'ready' &&
      result.current.summary.workouts.map((row) => row.session.id),
  ).toEqual([session.id])
})

it('reports a failed session read in words', async () => {
  vi.mocked(listSessions).mockRejectedValue(new Error('blocked'))
  const { result } = renderHook(() => useDashboard(clock))
  await waitFor(() => {
    expect(result.current).toEqual({ status: 'error', message: READ_ERROR })
  })
})
```

Import `listSessions`, `listSetsInRange` and `setsForExercises` from the repository, and
`BENCH`, `liftSet` and `sessionOn` from `tests/fixtures/lifts`.

## Verification

1. `pnpm test:cov`. `components/**` stays above 85 lines and 75 branches.
2. `pnpm verify:parallel`. No screen changes, so no screenshot is needed.

## Files touched

- `components/dashboard/summary.ts` and its test
- `components/dashboard/useDashboard.ts` and its test
- `components/dashboard/Dashboard.test.tsx` (the mock only)

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer when
   another step runs its e2e suite. Never skip a check, and never add a design-check or
   test exemption to pass.
2. Stage the files of step 3 with the same `git add` line first. The skill describes the
   staged diff, and it refuses to run when nothing is staged. Then run the `commit-report`
   skill. This step changes no UI, so the report needs no screenshots.
3. Commit on `fix/g3a-today-data`:

   ```bash
   git add components/dashboard/summary.ts \
     components/dashboard/summary.test.tsx \
     components/dashboard/useDashboard.ts \
     components/dashboard/useDashboard.test.tsx \
     components/dashboard/Dashboard.test.tsx
   git commit -m "feat(ui): read the sessions and the goals of today for the dashboard"
   ```

   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.

4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked,
   and anything the owner must check on the iPhone.
