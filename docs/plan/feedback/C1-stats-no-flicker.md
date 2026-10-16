# Step C1 — Keep the Stats data during a tab switch

**Branch:** `fix/c1-stats-no-flicker`, in worktree `../gym-tracker-c1`, cut from `fix/feedback-fixes` ·
**Wave:** 1 · **Size:** M · **Depends on:** W0 · **Unlocks:** C3, G2 ·
**Agent to use:** `ui-reviewer`
**Items:** 7 · **Skills to load:** `design-system`

## Before you start

### The worktree

```bash
cd /Users/cefalo_1/Documents/Projects/gym-tracker
git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-c1 -b fix/c1-stats-no-flicker fix/feedback-fixes
cd ../gym-tracker-c1
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
echo "Dependency checks finished."
```

If any check fails, the step it names is not merged into `fix/feedback-fixes`. Stop. Report which check
failed. Do not do that step's work here.

### Already done check

```bash
grep -q "export const LineDrawContext" components/charts/useLineDraw.ts && echo "DONE: C1 is already on this branch"
```

If it passes, stop and report.

## Context to read first

1. `docs/specs/2026-10-05-feedback-fixes-design.md`, item 7 in section 1.
2. `components/charts/useAnalytics.ts` — the hook that reads the entries.
3. `components/charts/Analytics.tsx` — the screen that renders the 13 cards.
4. `components/charts/ChartCard.tsx` — `ChartCanvas` puts `DRAW_CLASS` on a new canvas.
5. `components/charts/useLineDraw.ts` — the first-draw timer.
6. `components/charts/useLiftData.ts` — `HISTORY_END`.
7. `components/charts/useAnalytics.test.tsx` and `components/charts/Analytics.test.tsx`.

## Names this step uses from earlier steps

- W0: `pnpm verify:parallel` and `scripts/e2e-lock.mjs`. Nothing else. Every file this
  step reads exists before this step.
- The Stats screen lives at the route `/analytics`. Its tab label is "Stats"
  (`lib/nav.ts`).
- This step runs in the same wave as A1, B1, C2 and E1. It shares no source file with
  them.

## State before the step

- `useAnalytics(tab)` runs its effect on every tab change. It reads 3 things again:
  the window of the tab, the whole history up to today, and the profile.
- While that read is open, the hook returns `{ status: 'loading' }`, because
  `settled.tab !== tab`.
- `Analytics` then removes `AnalyticsView`, `LiftCharts` and `WeekCharts`, and shows
  "Reading this device…". The header label goes blank.
- When the read settles, all 13 cards mount again. Each new `ChartCanvas` starts with
  `useLineDraw() === true`, so every line draws again.
- `useLineDraw` itself already draws only once per mount. The replay comes from the
  remount, not from a data change.

## Goal

A Day, Week or Month switch keeps every card in the DOM. The new numbers show at once.
No card replays its line draw after the first tab switch.

## The design decision

The history read already holds every row the 3 tabs need. The hook reads the history
and the profile **once**, then cuts the window of each tab from it in memory. A tab
switch is then a pure computation, with no read and no loading state. So the hook
needs no `pending` flag: there is never a gap to bridge.

A chart can still mount later, for example when it goes from its sparse state on the
Day tab back to a drawn chart on the Week tab. A small context, `LineDrawContext`,
tells `useLineDraw` that the first tab switch has happened, so a canvas that mounts
after it shows its final state at once.

## Do

