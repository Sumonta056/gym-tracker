# Step G2 — A goal line on each chart

**Branch:** `fix/g2-goal-lines`, in worktree `../gym-tracker-g2`, cut from `fix/feedback-fixes` ·
**Wave:** 6 · **Size:** M · **Depends on:** W0, G1, C1, C4 (and D1 through G1) ·
**Unlocks:** G3a, H1, I1 · **Skills to load:** `design-system` · **Agent to use:**
`test-writer`, then `ui-reviewer`

This step is M: there is no walk chart today, so this step adds one.

## Before you start

1. Make the worktree:

   ```bash
   cd /Users/cefalo_1/Documents/Projects/gym-tracker
   git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-g2 -b fix/g2-goal-lines fix/feedback-fixes
   cd ../gym-tracker-g2
   cp ../gym-tracker/.env.local ../gym-tracker/.env.test.local .
   export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"
   pnpm install
   ```

   If you are already in that worktree on that branch, skip this block.

2. Dependency checks. Run them from the worktree root. Each line prints `FAIL` and the
   step name when that step is not in `fix/feedback-fixes`:

   ```bash
   test -f scripts/e2e-lock.mjs || echo "FAIL W0: scripts/e2e-lock.mjs is missing"
   grep -qs "gym_goal_seconds: goalSeconds" lib/schema/profile.ts || echo "FAIL D1: the goal columns are missing in lib/schema/profile.ts"
   grep -qs "export function parseDurationTarget" components/profile/targets.ts || echo "FAIL G1: parseDurationTarget is missing in components/profile/targets.ts"
   grep -qs "export const WEEK_START" components/profile/UnitsCard.tsx || echo "FAIL G1: WEEK_START is missing in components/profile/UnitsCard.tsx"
   grep -qs "export const LineDrawContext" components/charts/useLineDraw.ts || echo "FAIL C1: LineDrawContext is missing in components/charts/useLineDraw.ts"
   grep -qs "export function weekRangeLabel" components/dashboard/summary.ts || echo "FAIL C4: weekRangeLabel is missing in components/dashboard/summary.ts"
   grep -qs "export const WEEKDAY_LABELS" components/charts/StreakHeatMap.tsx || echo "FAIL C4: WEEKDAY_LABELS is missing in components/charts/StreakHeatMap.tsx"
   ```

   If any check fails, the step it names is not merged into `fix/feedback-fixes`. Stop. Report which
   check failed. Do not do that step's work here.

3. Already done check:

   ```bash
   test -f components/charts/WalkChart.tsx && echo "G2 is already done"
   ```

   If it prints, stop and report.

## Names this step uses from earlier steps

- D1, the local `Profile` in `lib/db/dexie.ts` holds these as **optional** nullable
  numbers: `calorie_goal`, `gym_goal_seconds`, `walk_goal_seconds`,
  `sessions_per_week_goal`. `target_weight_kg` is a plain `number | null`. Every read of an
  optional column uses `?? null`.
- G1: Profile edits those goals in the `Goals` card (`components/profile/TargetsCard.tsx`).
  This step only reads them.
- C1, `components/charts/useAnalytics.ts`:

  ```ts
  export type AnalyticsState =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; data: AnalyticsData }
  export function useAnalytics(tab: RangeTab, clock?: () => Date): AnalyticsState
  ```

  C1 also adds `LineDrawContext` and `useLineDraw()` in `components/charts/useLineDraw.ts`.
  Keep both as they are.

- C4: `WEEKDAY_LABELS` in `StreakHeatMap.tsx`, and
  `export function weekRangeLabel(range: WeekRange): string` in
  `components/dashboard/summary.ts`. `WeekTotalsCard` takes a `range` prop and shows
  `weekRangeLabel(range)`. Keep that prop when you add `sessionsGoal`.
- C3 may have changed the parameters of `analyse` in `components/charts/rangeData.ts`.
  Read its current signature first, and add `goals` as the last parameter.

## Context to read first

