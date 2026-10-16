# Step C3 — Session gaps from all history, one meaning of "session"

**Branch:** `fix/c3-session-gaps`, in worktree `../gym-tracker-c3`, cut from `fix/feedback-fixes` ·
**Wave:** 2 · **Size:** S · **Depends on:** W0, C1, C2 · **Unlocks:** C4, G3a, H1, I1 ·
**Agent to use:** `test-writer`, then `ui-reviewer`
**Items:** 12, 9 · **Skills to load:** `design-system`

## Before you start

### The worktree

```bash
cd /Users/cefalo_1/Documents/Projects/gym-tracker
git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-c3 -b fix/c3-session-gaps fix/feedback-fixes
cd ../gym-tracker-c3
cp ../gym-tracker/.env.local ../gym-tracker/.env.test.local .
export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"
pnpm install
```

If you are already in that worktree on that branch, skip this block. Run every command
below from the worktree root. Each new shell needs the `export PATH` line again before
`pnpm`.

### Dependency checks

Each line prints `FAIL` and the step name when that step is not merged into `fix/feedback-fixes`.

```bash
{ test -f scripts/e2e-lock.mjs && grep -q '"verify:parallel"' package.json; } || echo "FAIL: W0 is not merged (no scripts/e2e-lock.mjs or no verify:parallel script)"
{ grep -q "export const LineDrawContext" components/charts/useLineDraw.ts && grep -q "export function entriesIn" components/charts/useAnalytics.ts; } || echo "FAIL: C1 is not merged (no LineDrawContext or entriesIn)"
{ grep -q "export function effectiveGymSeconds" lib/metrics/gymTime.ts && grep -q "export function hasSession" lib/metrics/gymTime.ts; } || echo "FAIL: C2 is not merged (no effectiveGymSeconds or hasSession in lib/metrics/gymTime.ts)"
echo "Dependency checks finished."
```

If any check fails, the step it names is not merged into `fix/feedback-fixes`. Stop. Report which check
failed. Do not do that step's work here.

### Already done check

```bash
test -f lib/metrics/sessionDays.ts && echo "DONE: C3 is already on this branch"
```

If it passes, stop and report.

## Stop and ask the owner

This step meets an open owner decision. Ask it before you write any code:

> The spec, section 3.3, lists the Streak heat map with the session rule. This step keeps
> the Streak heat map and `lib/metrics/streak` on logged days (a day with any entry), and
> moves only the gap chart and the totals to session days. Keep the heat map on logged
> days, or move it to session days?

Stop, report the question, and wait for the answer. Do not choose. If the message that
gave you this file already answers it, follow that answer and quote it in the report.
If the owner picks session days, stop again and report that this step file needs a new
section for the heat map before the work can start.

## Context to read first

1. `.claude/rules/testing.md` — `lib/metrics/**` is test first.
2. `docs/specs/2026-10-05-feedback-fixes-design.md`, sections 3.2 and 3.3, item 12.
3. `lib/metrics/gymTime.ts` from C2 — `effectiveGymSeconds` and `hasSession`.
4. `lib/metrics/weekTotals.ts` and `lib/metrics/sessionGaps.ts`.
5. `components/charts/rangeData.ts` — `analyse`, `DayPoint`, `AnalyticsData`.
6. `components/charts/useAnalytics.ts` as C1 left it.
7. `components/charts/WeekCharts.tsx` and `components/charts/SessionGapChart.tsx`.
8. `components/dashboard/summary.ts` and `components/dashboard/useDashboard.ts`.
9. `tests/fixtures/lifts.ts` — `sessionOn` makes a 1 hour finished session.

## Names this step uses from earlier steps

From C2, `lib/metrics/gymTime.ts`:

```ts
export type GymTimeSource = 'typed' | 'sessions' | 'none'
export function effectiveGymSeconds(
  entry: Pick<DailyEntry, 'gym_seconds'> | undefined,
  sessions: Pick<WorkoutSession, 'entry_date' | 'started_at' | 'ended_at' | 'deleted_at'>[],
): { seconds: number; source: GymTimeSource }
export function hasSession(
  entry: Pick<DailyEntry, 'gym_seconds'> | undefined,
  sessions: Pick<WorkoutSession, 'entry_date' | 'started_at' | 'ended_at' | 'deleted_at'>[],
): boolean
```

