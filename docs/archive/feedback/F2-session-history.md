# Step F2 — `/workouts` history and the session detail

**Branch:** `fix/f2-session-history`, in worktree `../gym-tracker-f2`, cut from `fix/feedback-fixes` ·
**Wave:** 8 · **Size:** M · **Depends on:** W0, F1, E4 (and A1 for `safeQuery`) ·
**Unlocks:** G3b (its workout card links here) · **Skills to load:** `design-system`,
`add-screen` · **Agent to use:** `test-writer`, then `ui-reviewer`

## Before you start

1. Make the worktree:

   ```bash
   cd /Users/cefalo_1/Documents/Projects/gym-tracker
   git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-f2 -b fix/f2-session-history fix/feedback-fixes
   cd ../gym-tracker-f2
   cp ../gym-tracker/.env.local ../gym-tracker/.env.test.local .
   export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"
   pnpm install
   ```

   If you are already in that worktree on that branch, skip this block.

2. Dependency checks. Run them from the worktree root. Each line prints `FAIL` and the
   step name when that step is not in `fix/feedback-fixes`:

   ```bash
   test -f scripts/e2e-lock.mjs || echo "FAIL W0: scripts/e2e-lock.mjs is missing"
   grep -qs "export function safeQuery" lib/db/safeQuery.ts || echo "FAIL A1: safeQuery is missing in lib/db/safeQuery.ts"
   grep -qs "export function sessionStats" lib/metrics/sessionStats.ts || echo "FAIL F1: sessionStats is missing in lib/metrics/sessionStats.ts"
   grep -qs "export function summaryCells" components/workout/SessionSummary.tsx || echo "FAIL F1: summaryCells is missing in components/workout/SessionSummary.tsx"
   grep -qs "export function parseLogDate" lib/format/logDate.ts || echo "FAIL E4: parseLogDate is missing in lib/format/logDate.ts"
   grep -qsF '/^date$/' app/sw.ts || echo "FAIL E4: app/sw.ts does not ignore the date parameter"
   ```

   If any check fails, the step it names is not merged into `fix/feedback-fixes`. Stop. Report which
   check failed. Do not do that step's work here.

3. Already done check:

   ```bash
   test -f components/workouts/WorkoutHistory.tsx && echo "F2 is already done"
   ```

   If it prints, stop and report.

## Names this step uses from earlier steps

- A1, `lib/db/safeQuery.ts`:
  `export function safeQuery<T>(query: () => Promise<T>, source: string): () => Promise<T | null>`.
  A failed read resolves to `null` and is written to the local error log.
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

  It keeps only the live sets of `session` from `sets`. It drops this session's own sets,
  and every set done after `session.started_at`, from `earlierSets`.

- F1, `components/workout/SessionSummary.tsx`:
  `export function summaryCells(stats: SessionStats, unit: UnitSystem): { label: string; value: string }[]`
  (labels `sets`, `exercises`, `volume (kg)` or `volume (lb)`) and
  `export function recordText(record: SessionRecord, unit: UnitSystem): string`
  (for example `102.5 kg × 3`).
- E4, `app/sw.ts`: `precacheOptions.ignoreURLParametersMatching` holds
  `[/^utm_/, /^fbclid$/, /^date$/]`. This step adds `/^session$/`.
- Existing code: `prettyDate(date)` in `components/DailyEntryForm.tsx`, `startedText(startedAt)`
  in `components/workout/SessionTimer.tsx`, `formatCount` in `components/dashboard/summary.ts`.

## Context to read first

1. This file. "Names this step uses from earlier steps" holds `sessionStats` and the
   F1 helpers. The route is `/workouts?session=<uuid>`. An unknown id shows the list
   with a note.
2. `docs/specs/2026-10-05-feedback-fixes-design.md`, item 4, and section 4: "Phase 3 keeps
   its plan. Its step 3.7 already plans `/workouts`. F11 builds the history list there, and
   3.7 adds the plan picker above it."
3. `app/(app)/workouts/page.tsx` and its test — the launcher and the placeholder text.
4. `lib/db/repository.ts` — `listSessions`, `listSets`, `listSetsInRange`, `setsForExercises`,
   `byStart` and `inDoneOrder`.
5. `lib/db/safeQuery.ts` from A1 — every `useLiveQuery` in a new hook goes through it.
6. `components/workout/SessionSummary.tsx` from F1 — `summaryCells` and `recordText`.
7. `app/sw.ts`. E4 added `precacheOptions.ignoreURLParametersMatching` with `/^date$/`, so
   `/log?date=…` reads the precached `/log` HTML. This step adds `/^session$/` to that list.