1. `.claude/skills/design-system/references/charts.md` — rule 3, reference lines: "A goal
   when the profile holds one … Otherwise the average over logged days … A goal line always
   shows." Every bar chart has 1 reference line, so the goal **replaces** the average.
2. `components/charts/StepsChart.tsx` — the pattern: `reference={{ value, label: 'goal …' }}`
   and `Goal … a day.` at the end of the `aria-label`.
3. `components/charts/DailyBars.tsx` — `Reference`, `ReferenceLabel`, `referencePlacement`,
   `BAND_HEIGHT`, the `dataKey` union.
4. `components/charts/CaloriesChart.tsx`, `TotalsChart.tsx` (the gym time chart: its bars
   are `gymSeconds`), `WeightChart.tsx`, and their tests.
5. `components/charts/rangeData.ts` — `DayPoint`, `AnalyticsData`, `analyse`.
6. `components/charts/useAnalytics.ts` and `Analytics.tsx`.
7. `components/dashboard/WeekTotalsCard.tsx`, `summary.ts`, `Dashboard.tsx`.

## State before the step

- After G1, the profile holds `calorie_goal`, `gym_goal_seconds`, `walk_goal_seconds`,
  `sessions_per_week_goal` and `target_weight_kg`. No chart reads them.
- Steps draws its goal line. Calories and gym time draw an average line. Weight draws none.
- No chart shows walk time. `DayPoint` has no walk field.
- `WeekTotalsCard` shows `sessions` as a bare count.
- If C1 to C3 changed the parameters of `analyse`, keep their order and add `goals` as the
  last parameter, with a default.

## Goal

Each goal draws its line: calories, gym time, walk time and the target weight. A null goal
draws no goal line, and the chart falls back to its average line. Today's week card shows
`sessions 3 / 4` when a sessions goal is set.

## Decisions in this step

- **1 rule, 1 helper.** `goalOrAverage` in `DailyBars.tsx` picks the line for every bar chart.
- **The walk chart** is a new bar card, `Walk`, after `Steps`. Bars in `data-cyan`, the walk
  token. Values in minutes, as the gym time chart. I1, later, adds `walk` to `STATS_CARD_IDS`.
- **The weight target** is a dashed reference line at the target in the display unit. The
  line extends the y range (`ifOverflow="extendDomain"`), so a far target still shows. Its
  label `target 72.0` always sits in the band row. This is a new named exception in
  `charts.md`: the weight chart has line end labels on the right and min and max labels on
  the left, so no spot beside the line is safe at 320 px.
- With 1 logged weight, the chart shows the sparse value, and no line, as today.

## Do

1. Run the `test-writer` agent with the acceptance list. The tests come first.
2. `components/charts/rangeData.ts`:
   - `DayPoint` gets `walkSeconds: number | null`, from `row?.walk_seconds ?? null`. I1 runs
     after this step and adds `walk` to `STATS_CARD_IDS`. Do not add a card id here.
   - Add the goals:

     ```ts
     export type ChartGoals = {
       calories: number | null
       gymSeconds: number | null
       walkSeconds: number | null
       weightKg: number | null
     }

     export const NO_GOALS: ChartGoals = {
       calories: null,
       gymSeconds: null,
       walkSeconds: null,
       weightKg: null,
     }

     export function chartGoals(
       profile: Pick<
         Profile,
         'calorie_goal' | 'gym_goal_seconds' | 'walk_goal_seconds' | 'target_weight_kg'
       >,
     ): ChartGoals {
       return {
         calories: profile.calorie_goal ?? null,
         gymSeconds: profile.gym_goal_seconds ?? null,
         walkSeconds: profile.walk_goal_seconds ?? null,
         weightKg: profile.target_weight_kg,
       }
     }
     ```

     The 3 new columns are optional in the local `Profile` (D1), so each read uses `?? null`.

   - `AnalyticsData` gets `goals: ChartGoals`. `analyse` takes `goals: ChartGoals = NO_GOALS`
     as its last parameter and returns it.
