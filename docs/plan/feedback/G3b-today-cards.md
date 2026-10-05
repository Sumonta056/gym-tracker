# Step G3b — Today shows every tracked value

**Branch:** `fix/g3b-today-cards`, in worktree `../gym-tracker-g3b`, cut from `fix/feedback-fixes` ·
**Wave:** 11 · **Size:** M · **Depends on:** W0, G3a, F2 (and H1, which changed
`Dashboard.tsx` before this wave) · **Unlocks:** the G checkpoint ·
**Skills to load:** `design-system` · **Agent to use:** `test-writer`, then `ui-reviewer`

The second half of G3. G3a built the data. This step builds the cards.

## Before you start

1. Make the worktree:

   ```bash
   cd /Users/cefalo_1/Documents/Projects/gym-tracker
   git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-g3b -b fix/g3b-today-cards fix/feedback-fixes
   cd ../gym-tracker-g3b
   cp ../gym-tracker/.env.local ../gym-tracker/.env.test.local .
   export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"
   pnpm install
   ```

   If you are already in that worktree on that branch, skip this block.

2. Dependency checks. Run them from the worktree root. Each line prints `FAIL` and the
   step name when that step is not in `fix/feedback-fixes`:

   ```bash
   test -f scripts/e2e-lock.mjs || echo "FAIL W0: scripts/e2e-lock.mjs is missing"
   grep -qs "export const NO_LIFTS" components/dashboard/summary.ts || echo "FAIL G3a: NO_LIFTS is missing in components/dashboard/summary.ts"
   grep -qs "export function todayWorkouts" components/dashboard/summary.ts || echo "FAIL G3a: todayWorkouts is missing in components/dashboard/summary.ts"
   grep -qs "export function sessionPath" components/workouts/historyText.ts || echo "FAIL F2: sessionPath is missing in components/workouts/historyText.ts"
   grep -qs "export function rowLine" components/workouts/historyText.ts || echo "FAIL F2: rowLine is missing in components/workouts/historyText.ts"
   grep -qs "export function resolveMaxHeartRate" lib/metrics/heartRateZones.ts || echo "FAIL H1: resolveMaxHeartRate is missing in lib/metrics/heartRateZones.ts"
   grep -qs "maxHeartRate={summary.maxHeartRate}" components/dashboard/Dashboard.tsx || echo "FAIL H1: Dashboard.tsx does not pass the max heart rate"
   ```

   If any check fails, the step it names is not merged into `fix/feedback-fixes`. Stop. Report which
   check failed. Do not do that step's work here.

3. Already done check:

   ```bash
   test -f components/dashboard/TodayWorkoutCard.tsx && echo "G3b is already done"
   ```

   If it prints, stop and report.

## Names this step uses from earlier steps

- G3a, `components/dashboard/summary.ts`:

  ```ts
  export type TodayLifts = {
    sessions: WorkoutSession[]
    sets: WorkoutSet[]
    earlierSets: WorkoutSet[]
  }
  export const NO_LIFTS: TodayLifts
  export type TodayWorkout = { session: WorkoutSession; stats: SessionStats }
  export type TodayGym = { seconds: number; source: GymTimeSource }
  export function summarise(
    entries: readonly DailyEntry[],
    profile: Profile,
    today: string,
    now: Date,
    lifts?: TodayLifts,
  ): DashboardSummary
  ```

  `DashboardSummary` holds `gym: TodayGym`, `workouts: TodayWorkout[]`,
  `calorieGoal: number | null`, `walkGoalSeconds: number | null`,
  `targetWeightKg: number | null`, `weightGapKg: number | null`, and from G2
  `sessionsGoal: number | null`. `GymTimeSource` is `'typed' | 'sessions' | 'none'` (C2).

- C4: `DashboardSummary.weekRange`, and `WeekTotalsCard` takes `range={summary.weekRange}`.
- H1: `DashboardSummary.maxHeartRate: MaxHeartRate | null`, and `HeartRateZonesCard` takes
  `maxHeartRate={summary.maxHeartRate}`. `MaxHeartRate` is
  `{ bpm: number; source: 'override' | 'age' }`.