8. `docs/plan/phase-3/S3.7-choose-plan.md` — read "Things to consider" at the end of this step.

## State before the step

- `/workouts` shows the heading, a placeholder line "The live workout log arrives in
  Phase 2…", and the `Start a session` or `Resume` button.
- No screen lists a finished session. The repository has no read for 1 session by id, no
  read of finished sessions across all dates and no read of the sets of many sessions.

## Goal

`/workouts` lists the finished sessions, newest first. A tap on a row opens its detail at
`/workouts?session=<id>`, with no network, on the same route.

## Decisions in this step

- **No dynamic segment.** The detail is a query string on the static `/workouts` page. Phase 3
  adds `/workouts/[planId]` with `generateStaticParams`; that is a different path and does
  not clash.
- **No server round trip.** A row is a real `<a href="/workouts?session=<id>">`. A plain
  left click calls `window.history.pushState`, which Next.js 15 syncs with
  `useSearchParams`. So the soft navigation fetches nothing, and it works offline. A
  middle click or a modifier click keeps the browser default.
- **Paging by a growing limit.** `listFinishedSessions(limit)` returns the newest `limit`
  sessions and `hasMore`. "Show more" adds 30 to the limit. A cursor (`before`) is not
  needed: 1 person's log holds hundreds of sessions, and Dexie reads them in a few ms.
  The live query then also re-reads all shown rows after a sync, with no cursor drift.
- An unknown or soft-deleted id shows the list with the note `That session is not on this
device.` An id of the running session shows the list with the note `That session is
still running. Resume it above.`
- The list counts with `sessionStats(session, sets, [])`. The detail passes the earlier
  sets too, so it can show the new records.

## Do

1. Run the `test-writer` agent with the acceptance list. The tests come first.
2. `lib/db/repository.ts`, 3 reads. Dexie only. No outbox.

   ```ts
   export type FinishedSessionsPage = { sessions: WorkoutSession[]; hasMore: boolean }

   export async function listFinishedSessions(limit: number): Promise<FinishedSessionsPage> {
     const rows = await db.workoutSessions.where('status').equals('finished').toArray()
     const live = rows
       .filter((row) => row.deleted_at === null && row.ended_at !== null)
       .sort((left, right) => byStart(right, left))

     return { sessions: live.slice(0, limit), hasMore: live.length > limit }
   }

   export async function getSession(id: string): Promise<WorkoutSession | undefined> {
     const row = await db.workoutSessions.get(id)

     return row === undefined || row.deleted_at !== null ? undefined : row
   }

   export async function listSetsForSessions(sessionIds: string[]): Promise<WorkoutSet[]> {
     if (sessionIds.length === 0) {
       return []
     }

     const rows = await db.workoutSets.where('session_id').anyOf(sessionIds).toArray()

     return rows.filter((row) => row.deleted_at === null).sort(inDoneOrder)
   }
   ```

   Place them after `listSetsInRange`, so `byStart` and `inDoneOrder` are declared above.
   The `status` index already exists in Dexie. No version bump.

3. `components/workouts/historyText.ts`, the text helpers:

   ```ts
   import { formatDuration } from '../../lib/duration'
   import { formatLoadShort, toDisplayWeight, weightSymbol } from '../../lib/format/weight'
   import { formatCount } from '../dashboard/summary'
   import { prettyDate } from '../DailyEntryForm'
   import { startedText } from '../workout/SessionTimer'

   import type { WorkoutSession, WorkoutSet } from '../../lib/db/dexie'
   import type { SessionStats } from '../../lib/metrics/sessionStats'
   import type { UnitSystem } from '../../lib/schema/profile'

   export const WORKOUTS_PATH = '/workouts'

   export function sessionPath(id: string): string {
     return `${WORKOUTS_PATH}?session=${encodeURIComponent(id)}`
   }

   function plural(count: number, word: string): string {
     return `${String(count)} ${word}${count === 1 ? '' : 's'}`
   }

   export function volumeDisplay(kg: number, unit: UnitSystem): string {
     return `${formatCount(Math.round(toDisplayWeight(kg, unit)))} ${weightSymbol(unit)}`
   }

   export function rowTitle(session: WorkoutSession): string {
     return `${prettyDate(session.entry_date)} · ${startedText(session.started_at)}`
   }

   export function rowLine(stats: SessionStats, unit: UnitSystem): string {
     return `${formatDuration(stats.durationSeconds, 'short')} · ${plural(stats.setCount, 'set')} · ${volumeDisplay(stats.volumeKg, unit)}`
   }

   export function setText(set: WorkoutSet, unit: UnitSystem): string {
     if (set.weight_kg === null) {
       return plural(set.reps, 'rep')
     }

     return `${String(set.reps)} × ${formatLoadShort(set.weight_kg, unit)} ${weightSymbol(unit)}`
   }

   export type ExerciseGroup = { exerciseId: string; sets: WorkoutSet[] }

   export function byExercise(sets: readonly WorkoutSet[]): ExerciseGroup[] {
     const groups = new Map<string, WorkoutSet[]>()

     for (const set of sets) {
       groups.set(set.exercise_id, [...(groups.get(set.exercise_id) ?? []), set])
     }

     return [...groups].map(([exerciseId, grouped]) => ({ exerciseId, sets: grouped }))
   }
   ```