- A typed `gym_seconds`, also a typed `0`, wins with source `'typed'`.
- A session counts when `ended_at !== null && deleted_at === null`.
- `sessions` holds the sessions of 1 `entry_date` only. The caller groups them.
- If C2 made the arrays `readonly`, read the merged file and match it.

From C1, `components/charts/useAnalytics.ts`:

- `useAnalytics(tab: RangeTab, clock?: () => Date): AnalyticsState` reads
  `Promise.all([listRange(HISTORY_START, HISTORY_END), getProfile()])` once, into
  `Source = { history, profile, today, now }`. A tab switch is a `useMemo` over it.
- `entriesIn(history, tab, today)` and `READ_ERROR` are exported.

Before this step: `listSessions(from: string, to: string): Promise<WorkoutSession[]>` in
`lib/db/repository.ts`, and `sessionOn(date)` in `tests/fixtures/lifts.ts`. The Stats
screen lives at the route `/analytics`.

## State before the step

- `WeekCharts` passes `rowDates(days)` to `SessionGapChart`. `days` holds only the
  dates of the open tab. So the Week tab sees at most 7 days, and a gap that starts
  last week is lost.
- `rowDates` counts every logged row as a session, also a day with only steps.
- `weekTotals` counts a session only from a typed `gym_seconds > 0`. A day with a
  finished workout and no typed gym time shows 0 sessions and 0 gym time.
- So the gap chart and the Totals card disagree on what a session is.

## Goal

A day "has a session" when `hasSession` says so. The gap chart reads every session
day in the whole history. The Totals card on Today, the Totals chart on Stats and the
gap chart use the same rule. Gym time in the totals and the daily bars comes from
`effectiveGymSeconds`.

The streak heat map keeps its meaning: a day with any entry. It is titled "Streak",
and `lib/metrics/streak` counts logged days. C4 only labels it.

## Do

1. Run the `test-writer` agent with the `lib/metrics` criteria below. Those tests come
   first.
2. Create `lib/metrics/sessionDays.ts`:

   ```ts
   import { hasSession } from './gymTime'

   import type { DailyEntry, WorkoutSession } from '../db/dexie'

   export type SessionRow = Pick<
     WorkoutSession,
     'entry_date' | 'started_at' | 'ended_at' | 'deleted_at'
   >

   type DayRow = Pick<DailyEntry, 'entry_date' | 'gym_seconds'>

   export function sessionsByDate<Row extends SessionRow>(
     sessions: readonly Row[],
   ): Map<string, Row[]> {
     const byDate = new Map<string, Row[]>()

     for (const session of sessions) {
       byDate.set(session.entry_date, [...(byDate.get(session.entry_date) ?? []), session])
     }

     return byDate
   }

   export function sessionDays(rows: readonly DayRow[], sessions: readonly SessionRow[]): string[] {
     const entries = new Map(rows.map((row) => [row.entry_date, row]))
     const byDate = sessionsByDate(sessions)
     const dates = new Set([...entries.keys(), ...byDate.keys()])

     return [...dates]
       .filter((date) => hasSession(entries.get(date), byDate.get(date) ?? []))
       .sort()
   }
   ```

3. `lib/metrics/weekTotals.ts`. Add a third parameter and derive gym time per date:

   ```ts
   import { effectiveGymSeconds } from './gymTime'
   import { sessionsByDate } from './sessionDays'

   import type { SessionRow } from './sessionDays'
   import type { DailyEntryInput } from '../schema/dailyEntry'

   function inRange(date: string, range: WeekRange | undefined): boolean {
     return range === undefined || (date >= range.from && date <= range.to)
   }

   export function weekTotals(
     rows: readonly WeekRow[],
     range?: WeekRange,
     sessions: readonly SessionRow[] = [],
   ): WeekTotals {
     const totals: WeekTotals = {
       sessions: 0,
       gymSeconds: 0,
       walkSeconds: 0,
       calories: 0,
       steps: 0,
     }
     const inside = rows.filter((row) => inRange(row.entry_date, range))
     const entries = new Map(inside.map((row) => [row.entry_date, row]))
     const byDate = sessionsByDate(sessions.filter((session) => inRange(session.entry_date, range)))

     for (const row of inside) {
       totals.walkSeconds += row.walk_seconds ?? 0
       totals.calories += row.calories_burnt ?? 0
       totals.steps += row.steps ?? 0
     }

     for (const date of new Set([...entries.keys(), ...byDate.keys()])) {
       const gym = effectiveGymSeconds(entries.get(date), byDate.get(date) ?? []).seconds

       totals.gymSeconds += gym
       totals.sessions += gym > 0 ? 1 : 0
     }

     return totals
   }
   ```

   Keep `WeekRow`, `WeekRange` and `WeekTotals` as they are. The default `[]` keeps
   every current caller and test valid.