1. Write the failing tests in **Tests** below first.
2. `components/charts/useAnalytics.ts`. Replace the file body with this shape:

   ```ts
   'use client'

   import { useEffect, useMemo, useState } from 'react'

   import { getProfile, listRange } from '../../lib/db/repository'
   import { localDate } from '../../lib/schema/dailyEntry'
   import { HISTORY_START } from '../dashboard/summary'

   import { analyse, rangeFor, readWindow } from './rangeData'
   import { HISTORY_END } from './useLiftData'

   import type { AnalyticsData, RangeTab } from './rangeData'
   import type { DailyEntry, Profile } from '../../lib/db/dexie'

   export type AnalyticsState =
     | { status: 'loading' }
     | { status: 'error'; message: string }
     | { status: 'ready'; data: AnalyticsData }

   type Source = { history: DailyEntry[]; profile: Profile; today: string; now: Date }

   type Loaded =
     | { status: 'loading' }
     | { status: 'error'; message: string }
     | { status: 'ready'; source: Source }

   export const READ_ERROR = 'The entries on this device could not be read.'

   function systemClock(): Date {
     return new Date()
   }

   export function entriesIn(
     history: readonly DailyEntry[],
     tab: RangeTab,
     today: string,
   ): DailyEntry[] {
     const span = readWindow(rangeFor(tab, today))

     return history.filter((row) => row.entry_date >= span.from && row.entry_date <= span.to)
   }

   export function useAnalytics(tab: RangeTab, clock: () => Date = systemClock): AnalyticsState {
     const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' })

     useEffect(() => {
       let cancelled = false
       const now = clock()
       const today = localDate(now)

       void Promise.all([listRange(HISTORY_START, HISTORY_END), getProfile()]).then(
         ([history, profile]) => {
           if (!cancelled) {
             setLoaded({ status: 'ready', source: { history, profile, today, now } })
           }
         },
         () => {
           if (!cancelled) {
             setLoaded({ status: 'error', message: READ_ERROR })
           }
         },
       )

       return () => {
         cancelled = true
       }
     }, [clock])

     return useMemo((): AnalyticsState => {
       if (loaded.status !== 'ready') {
         return loaded
       }

       const { history, profile, today, now } = loaded.source

       return {
         status: 'ready',
         data: analyse(
           entriesIn(history, tab, today),
           history,
           tab,
           today,
           now,
           profile.step_goal,
           profile.unit_system,
         ),
       }
     }, [loaded, tab])
   }
   ```

   `analyse` already drops the rows after today from the streak and the heat map, so
   passing the whole history as its second argument keeps today's numbers.

3. `components/charts/useLineDraw.ts`. Add the context and read it:

   ```ts
   'use client'

   import { createContext, useContext, useLayoutEffect, useState } from 'react'

   import { prefersReducedMotion } from '../motion/reducedMotion'

   export const LINE_DRAW_MS = 400

   export const LABEL_FADE_MS = 160

   export const DRAW_CLASS = 'chart-draw'

   export const LineDrawContext = createContext(true)

   export function useLineDraw(): boolean {
     const allowed = useContext(LineDrawContext)
     const [drawing, setDrawing] = useState(allowed)

     useLayoutEffect(() => {
       if (!allowed || prefersReducedMotion()) {
         setDrawing(false)
         return
       }
       const timer = setTimeout(() => {
         setDrawing(false)
       }, LINE_DRAW_MS + LABEL_FADE_MS)
       return () => {
         clearTimeout(timer)
       }
     }, [allowed])

     return drawing
   }
   ```

   With no provider the default is `true`, so the style guide and every other screen
   keep today's first draw.

4. `components/charts/Analytics.tsx`, the `Analytics` function only:
   - Add `const [switched, setSwitched] = useState(false)`.
   - Pass `onValueChange={changeTab}` to `RangeTabs`, where
     `function changeTab(next: RangeTab) { setSwitched(true); setTab(next) }`.
   - Wrap everything after `RangeTabs` in
     `<LineDrawContext value={!switched}>…</LineDrawContext>`.
   - Keep the loading line, the error line and the lift lines as they are. The loading
     line now shows only before the first read settles.
   - `AnalyticsView`, `LiftCharts` and `WeekCharts` stay gated on
     `state.status === 'ready'` and `lifts.status === 'ready'`. Neither state depends on
     the tab any more, so a tab switch never unmounts them.
5. Do not touch `ChartCard.tsx`. It already calls `useLineDraw()`.
6. Load the `design-system` skill. Open `/analytics` (the Stats tab) at 390 px, 768 px and 1440 px. Switch
   Day → Week → Month → Day. The cards stay. No line redraws. No "Reading this device…"
   flash.

