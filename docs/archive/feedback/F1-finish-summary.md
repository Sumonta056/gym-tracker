# Step F1 — The finish summary

**Branch:** `fix/f1-finish-summary`, in worktree `../gym-tracker-f1`, cut from `fix/feedback-fixes` ·
**Wave:** 7 · **Size:** M · **Depends on:** W0, B4, E3 · **Unlocks:** F2, G3a ·
**Skills to load:** `design-system` · **Agent to use:** `test-writer`, then `ui-reviewer`

## Before you start

1. Make the worktree:

   ```bash
   cd /Users/cefalo_1/Documents/Projects/gym-tracker
   git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-f1 -b fix/f1-finish-summary fix/feedback-fixes
   cd ../gym-tracker-f1
   cp ../gym-tracker/.env.local ../gym-tracker/.env.test.local .
   export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"
   pnpm install
   ```

   If you are already in that worktree on that branch, skip this block.

2. Dependency checks. Run them from the worktree root. Each line prints `FAIL` and the
   step name when that step is not in `fix/feedback-fixes`:

   ```bash
   test -f scripts/e2e-lock.mjs || echo "FAIL W0: scripts/e2e-lock.mjs is missing"
   grep -qs "export const SAVED_MESSAGE" components/ui/Toast.tsx || echo "FAIL B4: SAVED_MESSAGE is missing in components/ui/Toast.tsx"
   grep -qs "const leave = " components/workout/LiveSession.tsx || echo "FAIL B4: leave() is missing in components/workout/LiveSession.tsx"
   test ! -f components/workout/GymTimeOffer.tsx || echo "FAIL E3: components/workout/GymTimeOffer.tsx still exists"
   ```

   If any check fails, the step it names is not merged into `fix/feedback-fixes`. Stop. Report which
   check failed. Do not do that step's work here.

3. Already done check:

   ```bash
   test -f lib/metrics/sessionStats.ts && echo "F1 is already done"
   ```

   If it prints, stop and report.

## Names this step uses from earlier steps

- B4, `components/ui/Toast.tsx`: `export const SAVED_MESSAGE = 'Saved'`,
  `export const TOAST_MS = 2000`,
  `export function useToast(): { show: (message: string) => void }`.
- B4, `components/workout/LiveSession.tsx`: `export const WORKOUTS_PATH = '/workouts'`, the
  prop `onFinished?: () => void`, and the local `const leave = () => { ... }`. `leave`
  calls `onFinished()` when the prop is given, else `router.push(WORKOUTS_PATH)`.
  `components/workout/LiveSession.test.tsx` mocks `next/navigation` with a `router.push` spy.
- E3: the gym time offer is gone. `components/workout/GymTimeOffer.tsx` and `GymTimeSheet`
  no longer exist.
- Existing code: `personalRecords(sets)` in `lib/metrics/personalRecords.ts`, which gives
  `bestLoad` per exercise id. `volumeLoad(sets)` in `lib/metrics/volumeLoad.ts`.
  `sessionOn`, `liftSet`, `BENCH` and `LEG` in `tests/fixtures/lifts.ts`.

## Context to read first

1. This file. The "Do" section holds the full `sessionStats` signature and its types. Use them exactly.
2. `docs/specs/2026-10-05-feedback-fixes-design.md`, item 4.
3. `.claude/rules/testing.md` — `lib/metrics/**` is test first, 100 percent lines.
4. `lib/metrics/personalRecords.ts` — `personalRecords` gives the best earlier load. Reuse it.
5. `lib/metrics/volumeLoad.ts` — `volumeLoad`. Reuse it for the volume.
6. `components/workout/LiveSession.tsx` — `finish` and the sheets at the end of the JSX.
7. `components/ui/SheetModal.tsx` — after B3 it renders through a portal. Its close button reads `Close <title>`.
8. `lib/format/weight.ts` — `toDisplayWeight`, `weightSymbol`, `formatLoadShort`.
9. `docs/plan/phase-3/S3.9-session-done.md` — Phase 3 builds a plan "Session done" screen later. Read "Things to consider" at the end of this step.

