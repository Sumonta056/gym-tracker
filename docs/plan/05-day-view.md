# Step D1 — The Today screen reads any day

**Branch:** `feat/day-view` · **Worktree:** `../gym-tracker-day-view` · **Size:** M ·
**Depends on:** the fix track · **Skills to load:** `design-system`

## Context to read first

1. The mockup, approved by the owner on 2026-10-17:
   https://claude.ai/artifact/YJ9XcTbHcteaVAmfnyRT66
2. `components/dashboard/Dashboard.tsx`, `useDashboard.ts`, `summary.ts`,
   `DashboardHeader.tsx`, `TodayHero.tsx`, `TodayWorkoutCard.tsx`, `WeekTotalsCard.tsx`.
3. `components/DailyEntryForm.tsx` lines 380 to 560: the day control that `/log` already
   has. `lib/format/logDate.ts`: `parseLogDate`, `shiftLogDate`, `logPath`.
4. `components/workouts/HistoryLink.tsx`: in-place navigation with `pushState`.
5. `docs/design/prototype/index.html`, plate 01 Dashboard, from line 2527.

## State before the step

`/` reads only today. `useDashboard` takes the date from the clock. `/log?date=` edits any
day. `/workouts` lists sessions by day. No screen shows one past day in full.

## Goal

`/?date=2026-10-10` shows that day in full, on the Today screen, with the same cards.
The header carries a previous arrow, the date as a date picker, and a next arrow.

## Design decisions, made by the owner

- The Today screen is the day screen. No new route.
- The day control lives in the top bar: arrow, date, arrow. No "Back to today" pill.
- `/log` stays the only place that edits a day. A past day shows one "Edit this day"
  secondary button under the grid.
- The streak and the latest weight are computed as of the chosen day. `summarise`
  already does this when it receives that date.

## Do

1. `lib/format/logDate.ts`: add `dayPath(date, today)`. Today returns `/`. Any other day
   returns `/?date=<date>`.
2. `components/dashboard/useDashboard.ts`: take `date: string` as the first argument.
   `readDashboard` uses it in place of `localDate(now)`. The clock stays for `now`.
3. `components/dashboard/Dashboard.tsx`: read `?date=` with `useSearchParams`, parse it
   with `parseLogDate(asked, localDate())`, pass it to `useDashboard` and to the view.
   Wrap the reader in `Suspense`, as `app/(app)/log/page.tsx` does. A changed `?date=`
   in the URL re-renders the view. Add the "Edit this day" button for a past day; it
   links to `logPath(date)`.
4. `components/dashboard/DashboardHeader.tsx`: the day control. A previous button, the
   weekday and date block with an invisible `type="date"` input over it, a next button.
   `max` is today. Next is disabled on today. The micro label reads `Today · Friday` on
   today, else the weekday. Navigation calls `window.history.pushState(null, '',
dayPath(next, today))`, then the page reads the new `?date=`. Keep `SyncChip` and the
   profile link. Every button has `type="button"` and an `aria-label` with the date, as
   `DailyEntryForm.tsx:495` does. Tap targets 44 px.
5. `components/dashboard/TodayHero.tsx`: take `date` and `today`. Labels: "Gym time
   today" or "Gym time · 10 Oct". "Nothing logged yet today" or "Nothing logged on
   10 Oct". The empty-state link goes to `logPath(date)`, text "Log the day" on today,
   "Log this day" otherwise. "No gym time today" or "No gym time on 10 Oct".
6. `components/dashboard/TodayWorkoutCard.tsx`: take `date` and `today`. "Workout today"
   or "Workout · 10 Oct".
7. `components/dashboard/WeekTotalsCard.tsx`: already takes `today`. Pass the chosen
   date as the marked day. Keep the prop name or rename to `marked`; the "days left" text
   must still count from the real today, so pass both if needed.
8. `components/charts/StreakHeatMap.tsx:88`: link to `dayPath(cell.date, today)`.
9. `components/workouts/DayCard.tsx`: the date column becomes a `HistoryLink`-style
   anchor to `dayPath(date, today)`. Keep its look. Add an `aria-label` that names the day.
10. `components/DailyEntryForm.tsx`: a small "View this day" link in the header, to
    `dayPath(date, today)`. Hide it on today.
11. The prototype plate 01: add the day control to its `.topbar`. Reuse `.day-step`
    from the `/log` plate. Update `/styleguide` if it renders the header.
12. Short date text: reuse `headerDate` in `summary.ts` or `prettyDate` in
    `DailyEntryForm.tsx`. Do not add a third formatter.

## Acceptance criteria

- [ ] `/?date=2026-10-10` renders that day's entry, workouts, note, zones and week.
- [ ] `/?date=` with a bad or future value shows today, and the URL is left alone.
- [ ] Previous moves one day back and updates the URL. Back in the browser returns.
- [ ] Next is disabled on today.
- [ ] The date picker opens from the header date and jumps to the picked day.
- [ ] Every label that said "today" names the day when the day is not today.
- [ ] A past day shows "Edit this day", which opens `/log?date=<date>`.
- [ ] The heat map and the Workouts day card open `/?date=<date>`.
- [ ] No raw hex, every button typed, 44 px targets, `pnpm design:check` passes.
- [ ] Coverage floors hold. `pnpm verify` passes.

## Tests

- `lib/format/logDate.test.ts`: `dayPath` for today and for a past day.
- `useDashboard.test.tsx`: a past date reads that day's entry and sessions.
- `DashboardHeader.test.tsx`: the three controls, disabled next on today, the labels.
- `Dashboard.test.tsx`: `?date=` flows to the view; the edit button shows for a past day only.
- `TodayHero.test.tsx`, `TodayWorkoutCard.test.tsx`: the day labels.
- `StreakHeatMap.test.tsx`, `DayCard.test.tsx`, `DailyEntryForm.test.tsx`: the links.
- `tests/e2e/dashboard.spec.ts`: open `/?date=` for a seeded past day and read a value;
  click Previous and read the URL.

## Verification

1. `pnpm check:step`, then `pnpm verify`.
2. Screenshots of `/` and `/?date=<past>` at 390, 768 and 1440 px for the report.
