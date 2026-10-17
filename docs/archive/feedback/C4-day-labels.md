# Step C4 — Heat map and week labels

**Branch:** `fix/c4-day-labels`, in worktree `../gym-tracker-c4`, cut from `fix/feedback-fixes` ·
**Wave:** 3 · **Size:** M · **Depends on:** W0, C3 · **Unlocks:** E4, G2 ·
**Agent to use:** `ui-reviewer`
**Items:** 12, 17 · **Skills to load:** `design-system`

## Before you start

### The worktree

```bash
cd /Users/cefalo_1/Documents/Projects/gym-tracker
git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-c4 -b fix/c4-day-labels fix/feedback-fixes
cd ../gym-tracker-c4
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
{ test -f lib/metrics/sessionDays.ts && grep -q "sessionDates" components/charts/rangeData.ts && grep -q "export function gapFooter" components/charts/SessionGapChart.tsx; } || echo "FAIL: C3 is not merged (no sessionDays, sessionDates or gapFooter)"
echo "Dependency checks finished."
```

If any check fails, the step it names is not merged into `fix/feedback-fixes`. Stop. Report which check
failed. Do not do that step's work here.

### Already done check

```bash
grep -q "export const WEEKDAY_LABELS" components/charts/StreakHeatMap.tsx && echo "DONE: C4 is already on this branch"
```

If it passes, stop and report.

## Context to read first

1. `docs/specs/2026-10-05-feedback-fixes-design.md`, items 12 and 17. The week stays
   Monday first. It is not a setting.
2. `.claude/skills/design-system/` and `.claude/rules/accessibility.md`.
3. `components/charts/StreakHeatMap.tsx` and its test.
4. `components/charts/rangeData.ts` — `dayTick`, `heatMapFor`, `HeatCell`.
5. `components/dashboard/WeekTotalsCard.tsx`, `components/dashboard/Dashboard.tsx` and
   `components/dashboard/summary.ts` — `weekRange` is already in the summary.
6. `docs/design/prototype/index.html` — the 2 "Streak" plates (search
   `Monday at the top`), the "This week" card (search `<h3 class="micro">This week`)
   and the Week tab ticks of the Stats plates (search `class="axis"`).

## Names this step uses from earlier steps

From C3:

- `components/charts/rangeData.ts`: `AnalyticsData` has `sessionDates: string[]`, and
  `analyse(…, sessions: readonly WorkoutSession[] = [])` takes the sessions last.
- `components/dashboard/summary.ts`: `summarise(entries, profile, today, now, sessions)`
  calls `weekTotals(past, weekRange, sessions)`. `summary.weekRange` is a `WeekRange`,
  `{ from: string; to: string }`, Monday to Sunday.
- The Streak heat map keeps the meaning C3 left it with. This step only labels it.

Before this step: `HEAT_MAP_WEEKS`, `HeatWeek`, `HeatCell` and `dayTick` in
`components/charts/rangeData.ts`. The Stats screen lives at the route `/analytics`.

## State before the step

- The heat map is a Recharts stacked bar chart, 140 px tall at every width. Its cells
  stretch: wide and flat on a laptop, tall and thin on a phone.
- It has no weekday labels. Only the footer says "Monday at the top".
- A future day uses `colorTokens.surface`, the same color as the card, so the rest of
  this week is invisible.
- Every Week tab tick is 1 letter: `M T W T F S S`. Two `T` and two `S` look the same.
- "This week" on Today shows no dates, so the owner cannot see that it starts on
  Monday.

## Goal

The heat map reads like a calendar: a weekday label on each row, square cells, and a
visible outline for the days still ahead. Week ticks read `Mon Tue Wed`. "This week"
names its dates, for example `29 Sep – 5 Oct`.

## Do

1. Write the failing tests in **Tests** first.
2. `components/charts/rangeData.ts`, `dayTick`. The week tab returns the full short
   weekday:

   ```ts
   if (tab === 'week') {
     return WEEKDAY_SHORT.format(day)
   }
   ```

   `WEEKDAY_SHORT` is `en-GB` with `weekday: 'short'`. It gives `Mon` to `Sun`. The
   charts that call `dayTick` change with it: `DailyBars`, `WeightChart`,
   `HeartRateChart`. At 390 px a week bar is about 45 px wide, so 3 letters at the
   axis size fit.