4. `components/workouts/useWorkoutHistory.ts`, the reads and 2 hooks:

   ```ts
   'use client'

   import { useLiveQuery } from 'dexie-react-hooks'

   import {
     getProfile,
     getSession,
     listExercises,
     listFinishedSessions,
     listSets,
     listSetsForSessions,
     setsForExercises,
   } from '../../lib/db/repository'
   import { safeQuery } from '../../lib/db/safeQuery'
   import { sessionStats } from '../../lib/metrics/sessionStats'

   import type { Exercise, WorkoutSession, WorkoutSet } from '../../lib/db/dexie'
   import type { SessionStats } from '../../lib/metrics/sessionStats'
   import type { UnitSystem } from '../../lib/schema/profile'

   export const HISTORY_PAGE = 30

   export type HistoryRow = { session: WorkoutSession; stats: SessionStats }

   export type HistoryList = { rows: HistoryRow[]; hasMore: boolean; unit: UnitSystem }

   export type FoundSession = {
     status: 'found'
     session: WorkoutSession
     sets: WorkoutSet[]
     stats: SessionStats
     exercises: ReadonlyMap<string, Exercise>
     unit: UnitSystem
   }

   export type SessionView = { status: 'missing' } | { status: 'running' } | FoundSession

   export async function readHistory(limit: number): Promise<HistoryList> {
     const [page, profile] = await Promise.all([listFinishedSessions(limit), getProfile()])
     const sets = await listSetsForSessions(page.sessions.map((session) => session.id))

     return {
       rows: page.sessions.map((session) => ({ session, stats: sessionStats(session, sets, []) })),
       hasMore: page.hasMore,
       unit: profile.unit_system,
     }
   }

   export async function readSession(id: string): Promise<SessionView> {
     const session = await getSession(id)

     if (session === undefined) {
       return { status: 'missing' }
     }

     if (session.status !== 'finished') {
       return { status: 'running' }
     }

     const [sets, catalogue, profile] = await Promise.all([
       listSets(id),
       listExercises({ includeArchived: true }),
       getProfile(),
     ])
     const earlier = await setsForExercises([...new Set(sets.map((set) => set.exercise_id))])

     return {
       status: 'found',
       session,
       sets,
       stats: sessionStats(session, sets, earlier),
       exercises: new Map(catalogue.map((exercise) => [exercise.id, exercise])),
       unit: profile.unit_system,
     }
   }

   export function useHistory(limit: number): HistoryList | null | undefined {
     return useLiveQuery(
       safeQuery(() => readHistory(limit), 'workouts'),
       [limit],
     )
   }

   export function useSessionView(id: string): SessionView | null | undefined {
     return useLiveQuery(
       safeQuery(() => readSession(id), 'workouts'),
       [id],
     )
   }
   ```

   `undefined` means still reading. `null` means the read failed; `safeQuery` has already
   written it to the error log.

5. `components/workouts/HistoryLink.tsx`:

   ```tsx
   'use client'

   import type { MouseEvent, ReactNode } from 'react'

   export type HistoryLinkProps = { href: string; className?: string; children: ReactNode }

   export function followsInPlace(event: MouseEvent<HTMLAnchorElement>): boolean {
     return (
       event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
     )
   }

   export function HistoryLink({ href, className, children }: HistoryLinkProps) {
     return (
       <a
         href={href}
         className={className}
         onClick={(event) => {
           if (followsInPlace(event)) {
             event.preventDefault()
             window.history.pushState(null, '', href)
           }
         }}
       >
         {children}
       </a>
     )
   }
   ```