- F2, `components/workouts/historyText.ts`:
  `export function sessionPath(id: string): string` (gives `/workouts?session=<id>`) and
  `export function rowLine(stats: SessionStats, unit: UnitSystem): string` (for example
  `1h · 2 sets · 1,120 kg`).
- F1, `lib/metrics/sessionStats.ts`: `SessionStats` is `{ durationSeconds, setCount,
exerciseCount, volumeKg, newRecords }`, and `sessionStats(session, sets, earlierSets)`.
- E5 and D1: a daily entry holds `swim_seconds: number | null`.

## Context to read first

1. `docs/specs/2026-10-05-feedback-fixes-design.md`, item 8: "Workout, note, calories
   against goal, weight against target, every other field."
2. `components/dashboard/summary.ts` after G3a — `gym`, `workouts`, `calorieGoal`,
   `walkGoalSeconds`, `targetWeightKg`, `weightGapKg`, `sessionsGoal`.
3. `components/dashboard/Dashboard.tsx`, `TodayHero.tsx` and their tests.
4. `components/ui/StatCard.tsx` — `label`, `value`, `unit`, `hint`, `progress`, `tone`.
5. `components/workouts/historyText.ts` from F2 — `rowLine` and `sessionPath`.
6. `components/workout/SessionTimer.tsx` — `startedText`.
7. Plate `p1` "Dashboard" in `docs/design/prototype/index.html`.

## State before the step

- The hero shows `entry.gym_seconds`, and Avg HR, Peak, Kcal and Walk, with `—` for a missing value.
- Steps and Weight cards show `—` when empty. Weight says `Latest entry` only.
- No workout card, no note, no swim time, no calorie or walk goal on Today.

## Goal

Today shows, for today: gym time (with `From your sessions` when it is derived), today's
workouts with a link to each detail, calories against the goal, the weight against the
target, walk time against the goal, swim time, steps, heart rate and the note. **A field
with no value is hidden.** It never shows `0` or `—`.

## Decisions in this step

- The hero keeps the gym time and the heart rate (Avg HR, Peak). Calories and walk time move
  to their own cards, because each now has a goal bar, like Steps.
- With no gym time, the hero shows `No gym time today` in place of the number. The hero is
  the 1 place that names a missing value, because it is the frame of the day.
- The "Nothing logged yet" state shows only when there is no entry **and** no session today.
- The card order: hero, Steps, Calories, Walk, Swim, Weight, Workout today, Note, Heart rate
  zones, This week.
- Swim has no goal (none in the spec). Its card has no bar.
- The weight card shows the latest weight, as today. With a target it says `2.4 kg to go`,
  or `On target` under 0.05 kg.
- The workout rows use `next/link` to `/workouts?session=<id>`, the same as every other
  cross-route link on Today.

## Do

1. Run the `test-writer` agent with the acceptance list. The tests come first.
2. `components/dashboard/todayText.ts`:

   ```ts
   import { formatWeight, weightSymbol } from '../../lib/format/weight'
   import { rowLine } from '../workouts/historyText'

   import type { SessionStats } from '../../lib/metrics/sessionStats'
   import type { UnitSystem } from '../../lib/schema/profile'

   export const ON_TARGET_KG = 0.05

   export function goalHint(
     value: number,
     goal: number,
     format: (value: number) => string,
   ): string {
     return `${String(Math.round((value / goal) * 100))}% of ${format(goal)}`
   }

   export function weightGapText(gapKg: number, unit: UnitSystem): string {
     return gapKg < ON_TARGET_KG
       ? 'On target'
       : `${formatWeight(gapKg, unit, 1)} ${weightSymbol(unit)} to go`
   }

   export function workoutLine(stats: SessionStats, unit: UnitSystem): string {
     const records = stats.newRecords.length
     const line = rowLine(stats, unit)

     return records === 0
       ? line
       : `${line} · ${String(records)} new record${records === 1 ? '' : 's'}`
   }
   ```