3. `components/charts/StreakHeatMap.tsx`. Replace the Recharts chart with a CSS grid of
   real cells. Drop the `recharts` and `colorTokens` imports and `cellFill`.

   ```tsx
   'use client'

   import { Fragment } from 'react'

   import { cn } from '../ui/cn'

   import { ChartCard } from './ChartCard'
   import { HEAT_MAP_WEEKS } from './rangeData'

   import type { HeatCell, HeatWeek } from './rangeData'
   import type { Streak } from '../../lib/metrics/streak'

   export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

   const CELL_CLASS: Record<HeatCell['state'], string> = {
     logged: 'bg-accent',
     missed: 'bg-dim',
     future: 'border border-dashed border-dim',
   }

   export function cellClass(state: HeatCell['state']): string {
     return CELL_CLASS[state]
   }

   const GRID_COLUMNS = {
     gridTemplateColumns: `auto repeat(${String(HEAT_MAP_WEEKS)}, minmax(0, 1fr))`,
   }

   function HeatGrid({ weeks }: { weeks: readonly HeatWeek[] }) {
     return (
       <div className="grid w-full max-w-[440px] items-center gap-[3px]" style={GRID_COLUMNS}>
         {WEEKDAY_LABELS.map((label, weekday) => (
           <Fragment key={label}>
             <span data-weekday-label className="text-muted pr-1.5 text-[11px] leading-none">
               {label}
             </span>
             {weeks.map((week) => {
               const state = week.days[weekday]?.state ?? 'future'

               return (
                 <span
                   key={week.start}
                   data-state={state}
                   className={cn('aspect-square rounded-sm', cellClass(state))}
                 />
               )
             })}
           </Fragment>
         ))}
       </div>
     )
   }
   ```

   In `StreakHeatMap`:
   - Render `<HeatGrid weeks={weeks} />` as the child of `ChartCard`.
   - Legend: `Logged` with `bg-accent`, `Not logged` with `bg-dim`, `Ahead` with
     `border border-dim`.
   - Footer: `Each column is a week. Weeks start on Monday.`
   - Keep `days`, `heatMapLabel`, the summary and the empty state as they are.

   The cells sit inside the `role="img"` canvas, so the label stays the text
   alternative. A future cell differs from a missed cell by its shape, an outline, and
   not by color alone. E4 later adds a row of day links under the grid, outside the
   `role="img"` canvas.

4. `components/dashboard/summary.ts`. Add a short range label. Do not use
   `Intl` with `month: 'short'`: `en-GB` writes `Sept` in current ICU.

   ```ts
   const SHORT_MONTHS = [
     'Jan',
     'Feb',
     'Mar',
     'Apr',
     'May',
     'Jun',
     'Jul',
     'Aug',
     'Sep',
     'Oct',
     'Nov',
     'Dec',
   ]

   function dayMonthShort(date: string): { day: string; month: string } {
     return {
       day: String(Number(date.slice(8, 10))),
       month: SHORT_MONTHS[Number(date.slice(5, 7)) - 1] ?? '',
     }
   }

   export function weekRangeLabel(range: WeekRange): string {
     const from = dayMonthShort(range.from)
     const to = dayMonthShort(range.to)

     if (from.month === to.month) {
       return `${from.day} – ${to.day} ${to.month}`
     }

     return `${from.day} ${from.month} – ${to.day} ${to.month}`
   }
   ```

5. `components/dashboard/WeekTotalsCard.tsx`:
   - Add the prop `range: WeekRange`.
   - The header becomes a row: `<h2><MicroLabel>This week</MicroLabel></h2>` on the
     left and `<p className="text-muted text-[13px]">{weekRangeLabel(range)}</p>` on
     the right, in `flex items-center justify-between gap-3`.
6. `components/dashboard/Dashboard.tsx`. Pass `range={summary.weekRange}`.
7. `app/styleguide/page.tsx`. Pass `range={{ from: '2026-09-07', to: '2026-09-13' }}` to
   the sample `WeekTotalsCard`, the week that `SAMPLE_SUMMARY.weekRange` already uses.
