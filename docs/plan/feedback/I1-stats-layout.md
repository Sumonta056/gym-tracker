# Step I1 — Reorder and hide the Stats cards

**Branch:** `fix/i1-stats-layout`, in worktree `../gym-tracker-i1`, cut from `fix/feedback-fixes` ·
**Wave:** 12 · **Size:** M · **Depends on:** W0, C1, C3, D1, G2, H2 · **Unlocks:** the I
checkpoint, which closes the track · **Skills to load:** `design-system` ·
**Agent to use:** `test-writer` for the tests, then `ui-reviewer`

Item 11: "Swap widget in stats". The card order is hard coded in 3 files:
`Analytics.tsx` (`AnalyticsView`), `LiftCharts.tsx` and `WeekCharts.tsx`.

## Before you start

1. Make the worktree:

   ```bash
   cd /Users/cefalo_1/Documents/Projects/gym-tracker
   git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-i1 -b fix/i1-stats-layout fix/feedback-fixes
   cd ../gym-tracker-i1
   cp ../gym-tracker/.env.local ../gym-tracker/.env.test.local .
   export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"
   pnpm install
   ```

   If you are already in that worktree on that branch, skip this block.

2. Dependency checks. Run them from the worktree root. Each line prints `FAIL` and the
   step name when that step is not in `fix/feedback-fixes`:

   ```bash
   test -f scripts/e2e-lock.mjs || echo "FAIL W0: scripts/e2e-lock.mjs is missing"
   grep -qs "export const LineDrawContext" components/charts/useLineDraw.ts || echo "FAIL C1: LineDrawContext is missing in components/charts/useLineDraw.ts"
   grep -qs "export function sessionsByDate" lib/metrics/sessionDays.ts || echo "FAIL C3: sessionsByDate is missing in lib/metrics/sessionDays.ts"
   grep -qs "sessionDates" components/charts/WeekCharts.tsx || echo "FAIL C3: WeekCharts has no sessionDates prop"
   grep -qs "export const statsLayoutItemSchema" lib/schema/profile.ts || echo "FAIL D1: statsLayoutItemSchema is missing in lib/schema/profile.ts"
   test -f components/charts/WalkChart.tsx || echo "FAIL G2: components/charts/WalkChart.tsx is missing"
   grep -qs "export const NO_GOALS" components/charts/rangeData.ts || echo "FAIL G2: NO_GOALS is missing in components/charts/rangeData.ts"
   grep -qs "export function zoneBands" lib/metrics/heartRateZones.ts || echo "FAIL H2: zoneBands is missing in lib/metrics/heartRateZones.ts"
   test -f components/dashboard/ZoneInfo.tsx || echo "FAIL H2: components/dashboard/ZoneInfo.tsx is missing"
   ```

   If any check fails, the step it names is not merged into `fix/feedback-fixes`. Stop. Report which
   check failed. Do not do that step's work here.

3. Already done check:

   ```bash
   test -f components/charts/statsCards.ts && echo "I1 is already done"
   ```

   If it prints, stop and report.

## Names this step uses from earlier steps

- D1, `lib/schema/profile.ts`:

  ```ts
  export const MAX_STATS_CARDS = 40
  export const MAX_STATS_CARD_ID_LENGTH = 40
  export const statsLayoutItemSchema = z.object({
    id: z.string().min(1).max(MAX_STATS_CARD_ID_LENGTH),
    hidden: z.boolean(),
  })
  export type StatsLayoutStored = z.infer<typeof statsLayoutItemSchema>
  ```

  `profileSchema.stats_layout` is an array of that item, at most 40 long, nullable, default
  `null`. In the local `Profile` it is **optional**, so read it with `?? null`. The
  schema accepts any short id. This step drops the ids it does not know.

- C1, `components/charts/useAnalytics.ts`: `useAnalytics(tab, clock?)` returns
  `{ status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: AnalyticsData }`.
  It reads the profile once per mount, and computes `data` inside a `useMemo` from
  `loaded.source`, which holds `profile`.
- C3: `AnalyticsData.sessionDates: string[]`, and `WeekCharts` takes the prop
  `sessionDates: string[]`. `SessionGapChart` takes `dates={sessionDates}`.
- G2: `components/charts/WalkChart.tsx` renders the `Walk` card after `Steps` in
  `AnalyticsView`, with `goalSeconds={data.goals.walkSeconds}`. `AnalyticsData.goals`
  holds the chart goals. `CaloriesChart`, `TotalsChart` and `WeightChart` take
  `goal={data.goals.calories}`, `goalSeconds={data.goals.gymSeconds}` and
  `targetKg={data.goals.weightKg}`.
- H1 and H2: `ZoneSplitChart` takes `maxHeartRate={data.maxHeartRate}`, and carries the
  `ZoneInfoButton` in its `ChartCard` `action`.

## Context to read first