3. `components/charts/useAnalytics.ts`: pass `chartGoals(profile)` as the last argument of
   `analyse`.
4. `components/charts/DailyBars.tsx`:
   - `dataKey` becomes `'calories' | 'steps' | 'gymSeconds' | 'walkSeconds'`.
   - Add:

     ```ts
     export function goalOrAverage(
       goal: number | null,
       average: number | null,
       format: (value: number) => string,
     ): Reference | null {
       if (goal !== null) {
         return { value: goal, label: `goal ${format(goal)}` }
       }

       return average === null || average === 0
         ? null
         : { value: average, label: `avg ${format(average)}` }
     }
     ```

5. `components/charts/CaloriesChart.tsx`:
   - Props get `goal?: number | null`, default `null`.
   - `reference={goalOrAverage(goal, average, compactNumber)}`.
   - The label:

     ```ts
     export function caloriesLabel(
       values: readonly number[],
       average: number | null,
       goal: number | null = null,
     ): string {
       const base = `Calories per day, ${trendWord(values)}: ${countList(values)} kcal. Total ${formatCount(sum(values))} kcal.`

       if (goal !== null) {
         return `${base} Goal ${formatCount(goal)} kcal a day.`
       }

       return average === null
         ? base
         : `${base} Average ${formatCount(Math.round(average))} kcal a day.`
     }
     ```

6. `components/charts/TotalsChart.tsx`:
   - Props get `goalSeconds?: number | null`, default `null`.
   - `reference={goalOrAverage(goalSeconds, average, minutes)}`.
   - `totalsLabel(totals, tab, average = null, goal: number | null = null)`: with a goal,
     end with `Goal ${minutes(goal)} a day.` instead of the average sentence.
7. `components/charts/WalkChart.tsx`, new:

   ```tsx
   'use client'

   import { colorTokens } from '../../lib/design/tokens'
   import { formatDuration } from '../../lib/duration'

   import { ChartCard } from './ChartCard'
   import { DailyBars, goalOrAverage } from './DailyBars'
   import { averagePerLoggedDay, loggedDays, presentValues, sum, trendWord } from './rangeData'
   import { minutes } from './TotalsChart'

   import type { DayPoint, RangeTab } from './rangeData'

   export type WalkChartProps = {
     days: DayPoint[]
     tab: RangeTab
     goalSeconds?: number | null
     className?: string
   }

   export function walkLabel(
     values: readonly number[],
     average: number | null,
     goal: number | null,
   ): string {
     const base = `Walk time per day, ${trendWord(values)}: ${values.map(minutes).join(', ')}. Total ${formatDuration(sum(values), 'short')}.`

     if (goal !== null) {
       return `${base} Goal ${minutes(goal)} a day.`
     }

     return average === null ? base : `${base} Average ${minutes(average)} a logged day.`
   }

   export function WalkChart({ days, tab, goalSeconds = null, className }: WalkChartProps) {
     const values = presentValues(days.map((day) => day.walkSeconds))
     const average = averagePerLoggedDay(sum(values), loggedDays(days))

     return (
       <ChartCard
         title="Walk"
         summary={`${formatDuration(sum(values), 'short')} total`}
         empty={values.length === 0}
         emptyText="Log your walk time to see it per day."
         label={walkLabel(values, average, goalSeconds)}
         className={className}
       >
         <DailyBars
           days={days}
           dataKey="walkSeconds"
           color={colorTokens['data-cyan']}
           tab={tab}
           formatValue={minutes}
           reference={goalOrAverage(goalSeconds, average, minutes)}
         />
       </ChartCard>
     )
   }
   ```