3. `components/dashboard/TodayHero.tsx`:
   - Props become `{ entry: DailyEntry | undefined; gym: TodayGym; streak: number; name?: string; className?: string }`.
   - Empty state when `entry === undefined && gym.source === 'none'`. Same copy as today.
   - The number:

     ```tsx
     {
       gym.source === 'none' ? (
         <p className="mt-2.5 mb-1.5 text-[23px] leading-tight font-bold tracking-[-0.6px]">
           No gym time today
         </p>
       ) : (
         <p className="mt-2.5 mb-1.5 text-[48px] leading-none font-extrabold tracking-[-2.4px]">
           <CountUp value={gym.seconds} format={clock} />
         </p>
       )
     }
     {
       gym.source === 'sessions' ? (
         <p className="text-accent-ink/80 text-[13px] font-semibold">From your sessions</p>
       ) : null
     }
     ```

   - The inline row holds only Avg HR and Peak. Each `Inline` renders only when its value
     is not null. The row renders only when 1 of them has a value. Delete `Missing`,
     `clockOrNull` and the Kcal and Walk inlines.
4. `components/dashboard/TodayWorkoutCard.tsx`:

   ```tsx
   import Link from 'next/link'

   import { Card } from '../ui/Card'
   import { cn } from '../ui/cn'
   import { MicroLabel } from '../ui/MicroLabel'
   import { startedText } from '../workout/SessionTimer'
   import { sessionPath } from '../workouts/historyText'

   import { workoutLine } from './todayText'

   import type { TodayWorkout } from './summary'
   import type { UnitSystem } from '../../lib/schema/profile'

   export type TodayWorkoutCardProps = {
     workouts: TodayWorkout[]
     unit: UnitSystem
     className?: string
   }

   export function TodayWorkoutCard({ workouts, unit, className }: TodayWorkoutCardProps) {
     return (
       <Card className={cn('flex flex-col gap-1.5', className)}>
         <h2>
           <MicroLabel>Workout today</MicroLabel>
         </h2>
         <ul>
           {workouts.map(({ session, stats }) => (
             <li key={session.id} className="border-border border-b last:border-b-0">
               <Link
                 href={sessionPath(session.id)}
                 className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left"
               >
                 <span className="text-muted shrink-0 text-sm">
                   {startedText(session.started_at)}
                 </span>
                 <strong className="text-text min-w-0 text-right text-sm break-words">
                   {workoutLine(stats, unit)}
                 </strong>
               </Link>
             </li>
           ))}
         </ul>
       </Card>
     )
   }
   ```

5. `components/dashboard/NoteCard.tsx`:

   ```tsx
   import { Card } from '../ui/Card'
   import { MicroLabel } from '../ui/MicroLabel'

   export type NoteCardProps = { note: string; className?: string }

   export function NoteCard({ note, className }: NoteCardProps) {
     return (
       <Card className={className}>
         <h2>
           <MicroLabel>Note</MicroLabel>
         </h2>
         <p className="text-text mt-1.5 text-sm break-words whitespace-pre-line">{note}</p>
       </Card>
     )
   }
   ```