4. `components/charts/rangeData.ts`:
   - Add `sessionDates: string[]` to `AnalyticsData`.
   - Add a last parameter to `analyse`: `sessions: readonly WorkoutSession[] = []`.
   - Inside `analyse`, build `const byDate = sessionsByDate(sessions)`.
   - `DayPoint.gymSeconds` becomes the effective value:
     ```ts
     const gym = effectiveGymSeconds(row, byDate.get(date) ?? [])
     ```
     and `gymSeconds: gym.source === 'none' ? null : gym.seconds`.
   - `totals: weekTotals(entries, range, sessions)`.
   - `sessionDates: sessionDays(past, sessions.filter((session) => session.entry_date <= today))`.
   - `logged` keeps its meaning: a row exists. The heat map and the streak stay on
     logged days.
5. `components/charts/useAnalytics.ts`. Read the sessions once, in the same
   `Promise.all` as the history: `listSessions(HISTORY_START, HISTORY_END)`. Add
   `sessions: WorkoutSession[]` to `Source`. Pass it as the last argument of `analyse`.
6. `components/charts/WeekCharts.tsx`:
   - Add the prop `sessionDates: string[]`.
   - Render `<SessionGapChart dates={sessionDates} />`.
   - Delete `rowDates` and its tests. Nothing else uses it.
7. `components/charts/Analytics.tsx`. Pass `sessionDates={state.data.sessionDates}` to
   `WeekCharts`.
8. `components/charts/SessionGapChart.tsx`. The whole history can hold 100+ gaps, so the
   footer must not list them all:

   ```ts
   export const GAP_LIST_CAP = 10

   export function gapFooter(gaps: readonly number[], span: string): string {
     if (gaps.length <= GAP_LIST_CAP) {
       return `Gaps ${gaps.map(String).join(', ')} from ${span}.`
     }

     const latest = gaps.slice(-GAP_LIST_CAP).map(String).join(', ')

     return `${String(gaps.length)} gaps from ${span}. The last ${String(GAP_LIST_CAP)}: ${latest}.`
   }
   ```

   Use it for the footer text. Change the 2 empty texts:
   - no date: `Finish a session or log gym time to count the days between sessions.`
   - 1 date: `One more gym day shows the days between sessions.`

9. `components/dashboard/summary.ts`. Add a last parameter to `summarise`:
   `sessions: readonly WorkoutSession[] = []`, and pass it on:
   `week: weekTotals(past, weekRange, sessions)`.
10. `components/dashboard/useDashboard.ts`. Read the week's sessions inside the live
    query, so a finished workout updates Today at once:

    ```ts
    const week = weekOf(today)
    const [entries, profile, sessions] = await Promise.all([
      listRange(HISTORY_START, today),
      getProfile(),
      listSessions(week.from, today),
    ])

    return { status: 'ready', summary: summarise(entries, profile, today, now, sessions) }
    ```

11. `app/styleguide/page.tsx`. Pass `sessionDates` to each `WeekCharts`, built with
    `sessionDays(<the entries>, <the source>.sessions)`. Keep the 2 to 13 September
    plate numbers: the sample entries already carry typed gym time on those dates.
12. Load the `design-system` skill. Open `/analytics` and `/` at 390 px, 768 px and 1440 px.

## Acceptance criteria

`lib/metrics`, test first:

- [ ] `sessionDays` returns a date with a finished session and no entry.
- [ ] `sessionDays` returns a date with typed gym time and no session.
- [ ] `sessionDays` leaves out a day with an entry but no gym time and no session.
- [ ] `sessionDays` leaves out a typed `0` day, even with a finished session.
- [ ] `sessionDays` leaves out a day with only a live session.
- [ ] `sessionDays` returns each date once, in order, for 2 sessions on 1 date.
- [ ] `sessionsByDate` groups the sessions under their `entry_date`.
- [ ] `weekTotals` counts a day with a finished session and no typed time as 1 session
      and adds its length.
- [ ] `weekTotals` counts 2 sessions on 1 day as 1 session and adds both lengths.
- [ ] `weekTotals` lets a typed gym time win over the sessions of that day.
- [ ] `weekTotals` ignores a session outside the range.

Screens:

- [ ] `analyse` puts a session day from before the range into `sessionDates`.
- [ ] `analyse` gives a day with only a finished session a `gymSeconds` of its length.
- [ ] `useAnalytics` reads the sessions once, with `HISTORY_START` and `HISTORY_END`.
- [ ] `WeekCharts` draws the gap chart from `sessionDates`, not from the tab's days.
- [ ] `gapFooter` lists every gap up to 10, and only the last 10 after that.
- [ ] `summarise` counts a finished session with no typed gym time in the week.
- [ ] `useDashboard` reads the sessions of the current week up to today.

Checks:

- [ ] The Streak heat map and `lib/metrics/streak` keep the meaning the owner chose in
      "Stop and ask the owner". With "logged days", the existing `StreakHeatMap` and
      `streak` tests stay green with no change.
- [ ] `rowDates` is gone. Check: `grep -rn "rowDates" app components lib` returns
      nothing.
- [ ] The style guide keeps the 2 to 13 September plate numbers. Test:
      `app/styleguide/page.test.tsx` stays green.
- [ ] `lib/metrics/**` stays at 100 % lines, 95 % branches and 100 % functions. Check:
      `pnpm test:cov`.
- [ ] Manual: with a finished workout today and no typed gym time, Today's "This
      week" and the Stats "Week totals" each count 1 session (**Verification** 4).
- [ ] The `ui-reviewer` agent reports no drift on `SessionGapChart.tsx` and
      `WeekCharts.tsx`.

## Tests

`lib/metrics/sessionDays.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { sessionDays, sessionsByDate } from './sessionDays'

import type { SessionRow } from './sessionDays'

function session(date: string, overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    entry_date: date,
    started_at: `${date}T07:00:00.000Z`,
    ended_at: `${date}T08:00:00.000Z`,
    deleted_at: null,
    ...overrides,
  }
}

function day(date: string, gymSeconds: number | null) {
  return { entry_date: date, gym_seconds: gymSeconds }
}

describe('sessionDays', () => {
  it('returns a date with a finished session and no entry', () => {
    expect(sessionDays([], [session('2026-09-02')])).toEqual(['2026-09-02'])
  })

  it('returns a date with typed gym time and no session', () => {
    expect(sessionDays([day('2026-09-02', 3600)], [])).toEqual(['2026-09-02'])
  })

  it('leaves out a day with an entry but no gym time and no session', () => {
    expect(sessionDays([day('2026-09-02', null)], [])).toEqual([])
  })

  it('leaves out a typed 0 day, even with a finished session', () => {
    expect(sessionDays([day('2026-09-02', 0)], [session('2026-09-02')])).toEqual([])
  })

  it('leaves out a day with only a live session', () => {
    expect(sessionDays([], [session('2026-09-02', { ended_at: null })])).toEqual([])
  })

  it('returns each date once and in order', () => {
    const sessions = [
      session('2026-09-05'),
      session('2026-09-02'),
      session('2026-09-02', {
        started_at: '2026-09-02T18:00:00.000Z',
        ended_at: '2026-09-02T19:00:00.000Z',
      }),
    ]

    expect(sessionDays([], sessions)).toEqual(['2026-09-02', '2026-09-05'])
  })
})

describe('sessionsByDate', () => {
  it('groups the sessions under their entry date', () => {
    const morning = session('2026-09-02')
    const evening = session('2026-09-02', { started_at: '2026-09-02T18:00:00.000Z' })
    const next = session('2026-09-03')

    expect(sessionsByDate([morning, evening, next])).toEqual(
      new Map([
        ['2026-09-02', [morning, evening]],
        ['2026-09-03', [next]],
      ]),
    )
  })
})
```