6. `components/workouts/SessionList.tsx`: a `section` labelled by the micro label
   `History`. The note, when set, is a `p` with `role="status"` in `text-text`. Each row is
   a `HistoryLink` styled as a card: `bg-surface border-border rounded-card flex min-h-11
w-full flex-col gap-1 border p-4 text-left`, with `rowTitle` in `strong` and `rowLine`
   in `text-muted text-sm`. The list is `grid grid-cols-1 gap-3 md:grid-cols-2
lg:grid-cols-3`. With no row: `No finished session yet. Start one above.` With
   `hasMore`: a `SecondaryButton` `Show more` that calls `onMore`.

   ```ts
   export const EMPTY_HISTORY = 'No finished session yet. Start one above.'
   export type SessionListProps = { list: HistoryList; note: string | null; onMore: () => void }
   ```

7. `components/workouts/SessionDetail.tsx`, props `{ view: FoundSession }`:
   - A `HistoryLink` to `WORKOUTS_PATH`: `<span aria-hidden="true">‹</span> All sessions`,
     `text-accent inline-flex min-h-11 items-center self-start text-[15px] font-bold`.
   - An `h2` with `rowTitle(session)`.
   - A `Card` with a `dl`: `duration` → `formatDuration(stats.durationSeconds, 'short')`,
     then the 3 cells of `summaryCells(stats, unit)`. Same `dt` and `dd` classes as F1.
   - When `stats.newRecords` is not empty: a `Card` `New records`, 1 row per record,
     the name and `recordText(record, unit)`, as in F1.
   - 1 `Card` per exercise from `byExercise(sets)`, with `role="region"` and `aria-label`
     set to the exercise name (`Unknown exercise` when the catalogue lacks it). An `h3`
     with the name. An `ol` of rows, each `Set <n>` and `setText(set, unit)`, `min-h-11`.
     The cards sit in `grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3`.

8. `components/workouts/WorkoutHistory.tsx`:

   ```tsx
   'use client'

   import { useSearchParams } from 'next/navigation'
   import { useState } from 'react'

   import { SessionDetail } from './SessionDetail'
   import { SessionList } from './SessionList'
   import { HISTORY_PAGE, useHistory, useSessionView } from './useWorkoutHistory'

   export const UNKNOWN_SESSION = 'That session is not on this device.'

   export const RUNNING_SESSION = 'That session is still running. Resume it above.'

   export const HISTORY_READ_FAILED = 'The sessions on this device could not be read.'

   function Reading() {
     return (
       <p role="status" className="text-muted mt-6 text-sm">
         Reading this device…
       </p>
     )
   }

   function Failed() {
     return (
       <p role="alert" className="text-danger mt-6 text-sm">
         {HISTORY_READ_FAILED}
       </p>
     )
   }

   function HistorySection({ note }: { note: string | null }) {
     const [limit, setLimit] = useState(HISTORY_PAGE)
     const list = useHistory(limit)

     if (list === undefined) return <Reading />
     if (list === null) return <Failed />

     return (
       <SessionList
         list={list}
         note={note}
         onMore={() => {
           setLimit((held) => held + HISTORY_PAGE)
         }}
       />
     )
   }

   function SessionSection({ id }: { id: string }) {
     const view = useSessionView(id)

     if (view === undefined) return <Reading />
     if (view === null) return <Failed />
     if (view.status === 'found') return <SessionDetail view={view} />

     return <HistorySection note={view.status === 'missing' ? UNKNOWN_SESSION : RUNNING_SESSION} />
   }

   export function WorkoutHistory() {
     const id = useSearchParams().get('session')

     return id === null || id === '' ? <HistorySection note={null} /> : <SessionSection id={id} />
   }
   ```

9. `app/(app)/workouts/page.tsx`: delete the placeholder paragraph. Keep the micro label,
   the `h1` and `SessionLauncher` at the top. Below it render
   `<Suspense fallback={null}><WorkoutHistory /></Suspense>`. `useSearchParams` in a
   statically rendered page needs that `Suspense`, or `next build` fails.
10. `app/sw.ts`: add `/^session$/` to the list E4 made, so a cold load of
    `/workouts?session=<id>` reads the precached `/workouts` HTML:

    ```ts
    precacheOptions: {
      ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^date$/, /^session$/],
    },
    ```

    `app/sw.ts` is in the `EXEMPT` list. The e2e test below proves this line.

11. `/styleguide`: a `SessionList` sample with 2 rows and `Show more`, and a
    `SessionDetail` sample with 2 exercises.
12. The prototype: 2 new plates after `p11`. `12` "Workouts history", route `/workouts`:
    the launcher, then the `History` list with 3 rows and `Show more`. `12b` "Session
    detail", route `/workouts?session=…`: the back link, the date, the stats card, 1
    record, 2 exercise cards.