8. `components/charts/WeightChart.tsx`:
   - Props get `targetKg?: number | null`, default `null`.
   - Import `ReferenceLine` from `recharts`, `REFERENCE_STROKE` from `./chartStyle`, and
     `BAND_HEIGHT` and `ReferenceLabel` from `./DailyBars`.
   - `const target = targetKg === null ? null : toDisplayWeight(targetKg, unit)`.
   - `LineChart` `margin.top` becomes `target === null ? 10 : 10 + BAND_HEIGHT`.
   - After the lines:

     ```tsx
     {
       target === null ? null : (
         <ReferenceLine
           y={target}
           {...REFERENCE_STROKE}
           ifOverflow="extendDomain"
           label={<ReferenceLabel text={`target ${formatKg(target)}`} placement="band" />}
         />
       )
     }
     ```

   - `weightLabel` today returns early when there is no average. The target sentence must
     come in both cases, so it becomes:

     ```ts
     export function weightLabel(
       weights: readonly number[],
       averages: readonly number[],
       unit: UnitSystem = 'metric',
       target: number | null = null,
     ): string {
       const base = `Weight per day: ${weights.map(formatKg).join(', ')} ${weightWord(unit)}.`
       const last = averages.at(-1)
       const trend =
         averages.length < 2 || last === undefined
           ? ''
           : ` Seven day average ${trendWord(averages)}, ${formatKg(last)} on the last day.`
       const goal = target === null ? '' : ` Target ${formatKg(target)} ${weightWord(unit)}.`

       return `${base}${trend}${goal}`
     }
     ```

     `WeightChart` passes `target`, already in the display unit.
9. `components/charts/Analytics.tsx`, `AnalyticsView`:

   ```tsx
   <WeightChart days={data.days} tab={data.tab} unit={data.unitSystem} targetKg={data.goals.weightKg} />
   <CaloriesChart days={data.days} tab={data.tab} goal={data.goals.calories} />
   <StepsChart days={data.days} tab={data.tab} stepGoal={data.stepGoal} />
   <WalkChart days={data.days} tab={data.tab} goalSeconds={data.goals.walkSeconds} />
   ```

   and `TotalsChart` gets `goalSeconds={data.goals.gymSeconds}`. Keep the other cards.

10. `components/dashboard/summary.ts`: `DashboardSummary` gets `sessionsGoal: number | null`,
    from `profile.sessions_per_week_goal ?? null`.
11. `components/dashboard/WeekTotalsCard.tsx`:
    - Props get `sessionsGoal?: number | null`, default `null`.
    - The cell value becomes a `ReactNode`. The sessions cell:

      ```tsx
      export function sessionsValue(sessions: number, goal: number | null): ReactNode {
        if (goal === null) {
          return String(sessions)
        }

        return (
          <>
            <span aria-hidden="true">{`${String(sessions)} / ${String(goal)}`}</span>
            <span className="sr-only">{`${String(sessions)} of ${String(goal)}`}</span>
          </>
        )
      }
      ```

    - `Dashboard.tsx` passes `sessionsGoal={summary.sessionsGoal}`.
12. `.claude/skills/design-system/references/charts.md`, rule 3: add the walk chart to the
    list of charts that use the one label, and add the named exception: "**The weight target
    label always sits in the band.** The weight chart has end labels on the right and range
    labels on the left. `WeightChart.tsx` holds the rule."
13. `/styleguide`, Analytics section: the full sample uses goals (calories 800, gym 45 min,
    walk 60 min, target 72 kg). Add the walk chart. "One logged day" and "Nothing logged"
    keep no goal.
14. Plate `p5` (Analytics): add the walk card after steps, change the calories and gym time
    labels to `goal …`, add the weight target line with its label in the band. Plate `p1`
    (Dashboard): the week card reads `3 / 4` sessions.
15. `tests/e2e/journey.spec.ts`, the test "renders every analytics chart with no console
    error". The `analytics-grid` now holds 8 cards, because the walk card joins it. The
    seeded week in `tests/e2e/support/signedIn.ts` has walk time, so the walk card draws:

    ```ts
    await expect(grid.locator(':scope > *')).toHaveCount(8)
    ```

    and `expect(drawn).toEqual([true, true, true, true, true, true, true, true])`.

## Acceptance criteria