`lib/metrics/weekTotals.test.ts`. Keep every test. Add a `session` helper like the one
above, and:

```ts
const WEEK = { from: '2026-09-21', to: '2026-09-27' }

describe('weekTotals with sessions', () => {
  it('counts a day with a finished session and no typed time as 1 session', () => {
    expect(weekTotals([], WEEK, [session('2026-09-22')])).toMatchObject({
      sessions: 1,
      gymSeconds: 3600,
    })
  })

  it('counts 2 sessions on 1 day as 1 session and adds both lengths', () => {
    const evening = session('2026-09-22', {
      started_at: '2026-09-22T18:00:00.000Z',
      ended_at: '2026-09-22T18:30:00.000Z',
    })

    expect(weekTotals([], WEEK, [session('2026-09-22'), evening])).toMatchObject({
      sessions: 1,
      gymSeconds: 5400,
    })
  })

  it('lets a typed gym time win over the sessions of that day', () => {
    const rows = [row({ entry_date: '2026-09-22', gym_seconds: 2700 })]

    expect(weekTotals(rows, WEEK, [session('2026-09-22')]).gymSeconds).toBe(2700)
  })

  it('ignores a session outside the range', () => {
    expect(weekTotals([], WEEK, [session('2026-09-20')])).toEqual(EMPTY)
  })
})
```

`components/charts/rangeData.test.tsx`. Import `sessionOn` from
`../../tests/fixtures/lifts`:

```tsx
it('puts a session day from before the range into the session dates', () => {
  const data = analyse([], [], 'week', TODAY, NOW, 12000, 'metric', [sessionOn('2026-08-30')])
  expect(data.sessionDates).toEqual(['2026-08-30'])
})

it('gives a day with only a finished session its length as gym time', () => {
  const data = analyse([], [], 'week', TODAY, NOW, 12000, 'metric', [sessionOn('2026-09-22')])
  expect(data.days.find((day) => day.date === '2026-09-22')?.gymSeconds).toBe(3600)
})

it('leaves out a session dated after today from the session dates', () => {
  const data = analyse([], [], 'week', TODAY, NOW, 12000, 'metric', [sessionOn('2026-09-25')])
  expect(data.sessionDates).toEqual([])
})
```

`components/charts/useAnalytics.test.tsx`. Add `listSessions: vi.fn(() => Promise.resolve([]))`
to the mock factory and:

```tsx
it('reads the sessions of the whole history once', async () => {
  const { rerender } = renderHook(({ tab }) => useAnalytics(tab, clock), {
    initialProps: { tab: 'week' as 'week' | 'month' },
  })
  await waitFor(() => {
    expect(listSessions).toHaveBeenCalledWith('0000-01-01', '9999-12-31')
  })
  rerender({ tab: 'month' })
  expect(listSessions).toHaveBeenCalledTimes(1)
})
```

Clear the `listSessions` mock in `beforeEach`.

`components/charts/WeekCharts.test.tsx`. Pass `sessionDates={[]}` to every current
render, delete the `rowDates` tests, and add:

```tsx
it('draws the gap chart from the session dates, not from the days of the tab', () => {
  render(
    <WeekCharts
      source={NOTHING}
      days={monthDays([])}
      sessionDates={['2026-08-30', '2026-09-02']}
      today={TODAY}
    />,
  )
  expect(
    within(card('Days between sessions')).getByText('Gaps 3 from 30 August to 2 September.'),
  ).toBeVisible()
})
```

`components/charts/SessionGapChart.test.tsx`. Update the 2 empty text tests to the new
strings, and add:

```tsx
describe('gapFooter', () => {
  it('lists every gap up to 10', () => {
    expect(gapFooter([1, 3], '2 to 5 September')).toBe('Gaps 1, 3 from 2 to 5 September.')
  })

  it('lists only the last 10 gaps of a long history', () => {
    const gaps = [7, 1, 2, 3, 1, 2, 3, 1, 2, 3, 4]
    expect(gapFooter(gaps, '1 January to 5 October')).toBe(
      '11 gaps from 1 January to 5 October. The last 10: 1, 2, 3, 1, 2, 3, 1, 2, 3, 4.',
    )
  })
})
```