## Acceptance criteria

- [ ] `useAnalytics` calls `listRange` once, with `HISTORY_START` and `HISTORY_END`.
- [ ] A tab switch does not call `listRange` or `getProfile` again.
- [ ] A tab switch returns `ready` on the same render, with the new tab's data.
- [ ] `entriesIn` keeps exactly the rows inside the tab's read window.
- [ ] A failed read still returns the error state.
- [ ] A read that settles after unmount still changes nothing.
- [ ] `Analytics` keeps the same `analytics-grid` element and all 13 headings through a
      tab switch.
- [ ] The header label changes to the new range on the same click.
- [ ] A chart that mounts after a tab switch carries no `DRAW_CLASS`.
- [ ] `useLineDraw` returns `false` from the first render when the context is `false`.
- [ ] With no `LineDrawContext` provider, `useLineDraw` still returns `true` on the
      first render, so `/styleguide` keeps its first draw. Test: the existing first
      draw tests in `components/charts/useLineDraw.test.tsx` stay green with no change.
- [ ] The Stats screen at 390, 768 and 1440 px keeps every card through Day → Week →
      Month → Day, with no "Reading this device…" flash and no redraw. Manual check:
      **Verification** 3, with screenshots in the report.
- [ ] The `ui-reviewer` agent reports no drift on `components/charts/Analytics.tsx`.

## Tests

`components/charts/useAnalytics.test.tsx`. Add `vi.mocked(getProfile).mockClear()` to
`beforeEach`. Delete the test `goes back to loading while a new range is read`. Replace
the test `reads the week, with six days before it, and the whole history` and the
test `uses the system clock when none is given`. Add the rest.

```tsx
import { entriesIn, READ_ERROR, useAnalytics } from './useAnalytics'

describe('useAnalytics', () => {
  it('reads the whole history once, with no range read', async () => {
    renderHook(() => useAnalytics('week', clock))
    await waitFor(() => {
      expect(listRange).toHaveBeenCalledTimes(1)
    })
    expect(listRange).toHaveBeenCalledWith('0000-01-01', '9999-12-31')
  })

  it('keeps the data ready through a tab switch, with no second read', async () => {
    vi.mocked(listRange).mockResolvedValue([entryOn('2026-09-21'), entryOn(TODAY)])
    const { result, rerender } = renderHook(({ tab }) => useAnalytics(tab, clock), {
      initialProps: { tab: 'week' as 'week' | 'month' },
    })
    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    rerender({ tab: 'month' })
    expect(result.current.status === 'ready' && result.current.data.tab).toBe('month')
    expect(listRange).toHaveBeenCalledTimes(1)
    expect(getProfile).toHaveBeenCalledTimes(1)
  })

  it('uses the system clock when none is given', async () => {
    renderHook(() => useAnalytics('day'))
    await waitFor(() => {
      expect(listRange).toHaveBeenCalledTimes(1)
    })
  })
})

describe('entriesIn', () => {
  it('keeps the rows from six days before the week to its Sunday', () => {
    const history = ['2026-09-14', '2026-09-15', TODAY, '2026-09-27', '2026-09-28'].map((date) =>
      entryOn(date),
    )
    expect(entriesIn(history, 'week', TODAY).map((row) => row.entry_date)).toEqual([
      '2026-09-15',
      TODAY,
      '2026-09-27',
    ])
  })

  it('returns no row for an empty history', () => {
    expect(entriesIn([], 'month', TODAY)).toEqual([])
  })
})
```

Import `TODAY` from `../../tests/fixtures/dashboard` beside `entryOn`.

`components/charts/Analytics.test.tsx`. Replace `rangeReads` and the 2 tests that use
it. Add the imports `act` and `fireEvent` from `@testing-library/react`,
`afterEach` from `vitest`, `setReducedMotion` from `../../tests/fixtures/motion` and
`DRAW_CLASS` from `./useLineDraw`.

