# Phase 1 — The daily tracker

Goal: replace the Excel sheet completely.

Exit condition: the user installs the app on an iPhone, records a day with flight
mode on, sees it sync when the network returns, and reads every Phase 1 chart. The
same app works on a laptop with a sidebar layout.

Every step below ends with `pnpm verify` green. Load the `design-system` skill before
any step that touches `app/` or `components/`.

---

## 1.1 Supabase project and migration 0001

**Do**

1. Create the Supabase project. Put the URL and the anon key in `.env.local`.
2. Write `supabase/migrations/0001_phase1.sql`:
   - `profiles` and `daily_entries` exactly as the specification states.
   - A unique index on `(user_id, entry_date)` where `deleted_at is null`.
   - An index on `(user_id, updated_at)`. The sync pull uses it.
   - Row Level Security on both tables, with select, insert, update and delete
     policies of `user_id = auth.uid()`.
   - A trigger that sets `updated_at = now()` on every update.
   - A trigger on `auth.users` insert that creates the matching `profiles` row.
3. Apply the migration. Confirm the policies with a second test account.

**Test by hand** Account A cannot read a row of account B. Confirm this in the
Supabase SQL editor.

**Done when** the migration applies cleanly on a fresh database.

---

## 1.2 Generated types and the Supabase clients

**Do**