8. `docs/design/prototype/index.html`. Keep the visual contract in step:
   - Both "Streak" plates: weekday labels on the left, square cells, the dashed outline
     for future days, the new legend and footer.
   - The "This week" card: the date range on the right of the label.
   - Every Week tab tick in the Stats plates: `Mon Tue Wed Thu Fri Sat Sun`.
9. Load the `design-system` skill. Check `/`, `/analytics` and `/styleguide` at 390 px,
   768 px and 1440 px. No sideways scroll at 320 px. The 7 labels stay readable.

## Acceptance criteria

- [ ] `dayTick` on the week tab writes `Mon` for a Monday and `Sun` for a Sunday.
- [ ] `DailyBars` and `WeightChart` on the week tab show `Mon` to `Sun` as ticks.
- [ ] The heat map shows the 7 labels `Mon` to `Sun`, in that order.
- [ ] The heat map draws 84 cells, each with `aspect-square`.
- [ ] A future cell carries a dashed `border-dim` outline and no fill.
- [ ] A logged cell carries `bg-accent` and a missed cell carries `bg-dim`.
- [ ] The heat map legend names `Logged`, `Not logged` and `Ahead`.
- [ ] `weekRangeLabel` writes `29 Sep – 5 Oct` across a month end.
- [ ] `weekRangeLabel` writes `21 – 27 Sep` inside one month.
- [ ] `WeekTotalsCard` shows its range beside `This week`.
- [ ] `Dashboard` passes the summary's week range to the card.
- [ ] No test expects the old 1 letter week ticks. Check:
      `grep -rn "'M', 'T'" components tests` returns nothing.
- [ ] `pnpm design:check` passes. The grid uses tokens only: no raw hex, no `rgb()`.
- [ ] No sideways scroll at 320 px on `/` and `/analytics`. Test:
      `tests/e2e/responsive.spec.ts` stays green.
- [ ] Manual: at 390 px the heat map cells are square, and at 1440 px the grid stops
      at 440 px wide (**Verification** 4).
- [ ] The prototype's 2 Streak plates, the "This week" card and every Week tab tick
      match the new screens. Manual: screenshots side by side in the report.
- [ ] The `ui-reviewer` agent reports no drift on `StreakHeatMap.tsx` and
      `WeekTotalsCard.tsx`.

## Tests

`components/charts/rangeData.test.tsx`, the `dayTick` block. Replace the first test:

```tsx
it('writes the short weekday on the week', () => {
  expect(dayTick('2026-09-21', 'week')).toBe('Mon')
  expect(dayTick('2026-09-27', 'week')).toBe('Sun')
})
```

`components/charts/DailyBars.test.tsx` and `components/charts/WeightChart.test.tsx`.
Change the expected week ticks to:

```tsx
expect(svgTexts(bars('week'), AXIS_TICKS)).toEqual([
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
])
```

Run `grep -rn "'M', 'T'" components tests` and update any other match the same way.

`components/charts/StreakHeatMap.test.tsx`. Delete the `cellFill` block and the
`recharts-bar-rectangle` test. Import `cellClass` and `WEEKDAY_LABELS`. Add:

```tsx
describe('StreakHeatMap grid', () => {
  it('labels the 7 rows Mon to Sun, Monday first', () => {
    const { container } = render(<StreakHeatMap weeks={full.heatMap} streak={full.streak} />)
    expect(
      Array.from(container.querySelectorAll('[data-weekday-label]'), (node) => node.textContent),
    ).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  })

  it('draws 84 square cells', () => {
    const { container } = render(<StreakHeatMap weeks={full.heatMap} streak={full.streak} />)
    const cells = container.querySelectorAll('[data-state]')
    expect(cells).toHaveLength(84)
    for (const cell of cells) {
      expect(cell).toHaveClass('aspect-square')
    }
  })

  it('outlines a future day so it stays visible', () => {
    const { container } = render(<StreakHeatMap weeks={full.heatMap} streak={full.streak} />)
    const future = container.querySelector('[data-state="future"]')
    expect(future).toHaveClass('border-dashed', 'border-dim')
    expect(future).not.toHaveClass('bg-dim')
  })

  it('names the 3 states in the legend', () => {
    render(<StreakHeatMap weeks={full.heatMap} streak={full.streak} />)
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Logged',
      'Not logged',
      'Ahead',
    ])
  })
})

describe('cellClass', () => {
  it('fills a logged day with the accent', () => {
    expect(cellClass('logged')).toBe('bg-accent')
  })

  it('fills a missed day with the dim token', () => {
    expect(cellClass('missed')).toBe('bg-dim')
  })
})

describe('WEEKDAY_LABELS', () => {
  it('runs from Monday to Sunday', () => {
    expect(WEEKDAY_LABELS).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  })
})
```