1. `docs/specs/2026-10-05-feedback-fixes-design.md`, section 3.8 and item 11.
2. "Names this step uses from earlier steps" above. Review focus: a stored
   `stats_layout` from an older build that lacks a new card must still show that card.
3. `components/charts/Analytics.tsx`, `LiftCharts.tsx`, `WeekCharts.tsx`. The 3 groups.
4. `components/charts/useAnalytics.ts` as C1 left it. It reads `getProfile()`.
5. `components/charts/Analytics.test.tsx`, `app/(app)/analytics/page.test.tsx`.
6. `lib/schema/profile.ts`, `stats_layout` from D1. `lib/db/repository.ts`, `updateProfile`.
7. `tests/e2e/journey.spec.ts`, `tests/e2e/support/signedIn.ts` (`openRoute`) and
   `tests/e2e/support/workout.ts`. They read the live grids by test id.
8. `app/styleguide/page.tsx`, the Analytics section. Its e2e tests read
   `analytics-grid*`, `lift-grid*` and `week-grid*`. Those ids must stay.
9. `.claude/rules/accessibility.md`.
10. Load the `design-system` skill. Read `references/charts.md` and
    `references/responsive.md`. Open `docs/design/prototype/index.html`, plates `p5` and
    `p11`.

## State before the step

- 14 cards on `/analytics`, in 3 grids: 8 daily cards in `AnalyticsView`, 3 lift cards
  in `LiftCharts`, 3 week cards in `WeekCharts`. Each grid is `grid-cols-1 md:grid-cols-2`.
- `profile.stats_layout` exists (D1). It is `{ id: string; hidden: boolean }[] | null`.
  Nothing reads it.
- The lift and week cards wait for `useLiftData`. The daily cards wait for `useAnalytics`.

The 14 cards, in the default order, with the id this step gives them:

| Id                    | Card component           | Group | Name in the editor    | Wide |
| --------------------- | ------------------------ | ----- | --------------------- | ---- |
| `weight`              | `WeightChart`            | daily | Weight                | no   |
| `calories`            | `CaloriesChart`          | daily | Calories burnt        | no   |
| `steps`               | `StepsChart`             | daily | Steps                 | no   |
| `walk`                | `WalkChart`              | daily | Walk                  | no   |
| `heart-rate`          | `HeartRateChart`         | daily | Heart rate            | no   |
| `zone-split`          | `ZoneSplitChart`         | daily | Heart rate zones      | no   |
| `streak`              | `StreakHeatMap`          | daily | Streak                | no   |
| `totals`              | `TotalsChart`            | daily | Totals                | yes  |
| `volume-load`         | `VolumeLoadChart`        | lift  | Volume load           | no   |
| `one-rep-max`         | `OneRepMaxChart`         | lift  | One-rep max           | no   |
| `records`             | `RecordList`             | lift  | Personal records      | yes  |
| `muscle-balance`      | `MuscleBalanceChart`     | week  | Muscle group balance  | no   |
| `session-gaps`        | `SessionGapChart`        | week  | Days between sessions | no   |
| `calories-per-minute` | `CaloriesPerMinuteChart` | week  | Calories a gym minute | yes  |

"Wide" is the `md:col-span-2` the card carries today. Check the table against the 3 files
before you start. G2 added `walk`. If C3, C4, G2 or H2 added or renamed another card,
add it here and in the code.

## Goal

`/analytics` renders 1 ordered grid from the layout in the profile. An Edit mode moves a
card up or down and hides or shows it, by touch and by keyboard. Done saves the layout
to the profile, so it syncs. Reset restores the default.

## Decisions

- **Edit mode shows a list, not the charts.** Each row holds the card name, an Up button,
  a Down button and a Show switch. 14 full charts with controls on a phone is a long
  scroll, and a chart canvas gives the controls nothing. The list fits on 1 phone screen.
- **No drag.** Up and Down are real buttons, so touch and keyboard work the same (the
  spec, section 3.8).
- **The styleguide wrappers stay.** `AnalyticsView`, `LiftCharts` and `WeekCharts` keep
  their props and test ids. They render their group through the same `StatsCard`
  renderer as the live grid. The card list lives in 1 place, and the styleguide e2e
  tests keep working.
- **Save on Done, not on every tap.** One profile write and one outbox entry per edit.

## Do