```tsx
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const WEEK_ENTRIES = ['2026-09-21', '2026-09-22', TODAY].map((date) => entryOn(date))

describe('Analytics', () => {
  it('opens on the week tab and reads the history once', async () => {
    render(<Analytics clock={clock} />)
    expect(await screen.findByText('21 – 27 September')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
    expect(vi.mocked(listRange).mock.calls).toEqual([['0000-01-01', '9999-12-31']])
  })

  it('changes the range label on the click, with no new read', async () => {
    const user = userEvent.setup()
    render(<Analytics clock={clock} />)
    await screen.findByText('21 – 27 September')

    await user.click(screen.getByRole('button', { name: 'Month' }))
    expect(screen.getByText('1 – 30 September')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Day' }))
    expect(screen.getByText('23 September', { selector: 'p' })).toBeVisible()

    expect(listRange).toHaveBeenCalledTimes(1)
  })

  it('keeps every card in the document during a tab switch', async () => {
    vi.mocked(listRange).mockResolvedValue(WEEK_ENTRIES)
    render(<Analytics clock={clock} />)
    await screen.findByTestId('lift-grid')
    const grid = screen.getByTestId('analytics-grid')

    fireEvent.click(screen.getByRole('button', { name: 'Month' }))

    expect(screen.getByTestId('analytics-grid')).toBe(grid)
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(13)
    expect(screen.queryByText('Reading this device…')).not.toBeInTheDocument()
  })

  it('does not replay the line draw on a chart that comes back after a tab switch', async () => {
    vi.useFakeTimers()
    setReducedMotion(false)
    vi.mocked(listRange).mockResolvedValue(WEEK_ENTRIES)
    render(<Analytics clock={clock} />)
    await act(async () => {
      await vi.runAllTimersAsync()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Day' }))
    fireEvent.click(screen.getByRole('button', { name: 'Week' }))

    expect(document.querySelectorAll(`.${DRAW_CLASS}`)).toHaveLength(0)
  })
})
```

Run the last test before the change and see it fail. A chart that is sparse on the
Day tab, such as the weight chart with 1 day, mounts its canvas again on the Week tab
with `DRAW_CLASS`. If it passes before the change, pick entries that make a chart
sparse on Day and drawn on Week, so the test proves the fix.

`components/charts/useLineDraw.test.tsx`. Import `LineDrawContext` and add:

```tsx
it('does not draw at all when the screen has already switched a tab', () => {
  setReducedMotion(false)
  const { result } = renderHook(() => useLineDraw(), {
    wrapper: ({ children }) => <LineDrawContext value={false}>{children}</LineDrawContext>,
  })
  expect(result.current).toBe(false)
})
```

## Verification

1. `pnpm test components/charts`.
2. The `ui-reviewer` agent reports no drift on `components/charts/Analytics.tsx`.
3. `/analytics` at 390 px, 768 px and 1440 px: switch every tab twice. No blank frame, no
   height jump from a removed card, no redraw.
4. `pnpm verify:parallel`.

## Files touched

- `components/charts/useAnalytics.ts` and its test
- `components/charts/useLineDraw.ts` and its test
- `components/charts/Analytics.tsx` and its test

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer
   when another step runs its e2e suite. Never skip a check, and never add a
   design-check or test exemption to pass.
2. Run the `commit-report` skill. The report needs screenshots of every changed page at 390, 768 and 1440 px, next to the matching prototype plate: `/analytics` next to the Stats plate.
3. Commit on `fix/c1-stats-no-flicker`:
   ```bash
   git add components/charts/useAnalytics.ts \
     components/charts/useAnalytics.test.tsx \
     components/charts/useLineDraw.ts \
     components/charts/useLineDraw.test.tsx \
     components/charts/Analytics.tsx \
     components/charts/Analytics.test.tsx
   git commit -m "fix(charts): keep the stats cards on screen during a tab switch"
   ```
   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.
4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked,
   and anything the owner must check on the iPhone. On the iPhone the owner checks that a Day, Week or Month switch on Stats keeps every card and replays no line.