6. `components/dashboard/Dashboard.tsx`, `DashboardView`:

   ```tsx
   const entry = summary.entry
   const steps = entry?.steps ?? null
   const calories = entry?.calories_burnt ?? null
   const walk = entry?.walk_seconds ?? null
   const swim = entry?.swim_seconds ?? null
   const note = entry?.note?.trim() ?? ''
   const short = (seconds: number) => formatDuration(seconds, 'short')
   const kcal = (value: number) => `${formatCount(value)} kcal`
   ```

   ```tsx
   <TodayHero entry={entry} gym={summary.gym} streak={summary.streak} className="md:col-span-2 lg:col-span-3" />

   <div className="grid grid-cols-2 gap-3 md:contents">
     {steps === null ? null : (
       <StatCard label="Steps" value={formatCount(steps)} hint={stepsHint(steps, summary.stepGoal)} progress={steps / summary.stepGoal} tone="cyan" />
     )}
     {calories === null ? null : (
       <StatCard
         label="Calories"
         value={formatCount(calories)}
         unit="kcal"
         hint={summary.calorieGoal === null ? undefined : goalHint(calories, summary.calorieGoal, kcal)}
         progress={summary.calorieGoal === null ? undefined : calories / summary.calorieGoal}
         tone="warn"
       />
     )}
     {walk === null ? null : (
       <StatCard
         label="Walk"
         value={short(walk)}
         hint={summary.walkGoalSeconds === null ? undefined : goalHint(walk, summary.walkGoalSeconds, short)}
         progress={summary.walkGoalSeconds === null ? undefined : walk / summary.walkGoalSeconds}
         tone="cyan"
       />
     )}
     {swim === null ? null : <StatCard label="Swim" value={short(swim)} tone="cyan" />}
     {weight === null ? null : (
       <StatCard
         label="Weight"
         value={formatWeight(weight, unit, digits)}
         unit={weightSymbol(unit)}
         hint={summary.weightGapKg === null ? 'Latest entry' : weightGapText(summary.weightGapKg, unit)}
         sparkline={trend.length > 1 ? trend : undefined}
         tone="violet"
       />
     )}
   </div>

   {summary.workouts.length === 0 ? null : (
     <TodayWorkoutCard workouts={summary.workouts} unit={unit} className="md:col-span-2 lg:col-span-1" />
   )}
   {note === '' ? null : <NoteCard note={note} />}

   <HeartRateZonesCard zones={summary.zones} maxHeartRate={summary.maxHeartRate} />

   <WeekTotalsCard
     totals={summary.week}
     range={summary.weekRange}
     sessionsGoal={summary.sessionsGoal}
     className="lg:col-span-3"
   />
   ```

   Keep every prop that C4, G2 and H1 already pass to `HeartRateZonesCard` and
   `WeekTotalsCard`. Read `Dashboard.tsx` first, and change only the card list.

   `stepsHint` keeps its signature. Its `steps === null` branch has no caller now: delete
   that branch, change the parameter to `number`, and delete its test case.
   A `progress` above 1 must draw a full bar, not overflow. Check `StatCard`; if it does not
   clamp, clamp it there with `Math.min(1, progress)` and add a test to `StatCard.test.tsx`.

7. `/styleguide`: a Today sample with every card, and a sparse sample with only the hero
   and Steps.
8. Plate `p1`: the hero with `From your sessions`, then Steps, Calories `120% of 800 kcal`,
   Walk `92% of 1h`, Swim, Weight `2.4 kg to go`, `Workout today` with 1 row, `Note`, the
   zones and `This week`.

## Acceptance criteria

- [ ] `goalHint` writes `120% of 800 kcal` and `92% of 1h`.
- [ ] `weightGapText` writes `2.4 kg to go`, `5.3 lb to go` in imperial, and `On target` under 0.05 kg.
- [ ] `workoutLine` adds `· 1 new record` or `· 2 new records`, and nothing with no record.
- [ ] The hero shows the session gym time with `From your sessions`, and no hint for a typed time.
- [ ] The hero shows `No gym time today` when there is an entry and no gym time.
- [ ] The hero shows the "Nothing logged" state only with no entry and no session.
- [ ] A day with only a session shows its gym time, not the "Nothing logged" state.
- [ ] Avg HR and Peak hide one by one when null.
- [ ] Steps, Calories, Walk, Swim and Weight each hide when null. No `0`, no `—`.
- [ ] Calories shows its goal bar and `% of … kcal` with a goal, and no bar without one.
- [ ] Walk shows its goal bar and `% of …` with a goal.
- [ ] Weight shows `2.4 kg to go` with a target and `Latest entry` without one.
- [ ] `Workout today` lists each finished session with a link to `/workouts?session=<id>`, and hides with none.
- [ ] The note shows when set, and hides when null or blank.
- [ ] Every link is 44 px or taller. No horizontal scroll at 320 px.
      Test: `tests/e2e/responsive.spec.ts` on `/`, and `it('gives each row a 44 px
target')` in `TodayWorkoutCard.test.tsx`.
- [ ] The zones card still names the max heart rate from H1, and the week card still
      shows the C4 range and the G2 `3 / 4`. Tests: the existing H1, C4 and G2 cases in
      `Dashboard.test.tsx` and `WeekTotalsCard.test.tsx` pass unchanged.