1. Run the `test-writer` agent with the acceptance list below. The tests come first.
2. `components/charts/statsCards.ts`:
   ```ts
   export type StatsCardId =
     | 'weight'
     | 'calories'
     | 'steps'
     | 'walk'
     | 'heart-rate'
     | 'zone-split'
     | 'streak'
     | 'totals'
     | 'volume-load'
     | 'one-rep-max'
     | 'records'
     | 'muscle-balance'
     | 'session-gaps'
     | 'calories-per-minute'

   export type StatsCardGroup = 'daily' | 'lift' | 'week'

   export type StatsCardInfo = { name: string; group: StatsCardGroup; wide: boolean }

   export const STATS_CARDS: Record<StatsCardId, StatsCardInfo> = {
     weight: { name: 'Weight', group: 'daily', wide: false },
     calories: { name: 'Calories burnt', group: 'daily', wide: false },
     steps: { name: 'Steps', group: 'daily', wide: false },
     walk: { name: 'Walk', group: 'daily', wide: false },
     'heart-rate': { name: 'Heart rate', group: 'daily', wide: false },
     'zone-split': { name: 'Heart rate zones', group: 'daily', wide: false },
     streak: { name: 'Streak', group: 'daily', wide: false },
     totals: { name: 'Totals', group: 'daily', wide: true },
     'volume-load': { name: 'Volume load', group: 'lift', wide: false },
     'one-rep-max': { name: 'One-rep max', group: 'lift', wide: false },
     records: { name: 'Personal records', group: 'lift', wide: true },
     'muscle-balance': { name: 'Muscle group balance', group: 'week', wide: false },
     'session-gaps': { name: 'Days between sessions', group: 'week', wide: false },
     'calories-per-minute': { name: 'Calories a gym minute', group: 'week', wide: true },
   }

   export const STATS_CARD_IDS: readonly StatsCardId[] = [
     'weight',
     'calories',
     'steps',
     'walk',
     'heart-rate',
     'zone-split',
     'streak',
     'totals',
     'volume-load',
     'one-rep-max',
     'records',
     'muscle-balance',
     'session-gaps',
     'calories-per-minute',
   ]

   export type StatsLayoutItem = { id: StatsCardId; hidden: boolean }

   export type StoredLayoutItem = { id: string; hidden: boolean }

   export function isStatsCardId(id: string): id is StatsCardId {
     return Object.hasOwn(STATS_CARDS, id)
   }

   export function cardsInGroup(group: StatsCardGroup): StatsCardId[] {
     return STATS_CARD_IDS.filter((id) => STATS_CARDS[id].group === group)
   }

   export function resolveLayout(stored: readonly StoredLayoutItem[] | null): StatsLayoutItem[] {
     const result: StatsLayoutItem[] = []
     const placed = new Set<StatsCardId>()

     for (const item of stored ?? []) {
       if (isStatsCardId(item.id) && !placed.has(item.id)) {
         placed.add(item.id)
         result.push({ id: item.id, hidden: item.hidden })
       }
     }

     STATS_CARD_IDS.forEach((id, index) => {
       if (placed.has(id)) {
         return
       }

       const before = STATS_CARD_IDS.slice(0, index).findLast((earlier) => placed.has(earlier))
       const at = before === undefined ? 0 : result.findIndex((item) => item.id === before) + 1

       result.splice(at, 0, { id, hidden: false })
       placed.add(id)
     })

     return result
   }

   export function moveCard(
     layout: readonly StatsLayoutItem[],
     id: StatsCardId,
     by: -1 | 1,
   ): StatsLayoutItem[] {
     const from = layout.findIndex((item) => item.id === id)
     const to = from + by
     const moving = layout[from]
     const other = layout[to]

     if (moving === undefined || other === undefined) {
       return [...layout]
     }

     const next = [...layout]
     next[from] = other
     next[to] = moving

     return next
   }

   export function setHidden(
     layout: readonly StatsLayoutItem[],
     id: StatsCardId,
     hidden: boolean,
   ): StatsLayoutItem[] {
     return layout.map((item) => (item.id === id ? { ...item, hidden } : item))
   }
   ```
   A missing id goes right after the nearest card that comes before it in the default
   order, or first when none does. A duplicate id keeps its first place. An unknown id
   is dropped. `resolveLayout` takes `StoredLayoutItem[]`, not `StatsLayoutItem[]`,
   because a row from an older or newer build may hold an id this build does not know.
3. `components/charts/StatsCard.tsx`, the one renderer:
   ```tsx
   export type StatsCardContext = {
     daily: AnalyticsData | null
     lifts: { analysis: LiftAnalytics; unit: UnitSystem } | null
     week: { source: LiftSource; days: DayPoint[]; today: string; sessionDates: string[] } | null
   }

   export function StatsCard({ id, context }: { id: StatsCardId; context: StatsCardContext })
   ```
   It returns the card element for `id` with the same props each card gets today, and
   `className="md:col-span-2"` when `STATS_CARDS[id].wide`. It returns `null` when the
   group input for `id` is `null`. Copy each card's props from the 3 files as they stand
   after C3, C4, G2 and H2, for example `ZoneSplitChart` with `maxHeartRate`,
   `WalkChart` with `goalSeconds`, and `SessionGapChart` with the all-history input from
   C3. Use a `switch` on `id` with 1
   `case` per id.