## State before the step

- After B4, `LiveSession` has a `leave()` function: it calls `onFinished` when the prop is
  given, else `router.push(WORKOUTS_PATH)`. `finish` calls `finishSession` and then `leave()`.
- After E3, the gym time offer and `GymTimeSheet` are gone. Nothing shows what the session did.
- `isNewRecord` in `personalRecords.ts` marks a set as a record against every earlier set,
  also the earlier sets of the same session. The live `PR` badge uses it.

## Goal

Every successful Finish shows a summary sheet: the duration, the sets, the exercises, the
volume in the display unit and the new records. `Done` goes to `/workouts`.

## Decisions in this step

- **A new record** is the heaviest set of an exercise in this session when its weight is
  strictly above the best load of that exercise **before this session**. The best load comes
  from `personalRecords` over the earlier sets. 1 record per exercise at most.
- An exercise done for the first time gives no record. This is the same as the live badge,
  which also needs an earlier set.
- An earlier set counts only when it belongs to another session and its time
  (`completed_at ?? created_at`) is before `session.started_at`. So F2 can pass every set
  of the exercise, also from later sessions, and the answer stays right for an old session.
- Reps do not make a record. A rep record at the same weight is not a weight record. The
  record row shows the reps of the heavy set, for example `102.5 kg × 3`.
- A session with no `ended_at` has a duration of 0. A broken row with `ended_at` before
  `started_at` also gives 0, never a negative.

## Do

1. Run the `test-writer` agent with the acceptance list below. Paste the test file in
   "Tests" as the start. The tests come first and fail.
2. `lib/metrics/sessionStats.ts`:

   ```ts
   import { personalRecords } from './personalRecords'
   import { volumeLoad } from './volumeLoad'

   import type { WorkoutSession, WorkoutSet } from '../db/dexie'

   export type SessionRecord = { exerciseId: string; weightKg: number; reps: number }

   export type SessionStats = {
     durationSeconds: number
     setCount: number
     exerciseCount: number
     volumeKg: number
     newRecords: SessionRecord[]
   }

   type Weighted = WorkoutSet & { weight_kg: number }

   const MS_PER_SECOND = 1000

   function durationOf(session: WorkoutSession): number {
     if (session.ended_at === null) {
       return 0
     }

     const span = Date.parse(session.ended_at) - Date.parse(session.started_at)

     return Math.max(0, Math.round(span / MS_PER_SECOND))
   }

   function doneAt(set: WorkoutSet): number {
     return Date.parse(set.completed_at ?? set.created_at)
   }

   function isWeighted(set: WorkoutSet): set is Weighted {
     return set.weight_kg !== null
   }

   function heaviest(sets: readonly Weighted[]): Weighted | undefined {
     let best: Weighted | undefined

     for (const set of sets) {
       if (best === undefined || set.weight_kg > best.weight_kg) {
         best = set
       }
     }

     return best
   }

   function newRecords(
     session: WorkoutSession,
     live: readonly WorkoutSet[],
     earlierSets: readonly WorkoutSet[],
   ): SessionRecord[] {
     const start = Date.parse(session.started_at)
     const before = earlierSets.filter(
       (set) => set.session_id !== session.id && doneAt(set) < start,
     )
     const best = personalRecords(before)
     const exerciseIds = [...new Set(live.map((set) => set.exercise_id))]

     return exerciseIds.flatMap((exerciseId) => {
       const earlierBest = best[exerciseId]?.bestLoad ?? null
       const top = heaviest(live.filter((set) => set.exercise_id === exerciseId).filter(isWeighted))

       if (earlierBest === null || top === undefined || top.weight_kg <= earlierBest.weightKg) {
         return []
       }

       return [{ exerciseId, weightKg: top.weight_kg, reps: top.reps }]
     })
   }

   export function sessionStats(
     session: WorkoutSession,
     sets: WorkoutSet[],
     earlierSets: WorkoutSet[],
   ): SessionStats {
     const live = sets.filter((set) => set.session_id === session.id && set.deleted_at === null)

     return {
       durationSeconds: durationOf(session),
       setCount: live.length,
       exerciseCount: new Set(live.map((set) => set.exercise_id)).size,
       volumeKg: volumeLoad(live),
       newRecords: newRecords(session, live, earlierSets),
     }
   }
   ```