- [ ] `goalOrAverage` returns the goal when set, else the average, else null, and null for an average of 0.
- [ ] `analyse` returns the goals it is given, and `NO_GOALS` by default.
- [ ] `analyse` fills `walkSeconds` per day.
- [ ] `chartGoals` maps the 4 profile columns.
- [ ] `useAnalytics` hands the profile goals to the data.
- [ ] Calories with a goal draws `goal 800` and says `Goal 800 kcal a day.` Without one, it keeps the average.
- [ ] Gym time with a goal draws `goal 45m` and says `Goal 45m a day.` Without one, it keeps the average.
- [ ] Walk draws its bars in minutes, its goal line, and its empty state.
- [ ] Weight with a target draws `target 72.0`, in pounds for imperial, and names it in the label.
- [ ] Weight with 1 logged day draws no target line.
- [ ] Steps keeps its goal line as before.
- [ ] `WeekTotalsCard` shows `3 / 4` and reads `3 of 4` with a goal, and `3` without one.
- [ ] No label overlaps another at 320 px, 390 px and 430 px (`tests/e2e/analytics.spec.ts`).
- [ ] A null goal draws no goal line, and the chart keeps its average line. Tests: the
      "without a goal" cases in `CaloriesChart.test.tsx`, `TotalsChart.test.tsx` and
      `WalkChart.test.tsx`.
- [ ] A profile from before Dexie v5, with no goal fields at all, gives `NO_GOALS` and
      `sessionsGoal: null`. Test: `chartGoals` in `rangeData.test.tsx` and the summary
      case in `summary.test.tsx`.
- [ ] The C1 and C4 behaviour stays: the Stats tabs keep their data during a tab switch,
      and the week card still shows the C4 range label. Tests: the existing
      `useAnalytics.test.tsx` and `WeekTotalsCard.test.tsx` cases pass unchanged.
- [ ] Every chart keeps its text alternative: each `aria-label` names the goal or the
      average. Tests: the label cases above, and axe in `tests/e2e/a11y.spec.ts`.
- [ ] The journey test finds 8 drawn cards in `analytics-grid`, the walk card among them.
      Test: "renders every analytics chart with no console error" in
      `tests/e2e/journey.spec.ts`.
- [ ] `charts.md` names the walk chart and the weight target exception. Manual check.
- [ ] Plates `p5` and `p1` show the walk card, the goal labels, the target line and
      `3 / 4`. Manual check: the `ui-reviewer` agent reports no drift.

## Tests

`components/charts/DailyBars.test.tsx`, add:

```tsx
describe('goalOrAverage', () => {
  const format = (value: number) => String(Math.round(value))

  it('takes the goal when the profile holds one', () => {
    expect(goalOrAverage(800, 603, format)).toEqual({ value: 800, label: 'goal 800' })
  })

  it('takes the average when there is no goal', () => {
    expect(goalOrAverage(null, 603, format)).toEqual({ value: 603, label: 'avg 603' })
  })

  it('draws no line with no goal and no average', () => {
    expect(goalOrAverage(null, null, format)).toBeNull()
  })

  it('draws no line for an average of 0', () => {
    expect(goalOrAverage(null, 0, format)).toBeNull()
  })
})
```

`components/charts/rangeData.test.tsx`, add:

```tsx
describe('analyse goals', () => {
  const goals = { calories: 800, gymSeconds: 2700, walkSeconds: 3600, weightKg: 72 }

  it('returns the goals it is given', () => {
    expect(analyse([], [], 'week', TODAY, NOW, 12000, 'metric', goals).goals).toEqual(goals)
  })

  it('returns no goal by default', () => {
    expect(analyse([], [], 'week', TODAY, NOW, 12000).goals).toEqual(NO_GOALS)
  })

  it('fills the walk seconds of each day', () => {
    const data = analyse([entryOn(TODAY, { walk_seconds: 1500 })], [], 'week', TODAY, NOW, 12000)
    expect(data.days.find((day) => day.date === TODAY)?.walkSeconds).toBe(1500)
  })
})

describe('chartGoals', () => {
  it('maps the 4 profile columns', () => {
    expect(
      chartGoals({
        calorie_goal: 800,
        gym_goal_seconds: 2700,
        walk_goal_seconds: 3600,
        target_weight_kg: 72,
      }),
    ).toEqual({ calories: 800, gymSeconds: 2700, walkSeconds: 3600, weightKg: 72 })
  })

  it('gives no goal for a profile from before Dexie v5', () => {
    expect(chartGoals({ target_weight_kg: null })).toEqual(NO_GOALS)
  })
})
```