4. Rewrite the 3 wrappers to use it. Props, test ids and grid classes stay the same:
   - `AnalyticsView`: context `{ daily: data, lifts: null, week: null }`, renders
     `cardsInGroup('daily')`.
   - `LiftCharts`: computes `analyseLifts(...)` as today, context
     `{ daily: null, lifts: { analysis, unit }, week: null }`, renders
     `cardsInGroup('lift')`.
   - `WeekCharts`: context
     `{ daily: null, lifts: null, week: { source, days, today, sessionDates } }`, renders
     `cardsInGroup('week')`. `sessionDates` is the prop C3 added.
5. `components/charts/StatsGrid.tsx`:
   ```tsx
   export const ALL_HIDDEN = 'Every card is hidden. Choose Edit to show one.'

   export type StatsGridProps = {
     layout: readonly StatsLayoutItem[]
     context: StatsCardContext
     testId?: string
   }

   export function StatsGrid({ layout, context, testId = 'stats-grid' }: StatsGridProps) {
     const shown = layout.filter((item) => !item.hidden)

     if (shown.length === 0) {
       return <p className="text-muted mt-4 text-sm">{ALL_HIDDEN}</p>
     }

     return (
       <div data-testid={testId} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
         {shown.map((item) => (
           <StatsCard key={item.id} id={item.id} context={context} />
         ))}
       </div>
     )
   }
   ```
   2 columns from `md` up, and no `lg:grid-cols-3`: chart screens keep 2 columns.
6. `components/charts/StatsLayoutEditor.tsx`:
   - Props: `layout: readonly StatsLayoutItem[]`, `onChange: (layout: StatsLayoutItem[]) => void`.
   - A `Card` with `<h2><MicroLabel>Stats cards</MicroLabel></h2>` and an
     `<ol aria-label="Stats cards">`. 1 `<li data-card-id={item.id}>` per item, in
     layout order, `flex min-h-11 items-center gap-2`.
   - The name: `STATS_CARDS[item.id].name` in `text-text text-[15px] font-bold`
     (`text-muted` when hidden), then ` · Hidden` in `text-muted text-xs` when hidden. The
     state is text, not only a colour.
   - Up: `<button type="button" id={`${prefix}-${item.id}-up`} aria-label={`Move ${name} up`}
disabled={index === 0}>`. Down: the same with `down`, disabled on the last row. The
     arrow glyph `↑` or `↓` sits in `<span aria-hidden="true">`. Copy the round 44 px
     classes of the `SheetModal` close button. `prefix` comes from `useId()`.
   - Show: `<button type="button" role="switch" aria-checked={!item.hidden}
aria-label={`Show ${name}`}>`, `h-11 w-14`, holding a 28 px track (`bg-accent` on,
     `bg-surface-2` off, `border-border`) and a thumb (`bg-accent-ink` on, `bg-dim` off).
     The thumb moves with `translate-x`, under a `motion-safe:` transition.
   - A move calls `onChange(moveCard(layout, id, by))`, then keeps the focus on the
     pressed button. Store `{ id, by }` in a ref. In a `useLayoutEffect` on `layout`, focus
     `${prefix}-${id}-up` or `-down`. When that button is now disabled, focus the other
     one. A moved DOM node loses focus in some browsers, so never trust it to keep it.
   - The switch calls `onChange(setHidden(layout, id, !item.hidden))`.
7. `components/charts/useAnalytics.ts`: the ready state carries
   `layout: StatsLayoutItem[]`, from `resolveLayout(loaded.source.profile.stats_layout)`,
   next to `data`, inside the `useMemo` C1 added. C1 reads the profile once per mount, so
   a tab switch does not read the layout again. That is why `Analytics` keeps the saved
   layout in its own state after Done.
8. `components/charts/Analytics.tsx`:
   - New props: `save?: (patch: Partial<Profile>) => Promise<unknown>`, default
     `updateProfile` from `lib/db/repository`.
   - State: `editing: boolean`, `draft: StatsLayoutItem[] | null`,
     `saved: StatsLayoutItem[] | null`, `saveError: string | null`.
   - `const layout = saved ?? (state.status === 'ready' ? state.layout : resolveLayout(null))`.
   - Under `RangeTabs`, a row `mt-3 flex justify-end`. Out of edit mode it holds 1 button
     `type="button"`, text "Edit", disabled until the state is ready. Classes: `text-text bg-surface-2 border-border inline-flex min-h-11
items-center rounded-full border px-4 text-[13px] font-bold`. `SecondaryButton` is
     always full width, so it does not fit here.
   - Edit sets `draft` to a copy of `layout` and `editing` to true.
   - In edit mode: `<StatsLayoutEditor layout={draft} onChange={setDraft} />`, then a
     `mt-3 grid grid-cols-2 gap-2` row with `SecondaryButton` "Reset" and `PrimaryButton`
     "Done" (`type="button"`).
   - Reset: `setDraft(resolveLayout(null))`. Nothing is saved until Done.
   - Done: `await save({ stats_layout: draft })`. On success: `saved = draft`,
     `editing = false`, `draft = null`, `saveError = null`. On failure:
     `saveError = LAYOUT_SAVE_FAILED`, stay in edit mode, show it in
     `<p role="alert" className="text-danger mt-2 text-sm">`.
     `export const LAYOUT_SAVE_FAILED = 'The layout could not be saved on this device.'`
   - Out of edit mode: `<StatsGrid layout={layout} context={context} />` with
     `daily: state.data`, and `lifts` and `week` filled only when
     `lifts.status === 'ready'`. `week` is `{ source: lifts.source, days: state.data.days,
today: state.data.today, sessionDates: state.data.sessionDates }`.
     The loading and error lines for the lifts stay, after the grid.
   - Remove the direct renders of `AnalyticsView`, `LiftCharts` and `WeekCharts` from
     `Analytics`. They stay exported for the styleguide.