3. `components/workout/SessionSummary.tsx`, a sheet built on `SheetModal`:

   ```tsx
   'use client'

   import { formatDuration } from '../../lib/duration'
   import { formatLoadShort, toDisplayWeight, weightSymbol } from '../../lib/format/weight'
   import { formatCount } from '../dashboard/summary'
   import { Card } from '../ui/Card'
   import { MicroLabel } from '../ui/MicroLabel'
   import { PrimaryButton } from '../ui/PrimaryButton'
   import { SheetModal } from '../ui/SheetModal'

   import type { SessionRecord, SessionStats } from '../../lib/metrics/sessionStats'
   import type { UnitSystem } from '../../lib/schema/profile'

   export const SUMMARY_TITLE = 'Session done'

   export const NO_RECORD = 'No new record this time.'

   export type SummaryCell = { label: string; value: string }

   export function summaryCells(stats: SessionStats, unit: UnitSystem): SummaryCell[] {
     return [
       { label: 'sets', value: String(stats.setCount) },
       { label: 'exercises', value: String(stats.exerciseCount) },
       {
         label: `volume (${weightSymbol(unit)})`,
         value: formatCount(Math.round(toDisplayWeight(stats.volumeKg, unit))),
       },
     ]
   }

   export function recordText(record: SessionRecord, unit: UnitSystem): string {
     return `${formatLoadShort(record.weightKg, unit)} ${weightSymbol(unit)} × ${String(record.reps)}`
   }

   export type SessionSummaryProps = {
     stats: SessionStats | null
     unit: UnitSystem
     nameOf: (exerciseId: string) => string
     onDone: () => void
   }

   export function SessionSummary({ stats, unit, nameOf, onDone }: SessionSummaryProps) {
     return (
       <SheetModal open={stats !== null} title={SUMMARY_TITLE} onClose={onDone}>
         {stats === null ? null : (
           <div className="flex flex-col gap-3">
             <div>
               <MicroLabel as="p">Duration</MicroLabel>
               <p className="text-text mt-1 text-[48px] leading-none font-extrabold tracking-[-2.4px]">
                 {formatDuration(stats.durationSeconds, 'clock')}
               </p>
             </div>

             <dl className="grid grid-cols-3 gap-3">
               {summaryCells(stats, unit).map((cell) => (
                 <div key={cell.label} className="flex min-w-0 flex-col-reverse">
                   <dt className="text-muted text-xs">{cell.label}</dt>
                   <dd className="text-text text-[19px] leading-tight font-bold tracking-[-0.6px] break-words">
                     {cell.value}
                   </dd>
                 </div>
               ))}
             </dl>

             <Card>
               <h3>
                 <MicroLabel>New records</MicroLabel>
               </h3>
               {stats.newRecords.length === 0 ? (
                 <p className="text-muted mt-1.5 text-sm">{NO_RECORD}</p>
               ) : (
                 <ul className="mt-1.5">
                   {stats.newRecords.map((record) => (
                     <li
                       key={record.exerciseId}
                       className="border-border flex min-h-11 items-center justify-between gap-3 border-b last:border-b-0"
                     >
                       <span className="text-muted min-w-0 text-sm break-words">
                         {nameOf(record.exerciseId)}
                       </span>
                       <strong className="text-accent shrink-0 text-sm">
                         {recordText(record, unit)}
                       </strong>
                     </li>
                   ))}
                 </ul>
               )}
             </Card>

             <PrimaryButton onClick={onDone}>Done</PrimaryButton>
           </div>
         )}
       </SheetModal>
     )
   }
   ```

   The record weight uses `text-accent` and sits next to the exercise name in words, so
   color is not the only signal.