- [ ] A `progress` above 1 draws a full bar, not an overflow. Test: the clamp case in
      `StatCard.test.tsx`, or the existing one if `StatCard` already clamps.
- [ ] The cards follow the order hero, Steps, Calories, Walk, Swim, Weight, Workout
      today, Note, Heart rate zones, This week. Manual check at 390 px, 768 px and
      1440 px, and the `ui-reviewer` agent on plate `p1`.
- [ ] `/styleguide` shows a full Today sample and a sparse one. Test:
      `app/styleguide/page.test.tsx`.
- [ ] axe reports no serious or critical issue on `/`. Test: `tests/e2e/a11y.spec.ts`.

## Tests

`components/dashboard/todayText.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { formatDuration } from '../../lib/duration'
import { BENCH, LEG } from '../../tests/fixtures/lifts'

import { formatCount } from './summary'
import { goalHint, weightGapText, workoutLine } from './todayText'

import type { SessionStats } from '../../lib/metrics/sessionStats'

const STATS: SessionStats = {
  durationSeconds: 3600,
  setCount: 2,
  exerciseCount: 1,
  volumeKg: 1120,
  newRecords: [],
}

describe('goalHint', () => {
  it('writes the share of a calorie goal', () => {
    expect(goalHint(963, 800, (value) => `${formatCount(value)} kcal`)).toBe('120% of 800 kcal')
  })

  it('writes the share of a walk goal', () => {
    expect(goalHint(3324, 3600, (value) => formatDuration(value, 'short'))).toBe('92% of 1h')
  })
})

describe('weightGapText', () => {
  it('writes the gap in kilograms', () => {
    expect(weightGapText(2.4, 'metric')).toBe('2.4 kg to go')
  })

  it('writes the gap in pounds for imperial', () => {
    expect(weightGapText(2.4, 'imperial')).toBe('5.3 lb to go')
  })

  it('says on target under 0.05 kg', () => {
    expect(weightGapText(0.04, 'metric')).toBe('On target')
  })
})

describe('workoutLine', () => {
  it('writes the session line with no record', () => {
    expect(workoutLine(STATS, 'metric')).toBe('1h · 2 sets · 1,120 kg')
  })

  it('adds 1 new record', () => {
    const stats = { ...STATS, newRecords: [{ exerciseId: BENCH, weightKg: 65, reps: 5 }] }
    expect(workoutLine(stats, 'metric')).toBe('1h · 2 sets · 1,120 kg · 1 new record')
  })

  it('adds 2 new records', () => {
    const stats = {
      ...STATS,
      newRecords: [
        { exerciseId: BENCH, weightKg: 65, reps: 5 },
        { exerciseId: LEG, weightKg: 140, reps: 8 },
      ],
    }
    expect(workoutLine(stats, 'metric')).toBe('1h · 2 sets · 1,120 kg · 2 new records')
  })
})
```

`components/dashboard/TodayHero.test.tsx`: every `render` gets a `gym` prop. Use
`gym={{ seconds: 4325, source: 'typed' }}` where the entry has `gym_seconds: 4325`, and
`gym={{ seconds: 0, source: 'none' }}` for the empty cases. Add:

```tsx
it('says the gym time comes from the sessions', () => {
  render(
    <TodayHero
      entry={entryOn(TODAY, { gym_seconds: null })}
      gym={{ seconds: 3600, source: 'sessions' }}
      streak={1}
    />,
  )
  expect(screen.getByText(formatDuration(3600, 'clock'))).toBeInTheDocument()
  expect(screen.getByText('From your sessions')).toBeVisible()
})

it('gives no hint for a typed gym time', () => {
  render(<TodayHero entry={entryOn(TODAY)} gym={{ seconds: 4325, source: 'typed' }} streak={1} />)
  expect(screen.queryByText('From your sessions')).toBeNull()
})

it('names a day with an entry and no gym time', () => {
  render(
    <TodayHero
      entry={entryOn(TODAY, { gym_seconds: null })}
      gym={{ seconds: 0, source: 'none' }}
      streak={1}
    />,
  )
  expect(screen.getByText('No gym time today')).toBeVisible()
})

it('shows the gym time of a day with only a session', () => {
  render(<TodayHero entry={undefined} gym={{ seconds: 3600, source: 'sessions' }} streak={0} />)
  expect(screen.queryByText('Nothing logged yet today.')).toBeNull()
  expect(screen.getByText(formatDuration(3600, 'clock'))).toBeInTheDocument()
})

it('hides a heart rate value that is not logged', () => {
  render(
    <TodayHero
      entry={entryOn(TODAY, { avg_heart_rate: null })}
      gym={{ seconds: 4325, source: 'typed' }}
      streak={1}
    />,
  )
  expect(screen.queryByText('Avg HR')).toBeNull()
  expect(screen.getByText('Peak')).toBeVisible()
})
```