## Acceptance criteria

- [ ] `listFinishedSessions` returns finished sessions newest first.
- [ ] `listFinishedSessions` hides an active session and a soft-deleted session.
- [ ] `listFinishedSessions` returns at most `limit` rows and sets `hasMore` only when more exist.
- [ ] `getSession` returns a live session, and `undefined` for an unknown or soft-deleted id.
- [ ] `listSetsForSessions` returns the live sets of the named sessions in done order, and `[]` for no id.
- [ ] `rowLine` writes `1h 12m · 18 sets · 3,420 kg`, and pounds for imperial.
- [ ] `setText` writes `10 × 60 kg`, and `15 reps` for a body-weight set.
- [ ] `byExercise` keeps the first-seen exercise order and the set order inside each.
- [ ] `/workouts` with no query lists the sessions, newest first, under `History`.
- [ ] `Show more` appears only with more than 30 sessions, and shows the next 30.
- [ ] A plain click on a row calls `history.pushState` with `/workouts?session=<id>`. A
      modifier click does not.
- [ ] `?session=<id>` of a finished session shows its exercises and their sets.
- [ ] `?session=` of an unknown id shows the list with `That session is not on this device.`
- [ ] `?session=` of the running session shows the list with the running note.
- [ ] A failed read shows `The sessions on this device could not be read.`
- [ ] `Start a session` or `Resume` stays at the top in every state.
- [ ] With no network after the first visit, a row opens its detail, and a reload of the
      detail URL shows it again (Chromium; WebKit blocks the service worker in the suite).
- [ ] Every row, the back link and `Show more` are 44 px or taller.
      Test: `tests/e2e/responsive.spec.ts` on `/workouts`, and the `min-h-11` checks in
      `SessionList.test.tsx`.
- [ ] The detail shows the new records card only when F1's `sessionStats` names a
      record from the earlier sets. Test: `SessionDetail.test.tsx`.
- [ ] `app/sw.ts` holds `/^date$/` from E4 and `/^session$/` from this step. Test: the
      offline reload in `tests/e2e/workout.spec.ts`.
- [ ] The F1 finish flow still passes: `Session done`, then `Done`, then `/workouts`
      with the new row `3 sets · 1,440 kg`. Test: "keeps every set of a session logged
      offline through a finish and a reload" in `tests/e2e/workout.spec.ts`.
- [ ] `/styleguide` shows a `SessionList` and a `SessionDetail` sample. Test:
      `app/styleguide/page.test.tsx`.
- [ ] Plates `12` and `12b` exist in the prototype. Manual check: the `ui-reviewer`
      agent reports no drift.
- [ ] No file under `app/` or `components/` imports `@supabase/*` or `lib/sync/**`.
      Test: `pnpm lint`.

## Tests

`lib/db/repository.test.ts`, add to the import list `getSession`, `listFinishedSessions`
and `listSetsForSessions`, then after `describe('listSetsInRange')`:

```ts
describe('listFinishedSessions', () => {
  it('returns the finished sessions newest first', async () => {
    const old = storedSession({ entry_date: '2026-09-02', started_at: '2026-09-02T17:00:00.000Z' })
    const recent = storedSession({
      entry_date: '2026-09-09',
      started_at: '2026-09-09T07:00:00.000Z',
    })
    await db.workoutSessions.bulkPut([old, recent])

    expect((await listFinishedSessions(30)).sessions.map((row) => row.id)).toEqual([
      recent.id,
      old.id,
    ])
  })

  it('hides an active session and a soft-deleted session', async () => {
    const kept = storedSession({})
    await db.workoutSessions.bulkPut([
      kept,
      storedSession({ status: 'active', ended_at: null }),
      storedSession({ deleted_at: '2026-09-03T10:00:00.000Z' }),
    ])

    expect(await listFinishedSessions(30)).toEqual({ sessions: [kept], hasMore: false })
  })

  it('returns at most the limit and says that more exist', async () => {
    await db.workoutSessions.bulkPut([
      storedSession({ started_at: '2026-09-02T17:00:00.000Z' }),
      storedSession({ started_at: '2026-09-03T17:00:00.000Z' }),
      storedSession({ started_at: '2026-09-04T17:00:00.000Z' }),
    ])

    const page = await listFinishedSessions(2)

    expect([page.sessions.length, page.hasMore]).toEqual([2, true])
  })
})

describe('getSession', () => {
  it('returns a live session by id', async () => {
    const session = storedSession({})
    await db.workoutSessions.put(session)

    expect(await getSession(session.id)).toEqual(session)
  })

  it('returns undefined for an unknown id', async () => {
    expect(await getSession(crypto.randomUUID())).toBeUndefined()
  })

  it('returns undefined for a soft-deleted session', async () => {
    const removed = storedSession({ deleted_at: '2026-09-03T10:00:00.000Z' })
    await db.workoutSessions.put(removed)

    expect(await getSession(removed.id)).toBeUndefined()
  })
})

describe('listSetsForSessions', () => {
  it('returns the live sets of the named sessions in the order they were done', async () => {
    const one = storedSession({})
    const other = storedSession({})
    const second = storedSet({ session_id: one.id, completed_at: '2026-09-02T17:20:00.000Z' })
    const first = storedSet({ session_id: other.id, completed_at: '2026-09-02T17:10:00.000Z' })
    await db.workoutSets.bulkPut([
      second,
      first,
      storedSet({ session_id: one.id, deleted_at: '2026-09-02T18:00:00.000Z' }),
      storedSet({}),
    ])

    expect((await listSetsForSessions([one.id, other.id])).map((row) => row.id)).toEqual([
      first.id,
      second.id,
    ])
  })

  it('returns an empty list for no session', async () => {
    await db.workoutSets.put(storedSet({}))

    expect(await listSetsForSessions([])).toEqual([])
  })
})
```