4. `components/workout/LiveSession.tsx`:
   - Add `const [summary, setSummary] = useState<SessionStats | null>(null)`.
   - `finish` keeps `busy` true on success and opens the summary instead of leaving:

     ```ts
     source.finishSession(session.id).then(
       (finished) => {
         setSummary(sessionStats(finished, sets, history))
       },
       (cause: unknown) => {
         setBusy(false)
         setError(failure(cause, FINISH_FAILED))
       },
     )
     ```

     `history` already holds every live set of the exercises in this session, from
     `setsForExercises`. `sessionStats` drops this session's own sets from it.

   - Render the sheet next to the other sheets:

     ```tsx
     <SessionSummary
       stats={summary}
       unit={unit}
       nameOf={(id) => nameOf(id)?.name ?? 'Unknown exercise'}
       onDone={leave}
     />
     ```

   - Delete `finishSummary` if E3 left it with no caller. Keep `heroFooter` and `volumeText`.
5. Add `SessionSummary` to `/styleguide` with a sample: 1:12:05, 18 sets, 4 exercises,
   3,420 kg, 1 record.
6. The prototype: replace the content of plate `p8` with the summary sheet, and rename it
   `Finish summary`. If E3 already renamed `p8`, edit it in place. Keep the route `/workout`.
7. `tests/e2e/workout.spec.ts`, the test "keeps every set of a session logged offline
   through a finish and a reload": after Finish, expect the dialog `Session done` to
   contain `1,440` and `sets3`, then click `Done`, then expect the URL to end in `/workouts`:

   ```ts
   await page.getByRole('button', { name: 'Finish session' }).click()
   const done = page.getByRole('dialog', { name: 'Session done' })
   await expect(done).toContainText('sets3')
   await expect(done).toContainText('1,440')
   await done.getByRole('button', { name: 'Done' }).click()
   await expect(page).toHaveURL(/\/workouts$/)
   ```

## Acceptance criteria

- [ ] `sessionStats` counts the seconds from `started_at` to `ended_at`.
- [ ] `sessionStats` counts 0 seconds for a session with no `ended_at`.
- [ ] `sessionStats` never returns a negative duration.
- [ ] `sessionStats` of an empty session is 0 sets, 0 exercises, 0 volume and no record.
- [ ] `sessionStats` counts the live sets and the distinct exercises.
- [ ] `sessionStats` ignores a soft-deleted set and a set of another session.
- [ ] `sessionStats` volume equals `volumeLoad` for the same sets.
- [ ] A body-weight set adds 0 volume and still counts as a set.
- [ ] A new record names the heaviest set that beats the best earlier weight, 1 per exercise.
- [ ] An exercise done for the first time gives no record.
- [ ] A weight equal to the earlier best gives no record.
- [ ] An earlier set from a later session, a soft-deleted earlier set and this session's
      own sets in the earlier list do not count.
- [ ] Earlier sets that are all body weight give no record. A body-weight set today gives no record.
- [ ] Every successful Finish opens the `Session done` sheet. No path skips it.
- [ ] The sheet shows the duration, the sets, the exercises, the volume and the records.
- [ ] The volume shows in pounds for an imperial profile.
- [ ] `Done`, and the sheet close button, call `leave()` once: `onFinished` when given,
      else `router.push('/workouts')`. Nothing navigates before.
- [ ] A failed Finish shows the error, keeps the Finish button and opens no sheet.
      Test: "says so when the session cannot be finished, and stays" in
      `LiveSession.test.tsx`.