Delete the hero cases that expect `Kcal`, `Walk` or the `—` dash.

`components/dashboard/TodayWorkoutCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { sessionStats } from '../../lib/metrics/sessionStats'
import { BENCH, liftSet, sessionOn } from '../../tests/fixtures/lifts'
import { startedText } from '../workout/SessionTimer'

import { TodayWorkoutCard } from './TodayWorkoutCard'

const SESSION = sessionOn('2026-09-23')
const STATS = sessionStats(
  SESSION,
  [liftSet(SESSION, BENCH, 10, 60), liftSet(SESSION, BENCH, 8, 65)],
  [],
)

describe('TodayWorkoutCard', () => {
  it('links each session to its detail', () => {
    render(<TodayWorkoutCard workouts={[{ session: SESSION, stats: STATS }]} unit="metric" />)
    const row = screen.getByRole('link')
    expect(row).toHaveAttribute('href', `/workouts?session=${SESSION.id}`)
    expect(row).toHaveTextContent(`${startedText(SESSION.started_at)}1h · 2 sets · 1,120 kg`)
  })

  it('gives each row a 44 px target', () => {
    render(<TodayWorkoutCard workouts={[{ session: SESSION, stats: STATS }]} unit="metric" />)
    expect(screen.getByRole('link')).toHaveClass('min-h-11')
  })

  it('has a heading for the card', () => {
    render(<TodayWorkoutCard workouts={[{ session: SESSION, stats: STATS }]} unit="metric" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Workout today' })).toBeInTheDocument()
  })
})
```

`components/dashboard/NoteCard.test.tsx`: it shows the text under a level 2 heading `Note`,
and keeps a line break.

`components/dashboard/Dashboard.test.tsx`, add (with `sessionOn`, `liftSet` and `BENCH`
imported, and `summarise` as the file uses it today):

```tsx
describe('DashboardView, a full Today', () => {
  const GOALS = { ...PROFILE, calorie_goal: 800, walk_goal_seconds: 3600, target_weight_kg: 71.25 }

  function view(entries = [entryOn(TODAY)], profile = GOALS, lifts = NO_LIFTS) {
    render(<DashboardView summary={summarise(entries, profile, TODAY, NOW, lifts)} />)
  }

  it('hides each card that has no value, with no 0 and no dash', () => {
    view([
      entryOn(TODAY, {
        steps: null,
        calories_burnt: null,
        walk_seconds: null,
        swim_seconds: null,
        weight_kg: null,
        note: null,
      }),
    ])
    for (const label of ['Steps', 'Calories', 'Walk', 'Swim', 'Weight', 'Note']) {
      expect(screen.queryByText(label)).toBeNull()
    }
    expect(screen.queryByText('—')).toBeNull()
  })

  it('shows calories against the calorie goal', () => {
    view()
    expect(screen.getByText('120% of 800 kcal')).toBeVisible()
  })

  it('shows calories with no bar when there is no goal', () => {
    view([entryOn(TODAY)], PROFILE)
    expect(screen.getByText('Calories')).toBeVisible()
    expect(screen.queryByText(/% of .* kcal/)).toBeNull()
  })

  it('shows the walk time against the walk goal', () => {
    view()
    expect(screen.getByText('92% of 1h')).toBeVisible()
  })

  it('shows the swim time', () => {
    view([entryOn(TODAY, { swim_seconds: 1500 })])
    expect(screen.getByText('Swim')).toBeVisible()
    expect(screen.getByText('25m')).toBeVisible()
  })

  it('shows the gap to the target weight', () => {
    view()
    expect(screen.getByText('2.4 kg to go')).toBeVisible()
  })

  it('shows the note', () => {
    view([entryOn(TODAY, { note: 'Felt strong.' })])
    expect(screen.getByRole('heading', { name: 'Note' })).toBeInTheDocument()
    expect(screen.getByText('Felt strong.')).toBeVisible()
  })

  it('hides a blank note', () => {
    view([entryOn(TODAY, { note: '   ' })])
    expect(screen.queryByRole('heading', { name: 'Note' })).toBeNull()
  })

  it('lists the workout of today with a link to its detail', () => {
    const session = sessionOn(TODAY)
    const lifts = { sessions: [session], sets: [liftSet(session, BENCH, 10, 60)], earlierSets: [] }
    view([entryOn(TODAY, { gym_seconds: null })], GOALS, lifts)
    expect(screen.getByRole('link', { name: /1h · 1 set · 600 kg/ })).toHaveAttribute(
      'href',
      `/workouts?session=${session.id}`,
    )
    expect(screen.getByText('From your sessions')).toBeVisible()
  })

  it('hides the workout card with no session', () => {
    view()
    expect(screen.queryByRole('heading', { name: 'Workout today' })).toBeNull()
  })
})
```