9. `app/styleguide/page.tsx`: add a "Stats layout" heading in the Analytics section with
   a `StatsLayoutEditor` sample that holds its own state, under
   `<div data-testid="stats-layout-sample">`.
10. Update the tests that read the live grids by id:
    - `app/(app)/analytics/page.test.tsx`: `analytics-grid`, `lift-grid` and `week-grid`
      become `stats-grid`. The heading checks stay.
    - `tests/e2e/support/signedIn.ts`, `openRoute`: `analytics-grid` becomes `stats-grid`.
    - `tests/e2e/support/workout.ts`: replace the loop over `lift-grid` and `week-grid`
      with:
      ```ts
      const grid = page.getByTestId('stats-grid')
      for (const title of ['Volume load per session', 'Muscle group balance']) {
        await expect(
          grid
            .locator(':scope > *')
            .filter({ has: page.getByRole('heading', { name: title }) })
            .getByRole('img')
            .first(),
        ).toBeVisible()
      }
      ```
    - `tests/e2e/journey.spec.ts`: read `stats-grid`. The grid holds 14 cards once the
      workouts are read. The 8 daily cards come first in the default order, so the
      drawn check reads `cards.slice(0, 8)`:
      ```ts
      const grid = page.getByTestId('stats-grid')
      await expect(grid.locator(':scope > *')).toHaveCount(14)
      ```
      and `expect(drawn.slice(0, 8)).toEqual([true, true, true, true, true, true, true, true])`.
      G2 left this test at 8 cards in `analytics-grid`.
11. `tests/e2e/stats-layout.spec.ts`, new. It uses the styleguide sample, so it never
    changes the shared test account that other specs read in parallel.
12. `docs/design/prototype/index.html`: a new plate after `p11`, `<span class="n">I1</span>`,
    name "Stats, edit the layout", route `/analytics · edit`, `id="p-stats-edit"`. The
    header and range tabs of `p5`, then the list card with 14 rows, "Steps" moved to the
    top, "Weight" hidden with "· Hidden" and its switch off, the first Up and the last
    Down disabled, then the Reset and Done row. On `p5`, add the "Edit" button under the
    range tabs.

## Acceptance criteria

- [ ] `resolveLayout(null)` returns the 14 ids in the default order, `walk` after `steps`,
      none hidden.
- [ ] `resolveLayout` keeps the stored order and the hidden flags.
- [ ] `resolveLayout` drops an unknown id.
- [ ] `resolveLayout` keeps the first of 2 rows with the same id.
- [ ] A stored layout from an older build that lacks a new card gets the card at its default place, shown.
- [ ] A missing first card goes first.
- [ ] `moveCard` swaps a card with its neighbour.
- [ ] `moveCard` returns the same order for the first card moved up and the last card moved down.
- [ ] `moveCard` returns the same order for an id not in the layout.
- [ ] `setHidden` changes only the named card.
- [ ] `/analytics` renders the cards in the stored order.
- [ ] A hidden card is not rendered outside edit mode.
- [ ] With every card hidden, the screen shows "Every card is hidden. Choose Edit to show one."
- [ ] The grid is 1 column, 2 from `md`, and never 3.
- [ ] Edit shows the list. Every row has "Move <name> up", "Move <name> down" and a "Show <name>" switch.
- [ ] Up is disabled on the first row and Down on the last.
- [ ] With the keyboard alone, a card moves up twice and the focus stays on its move buttons.
- [ ] With the keyboard alone, Space on a switch hides the card and the row says "Hidden".
- [ ] Done saves the layout with `updateProfile({ stats_layout })` and leaves edit mode.
- [ ] Reset, then Done, saves the default layout.
- [ ] A refused save shows "The layout could not be saved on this device." and stays in edit mode.
- [ ] The styleguide grids keep their test ids and their cards.
      Test: the styleguide analytics e2e tests pass with no change to them.
- [ ] A stored layout from a build before G2, with no `walk` row, shows the Walk card
      right after Steps. Test: "puts a missing card right after the card before it in
      the default order" in `statsCards.test.ts`.