- [ ] The 2 old `LiveSession` tests "finishes the session and hands back to the caller"
      and "returns to the workouts screen after Finish by default" click `Done` first,
      and pass. The B4 `router.push(WORKOUTS_PATH)` path still works.
- [ ] The e2e test "keeps every set of a session logged offline through a finish and a
      reload" in `tests/e2e/workout.spec.ts` sees `Session done` with `sets3` and
      `1,440`, clicks `Done` and lands on `/workouts`, offline.
- [ ] `/styleguide` shows `SessionSummary` with the sample 1:12:05, 18 sets,
      4 exercises, 3,420 kg and 1 record. Test: `app/styleguide/page.test.tsx`.
- [ ] Plate `p8` in the prototype is named `Finish summary` and shows the sheet. Manual
      check: the `ui-reviewer` agent reports no drift.
- [ ] `lib/metrics/sessionStats.ts` is at 100 % lines and functions in `pnpm test:cov`.

## Tests

`lib/metrics/sessionStats.test.ts`, written first:

```ts
import { describe, expect, it } from 'vitest'

import { BENCH, LEG, liftSet, sessionOn } from '../../tests/fixtures/lifts'

import { sessionStats } from './sessionStats'
import { volumeLoad } from './volumeLoad'

const TODAY = sessionOn('2026-09-23')
const EARLIER = sessionOn('2026-09-20')
const LATER = sessionOn('2026-09-25')
const DELETED = '2026-09-23T12:30:00.000Z'

describe('sessionStats', () => {
  it('counts the seconds from the start to the end', () => {
    expect(sessionStats(TODAY, [], []).durationSeconds).toBe(3600)
  })

  it('counts 0 seconds for a session that has not ended', () => {
    const running = sessionOn('2026-09-23', { ended_at: null, status: 'active' })

    expect(sessionStats(running, [], []).durationSeconds).toBe(0)
  })

  it('never counts a negative duration', () => {
    const broken = sessionOn('2026-09-23', { ended_at: '2026-09-23T11:00:00.000Z' })

    expect(sessionStats(broken, [], []).durationSeconds).toBe(0)
  })

  it('returns 0 sets, 0 exercises, 0 volume and no record for an empty session', () => {
    expect(sessionStats(TODAY, [], [])).toEqual({
      durationSeconds: 3600,
      setCount: 0,
      exerciseCount: 0,
      volumeKg: 0,
      newRecords: [],
    })
  })

  it('counts the live sets and the distinct exercises', () => {
    const sets = [
      liftSet(TODAY, BENCH, 10, 60),
      liftSet(TODAY, BENCH, 8, 65),
      liftSet(TODAY, LEG, 12, 120),
    ]

    expect(sessionStats(TODAY, sets, [])).toMatchObject({ setCount: 3, exerciseCount: 2 })
  })

  it('ignores a soft-deleted set', () => {
    const sets = [
      liftSet(TODAY, BENCH, 10, 60),
      liftSet(TODAY, LEG, 10, 100, { deleted_at: DELETED }),
    ]

    expect(sessionStats(TODAY, sets, [])).toMatchObject({
      setCount: 1,
      exerciseCount: 1,
      volumeKg: 600,
    })
  })

  it('ignores a set of another session', () => {
    const sets = [liftSet(TODAY, BENCH, 10, 60), liftSet(EARLIER, BENCH, 10, 80)]

    expect(sessionStats(TODAY, sets, [])).toMatchObject({ setCount: 1, volumeKg: 600 })
  })

  it('equals volumeLoad for the same sets', () => {
    const sets = [liftSet(TODAY, BENCH, 10, 60), liftSet(TODAY, BENCH, 8, 65)]

    expect(sessionStats(TODAY, sets, []).volumeKg).toBe(volumeLoad(sets))
  })

  it('adds 0 volume for a body-weight set and still counts it', () => {
    const sets = [liftSet(TODAY, BENCH, 15, null)]

    expect(sessionStats(TODAY, sets, [])).toMatchObject({ setCount: 1, volumeKg: 0 })
  })

  it('names a new record when the heaviest set beats the best earlier weight', () => {
    const earlier = [liftSet(EARLIER, BENCH, 8, 60)]
    const sets = [liftSet(TODAY, BENCH, 6, 62.5)]

    expect(sessionStats(TODAY, sets, earlier).newRecords).toEqual([
      { exerciseId: BENCH, weightKg: 62.5, reps: 6 },
    ])
  })

  it('gives 1 record per exercise, at its heaviest set', () => {
    const earlier = [liftSet(EARLIER, BENCH, 8, 60)]
    const sets = [
      liftSet(TODAY, BENCH, 6, 62.5),
      liftSet(TODAY, BENCH, 4, 65),
      liftSet(TODAY, BENCH, 8, 61),
    ]

    expect(sessionStats(TODAY, sets, earlier).newRecords).toEqual([
      { exerciseId: BENCH, weightKg: 65, reps: 4 },
    ])
  })

  it('names no record for an exercise done for the first time', () => {
    const sets = [liftSet(TODAY, BENCH, 5, 40), liftSet(TODAY, BENCH, 5, 50)]

    expect(sessionStats(TODAY, sets, []).newRecords).toEqual([])
  })

  it('names no record when the heaviest set only equals the earlier best', () => {
    const earlier = [liftSet(EARLIER, BENCH, 8, 60)]
    const sets = [liftSet(TODAY, BENCH, 12, 60)]

    expect(sessionStats(TODAY, sets, earlier).newRecords).toEqual([])
  })

  it('ignores an earlier-list set that comes from a later session', () => {
    const earlier = [liftSet(EARLIER, BENCH, 8, 60), liftSet(LATER, BENCH, 3, 100)]
    const sets = [liftSet(TODAY, BENCH, 6, 62.5)]

    expect(sessionStats(TODAY, sets, earlier).newRecords).toEqual([
      { exerciseId: BENCH, weightKg: 62.5, reps: 6 },
    ])
  })

  it('ignores a soft-deleted earlier set', () => {
    const earlier = [
      liftSet(EARLIER, BENCH, 3, 70, { deleted_at: '2026-09-21T08:00:00.000Z' }),
      liftSet(EARLIER, BENCH, 8, 60),
    ]
    const sets = [liftSet(TODAY, BENCH, 5, 65)]

    expect(sessionStats(TODAY, sets, earlier).newRecords).toEqual([
      { exerciseId: BENCH, weightKg: 65, reps: 5 },
    ])
  })

  it('ignores the sets of this session inside the earlier list', () => {
    const sets = [liftSet(TODAY, BENCH, 5, 60), liftSet(TODAY, BENCH, 5, 62.5)]

    expect(sessionStats(TODAY, sets, sets).newRecords).toEqual([])
  })

  it('names no record when every earlier set was body weight', () => {
    const earlier = [liftSet(EARLIER, BENCH, 15, null)]
    const sets = [liftSet(TODAY, BENCH, 10, 20)]

    expect(sessionStats(TODAY, sets, earlier).newRecords).toEqual([])
  })

  it('names no record for a body-weight set today', () => {
    const earlier = [liftSet(EARLIER, BENCH, 8, 60)]
    const sets = [liftSet(TODAY, BENCH, 15, null)]

    expect(sessionStats(TODAY, sets, earlier).newRecords).toEqual([])
  })
})
```