`components/dashboard/summary.test.tsx`. Import `sessionOn` and add:

```tsx
it('counts a finished session with no typed gym time in the week', () => {
  const entries = [entryOn('2026-09-22', { gym_seconds: null })]
  const week = summarise(entries, PROFILE, TODAY, NOW, [sessionOn('2026-09-22')]).week
  expect(week).toMatchObject({ sessions: 1, gymSeconds: 3600 })
})
```

`components/dashboard/useDashboard.test.tsx`. Add `listSessions: vi.fn()` to the mock,
resolve it to `[]` in `beforeEach`, and add:

```tsx
it('reads the sessions of the current week up to today', async () => {
  renderHook(() => useDashboard(clock))
  await waitFor(() => {
    expect(listSessions).toHaveBeenCalledWith('2026-09-21', TODAY)
  })
})
```

`components/charts/Analytics.test.tsx` already mocks `listSessions`. Keep it.

## Verification

1. `pnpm test:cov`. `lib/metrics/**` stays at 100 lines, 95 branches, 100 functions.
2. The `ui-reviewer` agent reports no drift on `SessionGapChart.tsx` and `WeekCharts.tsx`.
3. On `/analytics`, the gap chart shows the same chart on Day, Week and Month.
4. With a finished workout today and no typed gym time, Today's "This week" counts 1
   session and Stats "Week totals" counts 1 session.
5. `pnpm verify:parallel`.

## Files touched

- `lib/metrics/sessionDays.ts` and its test
- `lib/metrics/weekTotals.ts` and its test
- `components/charts/rangeData.ts` and its test
- `components/charts/useAnalytics.ts` and its test
- `components/charts/WeekCharts.tsx` and its test
- `components/charts/SessionGapChart.tsx` and its test
- `components/charts/Analytics.tsx`
- `components/dashboard/summary.ts` and its test
- `components/dashboard/useDashboard.ts` and its test
- `app/styleguide/page.tsx` and its test, if a plate text changes

## Things to consider

- A day with only a finished session and no entry is not "logged". It adds gym time
  and a session, but `averagePerLoggedDay` on the Totals chart still divides by the
  logged days. G3 or a later step can count it. Name this in the commit report.
- The heat map and the streak stay on logged days. The spec, section 3.3, lists the
  heat map with the session rule. This step keeps "Streak" as logged days on purpose.
  The owner answers this in "Stop and ask the owner". Quote the answer in the report.

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer
   when another step runs its e2e suite. Never skip a check, and never add a
   design-check or test exemption to pass.
2. Run the `commit-report` skill. The report needs screenshots of every changed page at 390, 768 and 1440 px, next to the matching prototype plate: `/analytics` next to the Stats plate, and `/` next to the Today plate.
3. Commit on `fix/c3-session-gaps`:
   ```bash
   git add lib/metrics/sessionDays.ts \
     lib/metrics/sessionDays.test.ts \
     lib/metrics/weekTotals.ts \
     lib/metrics/weekTotals.test.ts \
     components/charts/rangeData.ts \
     components/charts/rangeData.test.tsx \
     components/charts/useAnalytics.ts \
     components/charts/useAnalytics.test.tsx \
     components/charts/WeekCharts.tsx \
     components/charts/WeekCharts.test.tsx \
     components/charts/SessionGapChart.tsx \
     components/charts/SessionGapChart.test.tsx \
     components/charts/Analytics.tsx \
     components/dashboard/summary.ts \
     components/dashboard/summary.test.tsx \
     components/dashboard/useDashboard.ts \
     components/dashboard/useDashboard.test.tsx \
     app/styleguide/page.tsx
   git commit -m "fix(charts): count sessions from all history with one meaning"
   ```
   Also add `app/styleguide/page.test.tsx` and `components/charts/Analytics.test.tsx` if you changed them.
   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.
4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked,
   and anything the owner must check on the iPhone. Quote the owner's answer on the heat map. On the iPhone the owner finishes a workout with no typed gym time, and checks that Today and Stats each count it as 1 session.