`components/workouts/historyText.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { BENCH, LEG, liftSet, sessionOn } from '../../tests/fixtures/lifts'
import { startedText } from '../workout/SessionTimer'

import { byExercise, rowLine, rowTitle, sessionPath, setText } from './historyText'

import type { SessionStats } from '../../lib/metrics/sessionStats'

const STATS: SessionStats = {
  durationSeconds: 4325,
  setCount: 18,
  exerciseCount: 4,
  volumeKg: 3420,
  newRecords: [],
}

const SESSION = sessionOn('2026-09-01')

describe('sessionPath', () => {
  it('puts the id in the session query', () => {
    expect(sessionPath('abc')).toBe('/workouts?session=abc')
  })
})

describe('rowTitle', () => {
  it('writes the date and the start time', () => {
    expect(rowTitle(SESSION)).toBe(`Tue 1 Sep · ${startedText(SESSION.started_at)}`)
  })
})

describe('rowLine', () => {
  it('writes the duration, the sets and the volume in kilograms', () => {
    expect(rowLine(STATS, 'metric')).toBe('1h 12m · 18 sets · 3,420 kg')
  })

  it('writes 1 set and the volume in pounds', () => {
    expect(rowLine({ ...STATS, setCount: 1 }, 'imperial')).toBe('1h 12m · 1 set · 7,540 lb')
  })
})

describe('setText', () => {
  it('writes the reps and the load', () => {
    expect(setText(liftSet(SESSION, BENCH, 10, 60), 'metric')).toBe('10 × 60 kg')
  })

  it('writes the reps alone for a body-weight set', () => {
    expect(setText(liftSet(SESSION, BENCH, 15, null), 'metric')).toBe('15 reps')
  })
})

describe('byExercise', () => {
  it('keeps the first-seen exercise order and the set order inside each', () => {
    const a = liftSet(SESSION, BENCH, 10, 60)
    const b = liftSet(SESSION, LEG, 12, 100)
    const c = liftSet(SESSION, BENCH, 8, 65)

    expect(byExercise([a, b, c])).toEqual([
      { exerciseId: BENCH, sets: [a, c] },
      { exerciseId: LEG, sets: [b] },
    ])
  })
})
```

`components/workouts/HistoryLink.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { HistoryLink } from './HistoryLink'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('HistoryLink', () => {
  it('is a real link to its address', () => {
    render(<HistoryLink href="/workouts?session=abc">Open</HistoryLink>)
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      '/workouts?session=abc',
    )
  })

  it('moves in place with pushState on a plain click', () => {
    const push = vi.spyOn(window.history, 'pushState')
    render(<HistoryLink href="/workouts?session=abc">Open</HistoryLink>)
    fireEvent.click(screen.getByRole('link', { name: 'Open' }))
    expect(push).toHaveBeenCalledWith(null, '', '/workouts?session=abc')
  })

  it('leaves a modifier click to the browser', () => {
    const push = vi.spyOn(window.history, 'pushState')
    render(<HistoryLink href="/workouts?session=abc">Open</HistoryLink>)
    fireEvent.click(screen.getByRole('link', { name: 'Open' }), { metaKey: true })
    expect(push).not.toHaveBeenCalled()
  })
})
```