`components/charts/CaloriesChart.test.tsx`, add:

```tsx
it('draws the goal line instead of the average when a goal is set', () => {
  const { container } = render(<CaloriesChart days={full.days} tab="week" goal={800} />)
  expect(svgTexts(container, REFERENCE_LABELS)).toEqual(['goal 800'])
})

it('names the goal in its label', () => {
  render(<CaloriesChart days={full.days} tab="week" goal={800} />)
  expect(
    screen.getByRole('img', {
      name: 'Calories per day, falling: 620, 780, 410 kcal. Total 1,810 kcal. Goal 800 kcal a day.',
    }),
  ).toBeInTheDocument()
})

it('keeps the goal line for one logged day', () => {
  const { container } = render(<CaloriesChart days={one.days} tab="week" goal={800} />)
  expect(svgTexts(container, REFERENCE_LABELS)).toEqual(['goal 800'])
})
```

`components/charts/TotalsChart.test.tsx`, add:

```tsx
it('draws the gym time goal instead of the average when a goal is set', () => {
  const { container } = render(
    <TotalsChart days={full.days} totals={full.totals} tab="week" goalSeconds={2700} />,
  )
  expect(svgTexts(container, REFERENCE_LABELS)).toEqual(['goal 45m'])
})

it('names the gym time goal in its label', () => {
  render(<TotalsChart days={full.days} totals={full.totals} tab="week" goalSeconds={2700} />)
  expect(
    screen.getByRole('img', {
      name: 'Time in the gym per day this week. Totals: 2 sessions, 1h 30m in the gym, 1,000 kcal, 12,000 steps. Goal 45m a day.',
    }),
  ).toBeInTheDocument()
})
```

`components/charts/WalkChart.test.tsx`, new:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { entryOn, NOW, TODAY } from '../../tests/fixtures/dashboard'
import { REFERENCE_LABELS, svgTexts, VALUE_LABELS } from '../../tests/fixtures/recharts'

import { analyse } from './rangeData'
import { walkLabel, WalkChart } from './WalkChart'

vi.mock('recharts', async (importOriginal) => {
  const { withFixedContainer } = await import('../../tests/fixtures/recharts')
  return withFixedContainer(await importOriginal<object>())
})

const empty = analyse([], [], 'week', TODAY, NOW, 12000)
const entries = [
  entryOn('2026-09-21', { walk_seconds: 1800 }),
  entryOn('2026-09-22', { walk_seconds: 2700 }),
  entryOn(TODAY, { walk_seconds: 3600 }),
]
const full = analyse(entries, entries, 'week', TODAY, NOW, 12000)
const one = analyse([entryOn(TODAY, { walk_seconds: 1500 })], [], 'week', TODAY, NOW, 12000)

describe('WalkChart', () => {
  it('shows its empty state for an empty series, without throwing', () => {
    render(<WalkChart days={empty.days} tab="week" />)
    expect(screen.getByText('Log your walk time to see it per day.')).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows the total beside the title', () => {
    render(<WalkChart days={full.days} tab="week" />)
    expect(screen.getByText('2h 15m total')).toBeVisible()
  })

  it('writes minutes above each bar, with the average over the logged days', () => {
    const { container } = render(<WalkChart days={full.days} tab="week" />)
    expect(svgTexts(container, VALUE_LABELS)).toEqual(['30m', '45m', '60m'])
    expect(svgTexts(container, REFERENCE_LABELS)).toEqual(['avg 45m'])
  })

  it('draws the goal line instead of the average when a goal is set', () => {
    const { container } = render(<WalkChart days={full.days} tab="week" goalSeconds={3600} />)
    expect(svgTexts(container, REFERENCE_LABELS)).toEqual(['goal 60m'])
  })

  it('keeps the goal line for one logged day', () => {
    const { container } = render(<WalkChart days={one.days} tab="week" goalSeconds={3600} />)
    expect(svgTexts(container, VALUE_LABELS)).toEqual(['25m'])
    expect(svgTexts(container, REFERENCE_LABELS)).toEqual(['goal 60m'])
  })
})