1. `pnpm supabase gen types typescript --project-id <id> > lib/supabase/database.types.ts`
2. Add the script `"types:db"` so the command is repeatable.
3. `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (server
   components and route handlers), `lib/supabase/middleware.ts` (session refresh).
4. Confirm the ESLint `no-restricted-imports` rule blocks a component that imports
   any of these three files.

**Done when** `pnpm lint` fails on a deliberate bad import, and passes once removed.

---

## 1.3 Auth: magic link, middleware, route groups

**Do**

1. `middleware.ts` refreshes the session and redirects an anonymous visitor to
   `/sign-in`.
2. Route groups: `app/(auth)/sign-in/page.tsx` and `app/(app)/...` for everything
   that needs a session.
3. Build the sign-in screen from the mockup: the dumbbell mark, the title, the email
   field, the send button, the install hint card, and the two trust chips.
4. Handle the callback at `app/auth/callback/route.ts`.
5. Add a "check your email" state after the send.

**Tests**

- Component: the form shows an error for an invalid email and does not submit.
- Component: the button shows a pending state and is disabled while sending.
- E2E: an anonymous visit to `/` lands on `/sign-in`.

**Done when** a real magic link signs you in on both the phone and the laptop.

---

## 1.4 `lib/duration.ts` — write the tests first

This helper carries the most risk. Your sheet mixes formats, and a wrong guess
silently corrupts history. Coverage target is 100 percent.

**Two functions**

```ts
parseInput(text: string): { ok: true; seconds: number } | { ok: false; reason: string }
parseSheetValue(text: string): { seconds: number; certain: boolean } | null
formatDuration(seconds: number, style: 'clock' | 'short'): string
```

**`parseInput` accepts** (this is the form field)

| Input     | Seconds                            |
| --------- | ---------------------------------- |
| `1:12:05` | 4325                               |
| `72:05`   | 4325                               |
| `72m`     | 4320                               |
| `1h 12m`  | 4320                               |
| `1h12m`   | 4320                               |
| `90`      | 5400 (a bare number means minutes) |
| `1.5h`    | 5400                               |

**`parseInput` rejects** empty text, `abc`, `1:70:00`, `-5`, `25h`.

**`parseSheetValue` rules** (this is the CSV importer)

| Shape                                          | Reading                                       | Certain |
| ---------------------------------------------- | --------------------------------------------- | ------- |
| Three dot parts, `1.15.37`                     | `h.mm.ss`                                     | yes     |
| Colon form, `1:03:13`                          | `h:mm:ss`                                     | yes     |
| Two dot parts, second part 60 or more, `19.93` | decimal minutes                               | yes     |
| Two dot parts, second part under 60, `15.54`   | `mm.ss`, but decimal minutes is also possible | **no**  |
| One number, `25`                               | whole minutes                                 | yes     |
| `0`, `-`, empty                                | no value, return null                         | —       |

**Test cases: every value in the real sheet**

Walk column: `15.54`, `28.24`, `0`, `20.21`, `19.93`, `1.15.37`, `1.23.00`, `0`,
`25`, `51.03`, `27.04`, `36.45`, `38.04`, `02.37.00`, `44.43`, `55.24`.
Gym column: `1:03:13`, `52.24`, `01.44.50`, `01.08.17`, `01.00.14`, `01.23.03`, `0`,
`35.09`, `01.23.07`, `01.01.59`, `51.02`, `01.03.19`, `01.06.13`, `-`, `01.19.53`,
`01.12.05`.

Assert the exact second count and the exact `certain` flag for each one. Also assert
a round trip: `parseInput(formatDuration(s, 'clock')).seconds === s` for 200 random
values.

**Done when** coverage on this file is 100 percent and every case above passes.

---

## 1.5 Shared zod schemas

**Do**

1. `lib/schema/dailyEntry.ts`: the entry shape, with bounds.
   - `avg_heart_rate` and `max_heart_rate` between 30 and 230.
   - `max_heart_rate` must be at least `avg_heart_rate`. Use a refinement.
   - `weight_kg` between 20 and 300, two decimals.
   - `calories_burnt` between 0 and 10000. `steps` between 0 and 200000.
   - `entry_date` is an ISO date, not in the future.
2. `lib/schema/profile.ts`.
3. The form, the outbox and the CSV importer all import from here. Never re-declare.

**Tests** One case per bound, above and below. One case for the heart rate
refinement. One case for a future date.

---

## 1.6 Dexie schema and the repository

**Do**

1. `lib/db/dexie.ts`, version 1. Tables: `dailyEntries`, `profiles`, `outbox`,
   `syncMeta`. Index `dailyEntries` on `entry_date` and on `updated_at`.
2. `lib/db/repository.ts`. The only interface the screens use:
   ```ts
   getDay(date: string): Promise<DailyEntry | undefined>
   upsertDay(input: DailyEntryInput): Promise<DailyEntry>
   listRange(from: string, to: string): Promise<DailyEntry[]>
   softDeleteDay(date: string): Promise<void>
   getProfile(): Promise<Profile>
   updateProfile(patch: Partial<Profile>): Promise<Profile>
   ```
3. Every write does two things in one Dexie transaction: it writes the row and it
   appends an outbox entry. Never one without the other.
4. The client generates the UUID. Never wait for the server.

**Tests** (with `fake-indexeddb`)

- `upsertDay` creates a row and exactly one outbox entry.
- A second `upsertDay` on the same date updates the row, does not duplicate it, and
  appends a second outbox entry.
- `listRange` returns rows in date order and skips soft-deleted rows.
- `softDeleteDay` sets `deleted_at` and appends an outbox entry.
- A failure inside the transaction rolls back both the row and the outbox entry.

---

## 1.7 The outbox and the sync worker — write the tests first

**Do**

1. `lib/sync/outbox.ts`: append, list pending in order, mark done, mark failed with
   an attempt count.
2. `lib/sync/worker.ts`:
   - **Push**: drain the outbox in order. Upsert each row on `id`. On success mark
     it done. On failure increase the attempt count and back off:
     1 s, 2 s, 4 s, 8 s, 30 s, then 60 s as the ceiling.
   - **Pull**: select rows where `updated_at > cursor`, write them to Dexie, then
     move the cursor. Store the cursor in `syncMeta`.
   - **Conflict**: the higher `updated_at` wins. On a tie the server wins.
   - **Triggers**: app start, the window `online` event, and every 30 s while online.
3. `lib/sync/useSyncStatus.ts`: a hook that reports `offline`, `syncing`, `synced`
   or `error`, plus the number of pending writes.

**Tests** (mock the Supabase client)

- A write with the network down stays in the outbox and the row is still readable.
- One drain pushes every pending entry, in order, and clears the outbox.
- A failed push keeps the entry and raises its attempt count.
- Pushing the same UUID twice results in one row, not two.
- A pull with a newer server row overwrites the local row.
- A pull with an older server row does not overwrite a newer local row.
- The cursor only moves forward.
- Two drains started at once do not double-push. Use a lock.

**Done when** coverage on `lib/sync/**` is 95 percent or higher.

---

## 1.8 The responsive app shell

Load the `design-system` skill first.

**Do**

1. `components/ui/AppShell.tsx`:
   - Under 1024 px: content column with 20 px gutters, plus the bottom tab bar with
     five slots and the accent centre action.
   - 1024 px and up: a 240 px left sidebar with the same five destinations as rows,
     content capped at 1100 px and centred, no bottom bar.
   - The tab bar adds `env(safe-area-inset-bottom)`.
2. Build every primitive listed in Phase 0 section 0.9.2.
3. Add each one to `/styleguide` as you build it.

**Tests**

- Component: the tab bar renders under 1024 px and the sidebar renders at 1024 px
  and up. Drive this with a mocked match media.
- Component: the active destination has `aria-current="page"`.
- E2E on all three devices: no horizontal scroll, and the tab bar or the sidebar
  appears as the table in 0.9.3 states.

---

## 1.9 `/log` — the daily form

**Do**

1. Build the form from the mockup: gym time and walk time side by side, the two
   heart rates side by side, weight with minus and plus buttons, calories and steps
   side by side, and a note field.
2. Use `react-hook-form` with the zod resolver from 1.5.
3. `DurationField` shows the hint `Accepts 1:12:05, 72m or 1h 12m` and shows the
   parsed value under the field as you type.
4. Set `inputMode="decimal"` on weight and `inputMode="numeric"` on the counts, so
   the phone shows the right keypad.
5. Save writes through the repository. It never awaits the network.
6. Show the `OFFLINE` chip when the network is down, and state that the data is safe.
7. On a laptop, lay the fields out in two columns at 1024 px and up.

**Tests**

- Component: an invalid duration blocks the save and names the problem.
- Component: a max heart rate below the average blocks the save.
- Component: the plus button changes the weight by 0.05.
- Component: a successful save calls `upsertDay` once with parsed seconds, not text.
- E2E mobile: fill the form offline, save, reload, and the value is still there.

---

## 1.10 `lib/metrics` — write the tests first

**Do**

| File                | Function                                                   |
| ------------------- | ---------------------------------------------------------- |
| `streak.ts`         | The current streak and the longest streak from a date list |
| `movingAverage.ts`  | A 7-day average over sparse dates                          |
| `weekTotals.ts`     | Sessions, gym seconds, walk seconds, calories, steps       |
| `heartRateZones.ts` | Split a session into warm, fat burn, cardio and peak       |

**Tests**

- `streak`: no entries, one entry today, one entry yesterday, a gap of one day, a gap
  of three days, two entries on the same date, and a run that crosses a month.
- `streak`: a time zone edge. An entry at 23:30 local must count for that local day.
- `movingAverage`: the window is shorter than 7 days, the dates are sparse, and the
  result at index 0 equals the first value.
- `weekTotals`: an empty week, a week with a null weight, and a week that crosses a
  month boundary.
- Every function returns a safe value for an empty input. It never throws.

**Done when** coverage on `lib/metrics/**` is 100 percent for lines.

---

## 1.11 `/` — the dashboard

**Do**

1. Build from the mockup: the header with the date, the sync chip and the avatar;
   the accent hero card with the gym time, the streak pill and the four inline
   numbers; the two stat cards; the heart rate zone bar; the week totals row.
2. At 1024 px and up, lay the cards out in three columns.
3. Empty state: with no entry today, the hero card invites the user to log the day.
4. Read through the repository only.

**Tests**

- Component: the empty state appears with no entry for today.
- Component: the streak number matches `lib/metrics/streak`.
- E2E: the dashboard shows the value saved by the `/log` test.

---

## 1.12 `/analytics` — the Phase 1 charts

**Do**

1. The Day, Week and Month tabs with `SegmentedTabs`.
2. Charts, all with Recharts, all reading colors from `lib/design/tokens.ts`:
   - Weight per day with the 7-day average line.
   - Calories per day, bars.
   - Steps per day, bars.
   - Average and highest heart rate, two lines.
   - The heart rate zone split for the selected day.
   - A calendar heat map for the streak.
   - The week totals row.
3. Every chart uses `ResponsiveContainer`. Never a fixed pixel width.
4. Each chart has an empty state and a `role="img"` with an `aria-label` that states
   the trend in words.
5. At 1024 px and up, show two charts per row.

**Tests**

- Component: each chart renders with an empty series and shows its empty state.
- Component: switching the tab changes the range passed to `listRange`.
- E2E desktop: two charts per row at 1440 px. E2E mobile: one per row at 390 px.

---

## 1.13 `/profile`

**Do**

1. The header card, the targets list, the data card and the sign-out button, from
   the mockup. Hide the Phase 2 import card behind a flag until Phase 2 lands.
2. The unit toggle changes the display only. Storage stays metric.
3. The sync card shows the pending count and a "Sync now" button.
4. Sign out clears the Dexie database, so a second account never sees old rows.

**Tests**

- Component: the unit toggle changes the shown weight but not the stored value.
- Integration: sign out empties every Dexie table.

---

## 1.14 The motion pass

**Do**

1. Count the hero number up on the dashboard when it first appears.
2. Draw the chart lines in over 400 ms on first paint only, never on a re-render.
3. Fade and slide page transitions, 180 ms.
4. A short press feedback on the tab bar buttons.
5. Respect `prefers-reduced-motion`. When it is set, show the end state at once.

**Tests** Component: with reduced motion set, no animation runs and the final value
is in the document immediately.

---

## 1.15 The responsive pass and the accessibility pass

**Do**

1. Walk every screen at 320, 390, 430, 768, 1024, 1440 and 2560 px.
2. Fix any horizontal scroll, any clipped text and any target under 44 px.
3. Run the `ui-reviewer` agent against every screen.
4. Run axe in the E2E suite on every route.

**Done when** axe reports zero serious or critical issues on every route, on both the
mobile project and the desktop project.

---

## 1.16 The end-to-end suite

Write these, on all three Playwright projects:

1. An anonymous visit redirects to `/sign-in`.
2. Sign in, then land on the dashboard.
3. Record a day. The dashboard number changes.
4. Go offline. Record a second day. It appears at once and the chip reads `OFFLINE`.
5. Go online. The chip turns green and the row reaches Supabase.
6. Kill the app while offline, reopen it, and the unsynced write is still pending.
7. Analytics renders every chart with no console error.
8. Lighthouse passes installability.

---

## 1.17 Deploy and the real device check

**Do**

1. Deploy to Vercel. Set the environment variables.
2. On a real iPhone: open the URL in Safari, use Share, then Add to Home Screen.
3. Open it from the home screen. Confirm there is no browser chrome and the safe
   area is respected.
4. Turn on flight mode. Record a day. Turn flight mode off. Confirm it syncs.
5. Open the same URL on the laptop. Confirm the sidebar layout and the same data.

---

## Phase 1 checklist

- [ ] `pnpm verify` passes.
- [ ] `pnpm e2e` passes on all three projects.
- [ ] `lib/duration.ts` coverage is 100 percent.
- [ ] `lib/metrics/**` coverage is 100 percent for lines.
- [ ] `lib/sync/**` coverage is 95 percent or higher.
- [ ] Zero serious axe issues on every route.
- [ ] No horizontal scroll from 320 px to 2560 px.
- [ ] Installed on the iPhone home screen and tested with flight mode.
- [ ] The laptop layout uses the sidebar and shows the same data.
- [ ] `/styleguide` still matches the prototype.

**Commit** one report per step. The final one is
`feat(ui): phase 1 daily tracker complete`.