`components/workout/SessionSummary.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { BENCH } from '../../tests/fixtures/lifts'

import {
  NO_RECORD,
  recordText,
  SessionSummary,
  summaryCells,
  SUMMARY_TITLE,
} from './SessionSummary'

import type { SessionStats } from '../../lib/metrics/sessionStats'

const STATS: SessionStats = {
  durationSeconds: 4325,
  setCount: 18,
  exerciseCount: 4,
  volumeKg: 3420,
  newRecords: [{ exerciseId: BENCH, weightKg: 102.5, reps: 3 }],
}

function renderSummary(stats: SessionStats | null = STATS, unit: 'metric' | 'imperial' = 'metric') {
  const onDone = vi.fn()
  render(<SessionSummary stats={stats} unit={unit} nameOf={() => 'Bench press'} onDone={onDone} />)
  return onDone
}

describe('summaryCells', () => {
  it('writes the sets, the exercises and the volume in kilograms', () => {
    expect(summaryCells(STATS, 'metric')).toEqual([
      { label: 'sets', value: '18' },
      { label: 'exercises', value: '4' },
      { label: 'volume (kg)', value: '3,420' },
    ])
  })

  it('writes the volume in pounds for imperial', () => {
    expect(summaryCells(STATS, 'imperial')[2]).toEqual({ label: 'volume (lb)', value: '7,540' })
  })
})

describe('recordText', () => {
  it('writes the weight in the display unit and the reps', () => {
    expect(recordText({ exerciseId: BENCH, weightKg: 102.5, reps: 3 }, 'metric')).toBe(
      '102.5 kg × 3',
    )
  })
})

describe('SessionSummary', () => {
  it('shows no sheet before a finish', () => {
    renderSummary(null)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the duration, the cells and the record', () => {
    renderSummary()
    const sheet = screen.getByRole('dialog', { name: SUMMARY_TITLE })
    expect(sheet).toHaveTextContent('1:12:05')
    expect(sheet).toHaveTextContent('sets18')
    expect(sheet).toHaveTextContent('Bench press102.5 kg × 3')
  })

  it('says so when the session set no record', () => {
    renderSummary({ ...STATS, newRecords: [] })
    expect(screen.getByText(NO_RECORD)).toBeVisible()
  })

  it('calls onDone once from the Done button', async () => {
    const onDone = renderSummary()
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('calls onDone from the close button', async () => {
    const onDone = renderSummary()
    await userEvent.click(screen.getByRole('button', { name: `Close ${SUMMARY_TITLE}` }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
```