describe('walkLabel', () => {
  it('names the trend, the values, the total and the goal', () => {
    expect(walkLabel([1800, 2700, 3600], 2700, 3600)).toBe(
      'Walk time per day, rising: 30m, 45m, 60m. Total 2h 15m. Goal 60m a day.',
    )
  })

  it('names the average when there is no goal', () => {
    expect(walkLabel([1800, 3600], 2700, null)).toBe(
      'Walk time per day, rising: 30m, 60m. Total 1h 30m. Average 45m a logged day.',
    )
  })

  it('names neither with 1 logged day and no goal', () => {
    expect(walkLabel([1500], null, null)).toBe('Walk time per day, one day logged: 25m. Total 25m.')
  })
})
```

`components/charts/WeightChart.test.tsx`, add (with `REFERENCE_LABELS` in the import):

```tsx
describe('WeightChart target', () => {
  it('draws the target line with its value', () => {
    const { container } = render(<WeightChart days={full.days} tab="week" targetKg={72} />)
    expect(svgTexts(container, REFERENCE_LABELS)).toEqual(['target 72.0'])
  })

  it('draws the target in pounds for imperial', () => {
    const { container } = render(
      <WeightChart days={inPounds.days} tab="week" unit="imperial" targetKg={70} />,
    )
    expect(svgTexts(container, REFERENCE_LABELS)).toEqual(['target 154.3'])
  })

  it('names the target in its label', () => {
    expect(weightLabel([74.1, 73.4], [], 'metric', 72)).toBe(
      'Weight per day: 74.1, 73.4 kilograms. Target 72.0 kilograms.',
    )
  })

  it('draws no target line for 1 logged day', () => {
    const { container } = render(<WeightChart days={one.days} tab="week" targetKg={72} />)
    expect(svgTexts(container, REFERENCE_LABELS)).toEqual([])
  })

  it('draws no target line without a target', () => {
    const { container } = render(<WeightChart days={full.days} tab="week" />)
    expect(svgTexts(container, REFERENCE_LABELS)).toEqual([])
  })
})
```

`components/charts/useAnalytics.test.tsx`, add:

```tsx
it('hands the profile goals to the data', async () => {
  vi.mocked(getProfile).mockResolvedValue({ ...PROFILE, calorie_goal: 800, target_weight_kg: 72 })
  const { result } = renderHook(() => useAnalytics('week', clock))
  await waitFor(() => {
    expect(result.current.status).toBe('ready')
  })
  expect(result.current.status === 'ready' && result.current.data.goals).toEqual({
    calories: 800,
    gymSeconds: null,
    walkSeconds: null,
    weightKg: 72,
  })
})
```

Use the mock and the `clock` that the file already has.

`components/charts/Analytics.test.tsx`: add `it('shows the walk chart after the steps chart')`
that reads the card headings in order.

`components/dashboard/WeekTotalsCard.test.tsx`, add:

```tsx
it('shows the sessions against the goal, and reads it in words', () => {
  render(<WeekTotalsCard totals={TOTALS} range={RANGE} sessionsGoal={4} />)
  expect(screen.getByText('3 / 4')).toHaveAttribute('aria-hidden', 'true')
  expect(screen.getByText('3 of 4')).toHaveClass('sr-only')
})