- [ ] The G2 goal lines and the H2 info button still show inside the reordered grid.
      Tests: `StatsCard.test.tsx` renders `walk` with its goal and `zone-split` with the
      button "What the zones mean".
- [ ] Every Edit control is 44 px or taller and has a label. Test:
      `tests/e2e/responsive.spec.ts` on `/styleguide`, and axe in `tests/e2e/a11y.spec.ts`.
- [ ] The live grid test ids move to `stats-grid`, and the journey test finds 14 cards.
      Tests: `app/(app)/analytics/page.test.tsx` and `tests/e2e/journey.spec.ts`.
- [ ] The layout survives a reload, and syncs to the laptop. Manual check: steps 4 and
      5 of "Verification".
- [ ] Plate `p-stats-edit` exists after `p11`, and `p5` shows the Edit button. Manual
      check: the `ui-reviewer` agent reports no drift.

## Tests

`components/charts/statsCards.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { moveCard, resolveLayout, setHidden, STATS_CARD_IDS } from './statsCards'

import type { StatsLayoutItem } from './statsCards'

const DEFAULT = STATS_CARD_IDS.map((id) => ({ id, hidden: false }))

function ids(layout: readonly StatsLayoutItem[]): string[] {
  return layout.map((item) => item.id)
}

describe('resolveLayout', () => {
  it('returns every card in the default order when nothing is stored', () => {
    expect(resolveLayout(null)).toEqual(DEFAULT)
  })

  it('keeps the stored order and the hidden flags', () => {
    const stored = [...DEFAULT].reverse().map((item, index) => ({ ...item, hidden: index === 0 }))
    expect(resolveLayout(stored)).toEqual(stored)
  })

  it('drops an id this build does not know', () => {
    expect(ids(resolveLayout([{ id: 'sleep', hidden: false }, ...DEFAULT]))).toEqual(STATS_CARD_IDS)
  })

  it('keeps the first of 2 rows with the same id', () => {
    const stored = [{ id: 'steps', hidden: true }, ...DEFAULT]
    const layout = resolveLayout(stored)
    expect(layout).toHaveLength(STATS_CARD_IDS.length)
    expect(layout[0]).toEqual({ id: 'steps', hidden: true })
  })

  it('adds a card that an older layout lacks at its default place, shown', () => {
    const older = DEFAULT.filter((item) => item.id !== 'records').map((item) =>
      item.id === 'weight' ? { ...item, hidden: true } : item,
    )
    const layout = resolveLayout(older)
    expect(ids(layout)).toEqual(STATS_CARD_IDS)
    expect(layout.find((item) => item.id === 'records')).toEqual({ id: 'records', hidden: false })
    expect(layout[0]).toEqual({ id: 'weight', hidden: true })
  })

  it('puts a missing card right after the card before it in the default order', () => {
    const stored = [
      { id: 'steps', hidden: false },
      { id: 'weight', hidden: false },
    ]
    const order = ids(resolveLayout(stored))
    expect(order.indexOf('calories')).toBe(order.indexOf('weight') + 1)
    expect(order.indexOf('walk')).toBe(order.indexOf('steps') + 1)
    expect(order).toHaveLength(STATS_CARD_IDS.length)
  })

  it('puts a missing first card first', () => {
    const stored = DEFAULT.filter((item) => item.id !== 'weight')
    expect(resolveLayout(stored)[0]).toEqual({ id: 'weight', hidden: false })
  })
})

describe('moveCard', () => {
  it('swaps a card with the card above it', () => {
    expect(ids(moveCard(DEFAULT, 'steps', -1)).slice(0, 3)).toEqual(['weight', 'steps', 'calories'])
  })

  it('swaps a card with the card below it', () => {
    expect(ids(moveCard(DEFAULT, 'weight', 1)).slice(0, 2)).toEqual(['calories', 'weight'])
  })

  it('leaves the order alone when the first card moves up', () => {
    expect(moveCard(DEFAULT, 'weight', -1)).toEqual(DEFAULT)
  })

  it('leaves the order alone when the last card moves down', () => {
    expect(moveCard(DEFAULT, 'calories-per-minute', 1)).toEqual(DEFAULT)
  })

  it('leaves the order alone for an id that is not in the layout', () => {
    const short = DEFAULT.slice(0, 2)
    expect(moveCard(short, 'records', -1)).toEqual(short)
  })

  it('never changes the layout it was given', () => {
    const before = structuredClone(DEFAULT)
    moveCard(DEFAULT, 'steps', -1)
    expect(DEFAULT).toEqual(before)
  })
})

describe('setHidden', () => {
  it('hides only the named card', () => {
    const layout = setHidden(DEFAULT, 'steps', true)
    expect(layout.filter((item) => item.hidden)).toEqual([{ id: 'steps', hidden: true }])
  })
})
```