Check `7,540`: 3420 / 0.45359237 = 7539.8, rounded 7,540.

`components/workout/LiveSession.test.tsx`: add this block, and change the 2 old tests
"finishes the session and hands back to the caller" and "returns to the workouts screen
after Finish by default" so they click `Done` before they expect `onFinished` or the push.

```tsx
describe('the summary after Finish', () => {
  const START = '2026-09-01T17:30:00.000Z'
  const END = '2026-09-01T18:42:05.000Z'

  async function finishWithOneSet(props: Parameters<typeof LiveSession>[0] = {}) {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(START))
    const session = await startSession('2026-09-01')
    vi.setSystemTime(new Date(END))
    await addSet({
      session_id: session.id,
      exercise_id: BENCH_ID,
      reps: 3,
      weight_kg: 102.5,
      completed_at: END,
    })
    const view = await renderLive(props)
    await userEvent.click(screen.getByRole('button', { name: 'Finish session' }))
    return view
  }

  it('opens the summary with the duration, the sets and the volume', async () => {
    await finishWithOneSet()
    const sheet = await screen.findByRole('dialog', { name: 'Session done' })
    expect(sheet).toHaveTextContent('1:12:05')
    expect(sheet).toHaveTextContent('sets1')
    expect(sheet).toHaveTextContent('exercises1')
    expect(sheet).toHaveTextContent('volume (kg)308')
  })

  it('names a set heavier than every earlier session as a new record', async () => {
    await db.workoutSets.put(pastSet({ exercise_id: BENCH_ID, weight_kg: 100, reps: 5 }))
    await finishWithOneSet()
    const sheet = await screen.findByRole('dialog', { name: 'Session done' })
    expect(sheet).toHaveTextContent('Bench Press102.5 kg × 3')
  })

  it('shows the volume in pounds for an imperial profile', async () => {
    await updateProfile({ unit_system: 'imperial' })
    await finishWithOneSet()
    const sheet = await screen.findByRole('dialog', { name: 'Session done' })
    expect(sheet).toHaveTextContent('volume (lb)678')
  })

  it('waits for Done before it hands back to the caller', async () => {
    const { onFinished } = await finishWithOneSet()
    await screen.findByRole('dialog', { name: 'Session done' })
    expect(onFinished).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onFinished).toHaveBeenCalledTimes(1)
  })

  it('hands back once when the sheet is closed', async () => {
    const { onFinished } = await finishWithOneSet()
    await screen.findByRole('dialog', { name: 'Session done' })
    await userEvent.click(screen.getByRole('button', { name: 'Close Session done' }))
    expect(onFinished).toHaveBeenCalledTimes(1)
  })
})
```