it('shows the bare count with no goal', () => {
  render(<WeekTotalsCard totals={TOTALS} range={RANGE} sessionsGoal={null} />)
  expect(screen.getByText('3')).toBeInTheDocument()
  expect(screen.queryByText('3 / 4')).toBeNull()
})
```

`components/dashboard/summary.test.tsx`, add:

```tsx
it('takes the sessions per week goal from the profile', () => {
  expect(summarise([], { ...PROFILE, sessions_per_week_goal: 4 }, TODAY, NOW).sessionsGoal).toBe(4)
})

it('gives no sessions goal for a profile with no goal field', () => {
  expect(summarise([], PROFILE, TODAY, NOW).sessionsGoal).toBeNull()
})
```

`RANGE` is the week range C4 added to `WeekTotalsCard.test.tsx`. If C3 or C4 changed the
parameters of `summarise`, call it the way the other cases in `summary.test.tsx` do.

`tests/e2e/analytics.spec.ts`: in the seeded profile of the full week case, set
`calorie_goal`, `gym_goal_seconds`, `walk_goal_seconds` and `target_weight_kg`, so the
overlap check runs with every goal line drawn.

## Verification

1. `pnpm test:cov`.
2. The `ui-reviewer` agent reports no drift against plates `p5` and `p1`.
3. Check `/analytics` (week, month, day) and `/` at 390 px, 768 px and 1440 px, once with
   every goal set and once with none.
4. `pnpm verify:parallel`.

## Files touched

- `components/charts/rangeData.ts` and its test
- `components/charts/useAnalytics.ts` and its test
- `components/charts/DailyBars.tsx` and its test
- `components/charts/CaloriesChart.tsx` and its test
- `components/charts/TotalsChart.tsx` and its test
- `components/charts/WalkChart.tsx` and its test
- `components/charts/WeightChart.tsx` and its test
- `components/charts/Analytics.tsx` and its test
- `components/dashboard/summary.ts` and its test
- `components/dashboard/WeekTotalsCard.tsx` and its test
- `components/dashboard/Dashboard.tsx`
- `.claude/skills/design-system/references/charts.md`
- `app/styleguide/page.tsx` and its test
- `docs/design/prototype/index.html` (plates `p5` and `p1`)
- `tests/e2e/analytics.spec.ts`
- `tests/e2e/journey.spec.ts`

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer when
   another step runs its e2e suite. Never skip a check, and never add a design-check or
   test exemption to pass.
2. Stage the files of step 3 with the same `git add` line first. The skill describes the
   staged diff, and it refuses to run when nothing is staged. Then run the `commit-report`
   skill.
   The report needs screenshots of every changed page at 390, 768 and 1440 px, next
   to the matching prototype plate.
3. Commit on `fix/g2-goal-lines`:

   ```bash
   git add components/charts/rangeData.ts \
     components/charts/rangeData.test.tsx \
     components/charts/useAnalytics.ts \
     components/charts/useAnalytics.test.tsx \
     components/charts/DailyBars.tsx \
     components/charts/DailyBars.test.tsx \
     components/charts/CaloriesChart.tsx \
     components/charts/CaloriesChart.test.tsx \
     components/charts/TotalsChart.tsx \
     components/charts/TotalsChart.test.tsx \
     components/charts/WalkChart.tsx \
     components/charts/WalkChart.test.tsx \
     components/charts/WeightChart.tsx \
     components/charts/WeightChart.test.tsx \
     components/charts/Analytics.tsx \
     components/charts/Analytics.test.tsx \
     components/dashboard/summary.ts \
     components/dashboard/summary.test.tsx \
     components/dashboard/WeekTotalsCard.tsx \
     components/dashboard/WeekTotalsCard.test.tsx \
     components/dashboard/Dashboard.tsx \
     .claude/skills/design-system/references/charts.md \
     app/styleguide/page.tsx \
     app/styleguide/page.test.tsx \
     docs/design/prototype/index.html \
     tests/e2e/analytics.spec.ts \
     tests/e2e/journey.spec.ts
   git commit -m "feat(charts): draw a goal line for each profile goal"
   ```

   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.

4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked,
   and anything the owner must check on the iPhone.