`TODAY` is `2026-09-23`, a Wednesday, so `full.heatMap` holds future days on
Thursday to Sunday of the last week.

`components/dashboard/summary.test.tsx`. Import `weekRangeLabel`:

```tsx
describe('weekRangeLabel', () => {
  it('names both months across a month end', () => {
    expect(weekRangeLabel({ from: '2026-09-29', to: '2026-10-05' })).toBe('29 Sep – 5 Oct')
  })

  it('names the month once inside one month', () => {
    expect(weekRangeLabel({ from: '2026-09-21', to: '2026-09-27' })).toBe('21 – 27 Sep')
  })
})
```

`components/dashboard/WeekTotalsCard.test.tsx`. Pass `range={RANGE}` to every render,
with `const RANGE = { from: '2026-09-29', to: '2026-10-05' }`, and add:

```tsx
it('shows the dates of the week beside the label', () => {
  render(<WeekTotalsCard totals={TOTALS} range={RANGE} />)
  expect(screen.getByText('29 Sep – 5 Oct')).toBeVisible()
})
```

`components/dashboard/Dashboard.test.tsx`. Add 1 test that renders the dashboard view
for `TODAY` and finds `21 – 27 Sep`.

## Verification

1. `pnpm test components`.
2. The `ui-reviewer` agent reports no drift on `StreakHeatMap.tsx` and
   `WeekTotalsCard.tsx`.
3. `pnpm design:check`. No raw hex, no `rgb()`. The grid uses tokens only.
4. `/analytics` at 390 px: the heat map cells are square, the labels sit on the left, and
   the rest of this week shows as outlines. At 1440 px the grid stops at 440 px wide.
5. `pnpm verify:parallel`. `tests/e2e/responsive.spec.ts` stays green.

## Files touched

- `components/charts/rangeData.ts` and its test
- `components/charts/DailyBars.test.tsx`, `components/charts/WeightChart.test.tsx`
- `components/charts/StreakHeatMap.tsx` and its test
- `components/dashboard/summary.ts` and its test
- `components/dashboard/WeekTotalsCard.tsx` and its test
- `components/dashboard/Dashboard.tsx` and its test
- `app/styleguide/page.tsx`
- `docs/design/prototype/index.html`

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer
   when another step runs its e2e suite. Never skip a check, and never add a
   design-check or test exemption to pass.
2. Run the `commit-report` skill. The report needs screenshots of every changed page at 390, 768 and 1440 px, next to the matching prototype plate: `/`, `/analytics` and the Streak card, next to the updated plates.
3. Commit on `fix/c4-day-labels`:
   ```bash
   git add components/charts/rangeData.ts \
     components/charts/rangeData.test.tsx \
     components/charts/DailyBars.test.tsx \
     components/charts/WeightChart.test.tsx \
     components/charts/StreakHeatMap.tsx \
     components/charts/StreakHeatMap.test.tsx \
     components/dashboard/summary.ts \
     components/dashboard/summary.test.tsx \
     components/dashboard/WeekTotalsCard.tsx \
     components/dashboard/WeekTotalsCard.test.tsx \
     components/dashboard/Dashboard.tsx \
     components/dashboard/Dashboard.test.tsx \
     app/styleguide/page.tsx \
     docs/design/prototype/index.html
   git commit -m "fix(charts): label the heat map and the week, and show future days"
   ```
   Also add any other test file that the `'M', 'T'` grep made you change.
   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.
4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked,
   and anything the owner must check on the iPhone. Say that this step ends sub-plan C, so the owner runs the C checkpoint in `docs/plan/04-feedback-fixes.md`. Name the C3 answer on the heat map. On the iPhone the owner checks the heat map labels, the outlined future days and the dates beside "This week".