`components/workouts/WorkoutHistory.test.tsx`. Real Dexie, as in the page test:

```tsx
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../../lib/db/dexie'
import { BENCH, EXERCISES, LEG, liftSet, sessionOn } from '../../tests/fixtures/lifts'

import {
  HISTORY_READ_FAILED,
  RUNNING_SESSION,
  UNKNOWN_SESSION,
  WorkoutHistory,
} from './WorkoutHistory'

let search = new URLSearchParams()

const failing = vi.hoisted(() => ({ history: false }))

vi.mock('../../lib/db/repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/db/repository')>()
  return {
    ...actual,
    listFinishedSessions: (limit: number) =>
      failing.history ? Promise.reject(new Error('blocked')) : actual.listFinishedSessions(limit),
  }
})

vi.mock('next/navigation', () => ({
  useSearchParams: () => search,
}))

vi.mock('../../lib/supabase/client', () => ({
  createClient: () => {
    throw new Error('no network in a component test')
  },
}))

function dayOf(index: number): string {
  return new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10)
}

beforeEach(async () => {
  search = new URLSearchParams()
  failing.history = false
  await db.open()
  await Promise.all([
    db.workoutSessions.clear(),
    db.workoutSets.clear(),
    db.exercises.clear(),
    db.outbox.clear(),
  ])
  await db.exercises.bulkPut(EXERCISES)
})

describe('WorkoutHistory', () => {
  it('lists the finished sessions newest first', async () => {
    const old = sessionOn('2026-09-01')
    const recent = sessionOn('2026-09-08')
    await db.workoutSessions.bulkPut([old, recent])
    await db.workoutSets.bulkPut([liftSet(recent, BENCH, 10, 60), liftSet(recent, BENCH, 8, 65)])
    render(<WorkoutHistory />)

    const history = await screen.findByRole('region', { name: 'History' })
    const rows = within(history).getAllByRole('link')
    expect(rows[0]).toHaveTextContent('Tue 8 Sep')
    expect(rows[0]).toHaveTextContent('1h · 2 sets · 1,120 kg')
    expect(rows[1]).toHaveTextContent('Tue 1 Sep')
  })

  it('shows the next 30 sessions only after Show more', async () => {
    await db.workoutSessions.bulkPut(
      Array.from({ length: 31 }, (_, index) => sessionOn(dayOf(index))),
    )
    render(<WorkoutHistory />)

    await screen.findByRole('region', { name: 'History' })
    expect(screen.getAllByRole('link')).toHaveLength(30)
    await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
    await waitFor(() => {
      expect(screen.getAllByRole('link')).toHaveLength(31)
    })
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull()
  })

  it('shows the exercises and the sets of the session in the query', async () => {
    const session = sessionOn('2026-09-08')
    await db.workoutSessions.put(session)
    await db.workoutSets.bulkPut([liftSet(session, BENCH, 10, 60), liftSet(session, LEG, 12, 100)])
    search = new URLSearchParams({ session: session.id })
    render(<WorkoutHistory />)

    expect(await screen.findByRole('region', { name: 'Bench press' })).toHaveTextContent(
      'Set 110 × 60 kg',
    )
    expect(screen.getByRole('region', { name: 'Leg press' })).toHaveTextContent('Set 112 × 100 kg')
    expect(screen.getByRole('link', { name: 'All sessions' })).toHaveAttribute('href', '/workouts')
  })

  it('shows the list with a note for an unknown id', async () => {
    await db.workoutSessions.put(sessionOn('2026-09-08'))
    search = new URLSearchParams({ session: crypto.randomUUID() })
    render(<WorkoutHistory />)

    expect(await screen.findByText(UNKNOWN_SESSION)).toHaveAttribute('role', 'status')
    expect(screen.getByRole('region', { name: 'History' })).toBeInTheDocument()
  })

  it('shows the list with a note for the running session', async () => {
    const running = sessionOn('2026-09-08', { status: 'active', ended_at: null })
    await db.workoutSessions.put(running)
    search = new URLSearchParams({ session: running.id })
    render(<WorkoutHistory />)

    expect(await screen.findByText(RUNNING_SESSION)).toBeVisible()
  })

  it('says so when the device cannot be read', async () => {
    failing.history = true
    render(<WorkoutHistory />)

    expect(await screen.findByRole('alert')).toHaveTextContent(HISTORY_READ_FAILED)
  })
})
```