`components/charts/StatsLayoutEditor.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { resolveLayout, STATS_CARD_IDS } from './statsCards'
import { StatsLayoutEditor } from './StatsLayoutEditor'

function Harness() {
  const [layout, setLayout] = useState(resolveLayout(null))
  return <StatsLayoutEditor layout={layout} onChange={setLayout} />
}

function order(): (string | undefined)[] {
  return within(screen.getByRole('list', { name: 'Stats cards' }))
    .getAllByRole('listitem')
    .map((row) => row.dataset.cardId)
}

async function tabTo(user: ReturnType<typeof userEvent.setup>, name: string): Promise<void> {
  for (let step = 0; step < 80; step += 1) {
    await user.tab()
    if (document.activeElement?.getAttribute('aria-label') === name) {
      return
    }
  }
  throw new Error(`No control named ${name} took the focus`)
}

describe('StatsLayoutEditor', () => {
  it('gives every card a move up, a move down and a show switch', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Move Weight up' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move Weight down' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Show Weight' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getAllByRole('switch')).toHaveLength(STATS_CARD_IDS.length)
  })

  it('disables up on the first row and down on the last', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Move Weight up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Calories a gym minute down' })).toBeDisabled()
  })

  it('moves a card up twice with the keyboard alone and keeps the focus on it', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await tabTo(user, 'Move Steps up')
    await user.keyboard('{Enter}')
    expect(order().slice(0, 3)).toEqual(['weight', 'steps', 'calories'])
    expect(screen.getByRole('button', { name: 'Move Steps up' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(order().slice(0, 3)).toEqual(['steps', 'weight', 'calories'])
    expect(screen.getByRole('button', { name: 'Move Steps down' })).toHaveFocus()
  })

  it('hides a card with Space on its switch and says so in text', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await tabTo(user, 'Show Weight')
    await user.keyboard(' ')
    expect(screen.getByRole('switch', { name: 'Show Weight' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    expect(screen.getByRole('switch', { name: 'Show Weight' }).closest('li')).toHaveTextContent(
      'Hidden',
    )
  })
})
```

`components/charts/StatsGrid.test.tsx`: renders only the shown cards, in layout order
(read the `h2` headings); renders `ALL_HIDDEN` when every card is hidden; the grid has
`grid-cols-1` and `md:grid-cols-2` and no `lg:grid-cols-3`; with `lifts: null` and
`week: null` it renders the 8 daily cards only. Build `data` with `analyse` as
`Analytics.test.tsx` does.

`components/charts/StatsCard.test.tsx`: each of the 14 ids renders a card with a level 2
heading when its group input is set; a lift id and a week id return nothing when their
input is `null`; `totals`, `records` and `calories-per-minute` carry `md:col-span-2`.

`components/charts/Analytics.test.tsx`. Add `updateProfile: vi.fn(() => Promise.resolve())`
to the repository mock. Pass `save` where a test needs to control it. Add:

```tsx
function headings(): string[] {
  return within(screen.getByTestId('stats-grid'))
    .getAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent ?? '')
}

describe('Analytics layout', () => {
  it('renders the cards in the stored order', async () => {
    vi.mocked(getProfile).mockResolvedValueOnce({
      ...PROFILE,
      stats_layout: [
        { id: 'steps', hidden: false },
        { id: 'weight', hidden: false },
      ],
    })
    render(<Analytics clock={clock} />)
    await screen.findByTestId('stats-grid')
    expect(headings().slice(0, 3)).toEqual(['Steps', 'Weight', 'Calories burnt'])
  })

  it('leaves a hidden card out of the grid', async () => {
    vi.mocked(getProfile).mockResolvedValueOnce({
      ...PROFILE,
      stats_layout: [{ id: 'weight', hidden: true }],
    })
    render(<Analytics clock={clock} />)
    await screen.findByTestId('stats-grid')
    expect(headings()).not.toContain('Weight')
  })

  it('saves the new order on Done and leaves edit mode', async () => {
    const user = userEvent.setup()
    const save = vi.fn(() => Promise.resolve())
    render(<Analytics clock={clock} save={save} />)
    await screen.findByTestId('stats-grid')
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Move Calories burnt up' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(save).toHaveBeenCalledWith({
      stats_layout: moveCard(resolveLayout(null), 'calories', -1),
    })
    expect(await screen.findByTestId('stats-grid')).toBeVisible()
    expect(headings().slice(0, 2)).toEqual(['Calories burnt', 'Weight'])
  })

  it('saves the default layout after Reset and Done', async () => {
    const user = userEvent.setup()
    const save = vi.fn(() => Promise.resolve())
    vi.mocked(getProfile).mockResolvedValueOnce({
      ...PROFILE,
      stats_layout: [{ id: 'steps', hidden: true }],
    })
    render(<Analytics clock={clock} save={save} />)
    await screen.findByTestId('stats-grid')
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(save).toHaveBeenCalledWith({ stats_layout: resolveLayout(null) })
  })

  it('stays in edit mode and says so when the save is refused', async () => {
    const user = userEvent.setup()
    const save = vi.fn(() => Promise.reject(new Error('locked')))
    render(<Analytics clock={clock} save={save} />)
    await screen.findByTestId('stats-grid')
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The layout could not be saved on this device.',
    )
    expect(screen.getByRole('list', { name: 'Stats cards' })).toBeInTheDocument()
  })
})
```