Check the numbers: 3 × 102.5 = 307.5, rounded 308. In pounds 307.5 / 0.45359237 = 677.9,
rounded 678. `pastSet` is dated `2026-09-01T10:00`, before `START`, in another session.

B4 mocks `next/navigation` in this file with a `router.push` spy. The B4 test that expects
`router.push(WORKOUTS_PATH)` after Finish must now click `Done` first.

Keep the existing test "says so when the session cannot be finished, and stays", and add
`expect(screen.queryByRole('dialog', { name: 'Session done' })).toBeNull()` to it.

## Verification

1. `pnpm test:cov`. `lib/metrics/sessionStats.ts` is at 100 lines and 100 functions. `lib/metrics/**`
   stays at 95 branches or more.
2. The `ui-reviewer` agent reports no drift against plate `p8`.
3. Check `/workout` at 390 px, 768 px and 1440 px with the sheet open. The `Done` button
   stays above the keyboard area and the tab bar.
4. `pnpm verify:parallel`.

## Files touched

- `lib/metrics/sessionStats.ts` and its test
- `components/workout/SessionSummary.tsx` and its test
- `components/workout/LiveSession.tsx` and its test
- `app/styleguide/page.tsx` and its test
- `docs/design/prototype/index.html` (plate `p8`)
- `tests/e2e/workout.spec.ts`

## Things to consider

Name this in the commit report. It is an open owner decision for later, not a reason
to stop.

`docs/plan/phase-3/S3.9-session-done.md` builds `PlanSessionDone` for a plan session. When
Phase 3 starts, 3.9 must:

- Reuse `sessionStats` and `SessionSummary` (or its `summaryCells`) for the hero numbers,
  and add only the step card. Keep 1 summary per Finish, not 2.
- Drop its line "The Phase 2 gym time offer, unchanged". E3 removed the offer.

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer when
   another step runs its e2e suite. Never skip a check, and never add a design-check or
   test exemption to pass.
2. Stage the files of step 3 with the same `git add` line first. The skill describes the
   staged diff, and it refuses to run when nothing is staged. Then run the `commit-report`
   skill.
   The report needs screenshots of every changed page at 390, 768 and 1440 px, next
   to the matching prototype plate.
3. Commit on `fix/f1-finish-summary`:

   ```bash
   git add lib/metrics/sessionStats.ts \
     lib/metrics/sessionStats.test.ts \
     components/workout/SessionSummary.tsx \
     components/workout/SessionSummary.test.tsx \
     components/workout/LiveSession.tsx \
     components/workout/LiveSession.test.tsx \
     app/styleguide/page.tsx \
     app/styleguide/page.test.tsx \
     docs/design/prototype/index.html \
     tests/e2e/workout.spec.ts
   git commit -m "feat(ui): show a session summary after every finish"
   ```

   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.

4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked,
   and anything the owner must check on the iPhone.