`components/workouts/SessionList.test.tsx` and `SessionDetail.test.tsx`: render each with a
fixed `HistoryList` or `FoundSession` value. Prove the empty text, the note with
`role="status"`, the `min-h-11` class on each row, the record card only when a record
exists, and `Unknown exercise` for an id not in the catalogue.

`app/(app)/workouts/page.test.tsx`:

- Add `vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))`.
- Delete "keeps the rest of the placeholder".
- Add `it('shows the history under the launcher')`: render the page and expect
  `await screen.findByRole('region', { name: 'History' })`.

`tests/e2e/workout.spec.ts`, in "keeps every set of a session logged offline through a
finish and a reload", after the reload:

```ts
const row = page.getByRole('link', { name: /3 sets · 1,440 kg/ })
await expect(row).toBeVisible()
await row.click()
await expect(page).toHaveURL(/\/workouts\?session=/)
const bench = page.getByRole('region', { name: 'Bench Press' })
await expect(bench).toContainText('8 × 60 kg')

if (trulyOffline) {
  await page.reload()
  await expect(page.getByRole('region', { name: 'Bench Press' })).toContainText('8 × 60 kg')
}
```

## Verification

1. `pnpm test:cov`. `lib/**` and `components/**` stay above their floors.
2. The `ui-reviewer` agent reports no drift against plates `12` and `12b`.
3. Check `/workouts` and `/workouts?session=<id>` at 390 px, 768 px and 1440 px.
4. `pnpm verify:parallel`.

## Files touched

- `lib/db/repository.ts` and its test
- `components/workouts/historyText.ts` and its test
- `components/workouts/useWorkoutHistory.ts` and its test
- `components/workouts/HistoryLink.tsx` and its test
- `components/workouts/SessionList.tsx` and its test
- `components/workouts/SessionDetail.tsx` and its test
- `components/workouts/WorkoutHistory.tsx` and its test
- `app/(app)/workouts/page.tsx` and its test
- `app/sw.ts`
- `app/styleguide/page.tsx` and its test
- `docs/design/prototype/index.html` (plates `12` and `12b`)
- `tests/e2e/workout.spec.ts`

## Things to consider

Name these in the commit report. They are notes for later, not a reason to stop.

- `historyText.ts` exports its own `WORKOUTS_PATH`, and `LiveSession.tsx` exports one
  too. Both are `'/workouts'`. Import the one in `LiveSession.tsx` if the linter or a
  reviewer flags the duplicate.

Owner decision still open, for Phase 3. S3.7 puts the plan picker above this history.

`docs/plan/phase-3/S3.7-choose-plan.md` rebuilds `/workouts`. When Phase 3 starts, 3.7 must:

- Put `SuggestedPlanHero`, the `PlanCard`s and the Start bar **above** the
  `<Suspense><WorkoutHistory /></Suspense>` block. Keep the history under them.
- Replace `SessionLauncher` with the Start bar, and keep its `Resume` path.
- Keep `?session=` on `/workouts`. `/workouts/[planId]` is a separate path and does not clash.

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer when
   another step runs its e2e suite. Never skip a check, and never add a design-check or
   test exemption to pass.
2. Stage the files of step 3 with the same `git add` line first. The skill describes the
   staged diff, and it refuses to run when nothing is staged. Then run the `commit-report`
   skill.
   The report needs screenshots of every changed page at 390, 768 and 1440 px, next
   to the matching prototype plate.
3. Commit on `fix/f2-session-history`:

   ```bash
   git add lib/db/repository.ts \
     lib/db/repository.test.ts \
     components/workouts/historyText.ts \
     components/workouts/historyText.test.ts \
     components/workouts/useWorkoutHistory.ts \
     components/workouts/useWorkoutHistory.test.ts \
     components/workouts/HistoryLink.tsx \
     components/workouts/HistoryLink.test.tsx \
     components/workouts/SessionList.tsx \
     components/workouts/SessionList.test.tsx \
     components/workouts/SessionDetail.tsx \
     components/workouts/SessionDetail.test.tsx \
     components/workouts/WorkoutHistory.tsx \
     components/workouts/WorkoutHistory.test.tsx \
     'app/(app)/workouts/page.tsx' \
     'app/(app)/workouts/page.test.tsx' \
     app/sw.ts \
     app/styleguide/page.tsx \
     app/styleguide/page.test.tsx \
     docs/design/prototype/index.html \
     tests/e2e/workout.spec.ts
   git commit -m "feat(ui): list past sessions on workouts with a session detail"
   ```

   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.

4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked,
   and anything the owner must check on the iPhone.