Import `getProfile` from the mocked repository and `PROFILE` from
`tests/fixtures/dashboard`, as the file already does for `listRange`. The existing tests
that read `analytics-grid` or `lift-grid` on `Analytics` now read `stats-grid` or the
card headings. The `AnalyticsView` tests do not change.

`tests/e2e/stats-layout.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('reorders and hides a card with the keyboard alone, on the style guide sample', async ({
  page,
}) => {
  await page.goto('/styleguide')

  const sample = page.getByTestId('stats-layout-sample')
  const up = sample.getByRole('button', { name: 'Move Steps up' })

  await up.focus()
  await page.keyboard.press('Enter')
  await expect(up).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(sample.getByRole('button', { name: 'Move Steps down' })).toBeFocused()
  await expect(sample.getByRole('listitem').first()).toHaveAttribute('data-card-id', 'steps')

  const show = sample.getByRole('switch', { name: 'Show Weight' })
  await show.focus()
  await page.keyboard.press('Space')
  await expect(show).toHaveAttribute('aria-checked', 'false')
})
```

It runs on all 3 Playwright projects. `responsive.spec.ts` already proves every control
is 44 px or taller on `/styleguide`.

## Verification

1. `pnpm test:cov`. `components/**` stays at 85 lines, 75 branches and 85 functions.
2. `pnpm design:check`.
3. `pnpm verify:parallel`. The styleguide analytics e2e tests pass with no change to them.
4. In the browser, at 390, 768 and 1440 px, signed in: Edit, move Steps to the top, hide
   Weight, Done. Reload. The order and the hidden card stay. Edit, Reset, Done. The
   default returns. Do it once with the keyboard alone.
5. On the laptop, after a sync, the same order shows. The owner checks this on the
   iPhone and the laptop at the checkpoint.

## Things to consider

- This step ends sub-plan I, the last sub-plan of the track. Say so in the report, so
  the owner runs the I checkpoint in `docs/plan/04-feedback-fixes.md`. When every line
  of the fix track checklist passes, the track closes and Phase 3 resumes at step 3.1.
  Do not run the checkpoint yourself.

## Files touched

- `components/charts/statsCards.ts` and its test
- `components/charts/StatsCard.tsx`, `StatsGrid.tsx`, `StatsLayoutEditor.tsx` and their tests
- `components/charts/Analytics.tsx`, `LiftCharts.tsx`, `WeekCharts.tsx`, `useAnalytics.ts` and their tests
- `app/(app)/analytics/page.test.tsx`
- `app/styleguide/page.tsx` and its test
- `tests/e2e/stats-layout.spec.ts`, `tests/e2e/journey.spec.ts`,
  `tests/e2e/support/signedIn.ts`, `tests/e2e/support/workout.ts`
- `docs/design/prototype/index.html`

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer when
   another step runs its e2e suite. Never skip a check, and never add a design-check or
   test exemption to pass.
2. Stage the files of step 3 with the same `git add` line first. The skill describes the
   staged diff, and it refuses to run when nothing is staged. Then run the `commit-report`
   skill.
   The report needs screenshots of every changed page at 390, 768 and 1440 px, next
   to the matching prototype plate. Show `/analytics` in view mode and in edit mode, next
   to plates `p5` and `p-stats-edit`.
3. Commit on `fix/i1-stats-layout`:

   ```bash
   git add components/charts/statsCards.ts \
     components/charts/statsCards.test.ts \
     components/charts/StatsCard.tsx \
     components/charts/StatsCard.test.tsx \
     components/charts/StatsGrid.tsx \
     components/charts/StatsGrid.test.tsx \
     components/charts/StatsLayoutEditor.tsx \
     components/charts/StatsLayoutEditor.test.tsx \
     components/charts/Analytics.tsx \
     components/charts/Analytics.test.tsx \
     components/charts/LiftCharts.tsx \
     components/charts/LiftCharts.test.tsx \
     components/charts/WeekCharts.tsx \
     components/charts/WeekCharts.test.tsx \
     components/charts/useAnalytics.ts \
     components/charts/useAnalytics.test.tsx \
     'app/(app)/analytics/page.test.tsx' \
     app/styleguide/page.tsx \
     app/styleguide/page.test.tsx \
     tests/e2e/stats-layout.spec.ts \
     tests/e2e/journey.spec.ts \
     tests/e2e/support/signedIn.ts \
     tests/e2e/support/workout.ts \
     docs/design/prototype/index.html
   git commit -m "feat(charts): reorder and hide the stats cards"
   ```

   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.

4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked,
   and anything the owner must check on the iPhone.