`entryOn` holds `swim_seconds: null` and `note: null` by default after D1 and E5. The
default entry has `calories_burnt: 963` and `walk_seconds: 3324`. Check the hidden-card
test against the micro label text, not its CSS case.

## Verification

1. `pnpm test:cov`.
2. The `ui-reviewer` agent reports no drift against plate `p1`.
3. Check `/` at 390 px, 768 px and 1440 px: once with every value and goal, once with only
   steps, once with only a session and no log.
4. `pnpm verify:parallel`.

## Things to consider

- This step ends sub-plan G. Say so in the report, so the owner runs the G checkpoint
  in `docs/plan/04-feedback-fixes.md`. Do not run it yourself.
- H2 runs in the same wave. It changes `HeartRateZonesCard.tsx`, not `Dashboard.tsx`.
  Do not edit `HeartRateZonesCard.tsx` here.

## Files touched

- `components/dashboard/todayText.ts` and its test
- `components/dashboard/TodayHero.tsx` and its test
- `components/dashboard/TodayWorkoutCard.tsx` and its test
- `components/dashboard/NoteCard.tsx` and its test
- `components/dashboard/Dashboard.tsx` and its test
- `components/ui/StatCard.tsx` and its test, only if `progress` needs the clamp
- `app/styleguide/page.tsx` and its test
- `docs/design/prototype/index.html` (plate `p1`)

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer when
   another step runs its e2e suite. Never skip a check, and never add a design-check or
   test exemption to pass.
2. Stage the files of step 3 with the same `git add` line first. The skill describes the
   staged diff, and it refuses to run when nothing is staged. Then run the `commit-report`
   skill.
   The report needs screenshots of every changed page at 390, 768 and 1440 px, next
   to the matching prototype plate. Show `/` for the full day and the sparse day.
3. Commit on `fix/g3b-today-cards`:

   ```bash
   git add components/dashboard/todayText.ts \
     components/dashboard/todayText.test.ts \
     components/dashboard/TodayHero.tsx \
     components/dashboard/TodayHero.test.tsx \
     components/dashboard/TodayWorkoutCard.tsx \
     components/dashboard/TodayWorkoutCard.test.tsx \
     components/dashboard/NoteCard.tsx \
     components/dashboard/NoteCard.test.tsx \
     components/dashboard/Dashboard.tsx \
     components/dashboard/Dashboard.test.tsx \
     components/ui/StatCard.tsx \
     components/ui/StatCard.test.tsx \
     app/styleguide/page.tsx \
     app/styleguide/page.test.tsx \
     docs/design/prototype/index.html
   git commit -m "feat(ui): show every tracked value of the day on today"
   ```

   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.

4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked,
   and anything the owner must check on the iPhone.
