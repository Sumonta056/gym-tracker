# Progress archive — Phase 0 to Phase 2

Moved out of the root `PROGRESS.md` on 2026-10-04, when Phase 2 closed. The decisions below
still hold. Read the matching line before you change a Phase 1 or Phase 2 feature.

The plans for these phases are in `docs/plan/archive/`. The open items stay in the root
`PROGRESS.md`.

## Phase 2 head lines, as they stood at the close

**Branch:** `feat/phase-2-workout-log`, cut from `main` at `839ee97`.
**Last commit:** `docs(docs)`, `f0f4eed`, after the auth merge.
Checkpoint 0 is ticked. The owner accepted plates p7 to p11 on 2026-09-27.
The owner approved Checkpoint A on 2026-09-28.
The owner approved Checkpoint B on 2026-10-01 from a Playwright run at 390 px.
The owner approved Checkpoint C on 2026-10-04.
The owner approved Checkpoint D on 2026-10-04. `pnpm verify` passed after the auth merge:
2715 unit tests, 528 e2e passed, 1 skipped (WebKit has no service worker).

## Notes from the Phase 2 sessions

- Stopped on 2026-09-30 after 2.5. The report is `reports/2026-09-30-rest-timer.html`.
- 2026-09-26: `feat/password-sign-in` adds password sign-in, commit `05813c8`. The report
  is `reports/2026-09-26-password-sign-in.html`. It is not a Phase 2 step.

## Settled, do not reopen

- **Zones are modelled, not measured.** Floors 0.6, 0.7, 0.85 of the session's own peak.
  A true `220 − age` needs a migration. The bar is indicative, never clinical. From 1.10.
- **The zone bar has four segments**, warm included. The prototype is corrected. From 1.10.
- **The dashboard follows the step file and the mockup.** The prototype is corrected.
  `--color-ok` also marks the fat-burn zone. From 1.11.
- **Chart screens keep two columns at 1024 px and up.** `SegmentedTabs` is a toggle
  group with `aria-pressed`, not tabs. The prototype analytics plate is corrected. From 1.12.
- **The sync worker starts in the `(app)` layout** through `SyncRunner`. Sign out drains
  first, then asks before it deletes a pending write. The chip has four states. From 1.13.
- **A refused write moves to `deadLetters`** after a permanent code or 20 attempts, 3 in a
  row at most per drain. The chip shows Pending. Sign-out holds `DRAIN_LOCK` across the
  clear and the server sign-out, with a 15 s marker for other tabs. From 1.13b.
- **The sign-out limits are closed**, in `.claude/rules/architecture.md` under "The sign-out".
  5 s lock wait, a refusal count that survives a turn, `signed_out` refuses every save.
  No Web Locks plus no `localStorage` is kept on purpose. Retry does not reset the count. From 1.16b.
- **Motion lives in `components/motion/`.** Chart labels fade in on every chart, bars too.
  The durations are in the design-system skill's Motion section. From 1.14.
- **The recipe wins over the prototype**, unless the recipe is wrong for real use.
  `NumberField` keeps `decimal`. The `/log` two-column form and the Phase 1 tab bar are
  named exceptions in `responsive.md`. A bar chart's goal label sits inside the plot. From 1.15.
- **Signed-in e2e tests use the test account** `E2E_EMAIL` in `.env.test.local` and CI secrets.
  A setup project signs in with the password and the anon key. No service-role key. From 1.16.
- **Email and password, open registration.** `/sign-up` makes an account. The magic link,
  `/auth/callback` and `SITE_URL` are gone. Every decision: `docs/plan/auth/PROGRESS.md`.
- **The Phase 2 plates follow the plan for behaviour.** One muscle group warns. The rest card
  has +30 s and Change. The p8 card, with both values, is the gym time offer on `/log`
  and on p2. `15.54` reads `15m 54s` or `15m 32s`. The Month volume chart labels its
  highest bar only, its average label in the band. The one-rep max and gap charts show no average line. From 2.0.
- **The workout tables carry `created_at`, `updated_at` and `deleted_at`**, as the step file and
  the skill say. Spec section 5 is behind. `workout_sets` has no `user_id` and uses an `exists`
  policy on its session. `exercises.user_id` null is a global, read-only row. Dexie keeps
  `STORES_V2` as the frozen version 2 block. From 2.1a.
- **The seed has 40 global exercises with permanent ids.** No `Plank`: a set holds reps and
  weight only, so `Decline Sit-Up` replaces it. Cardio keeps its 5 rows. From 2.1b.
- **The worker holds a table it does not sync yet.** `SYNCED_TABLES` in `lib/sync/outbox.ts`.
  A held entry is not sent, not dead-lettered, and blocks nothing behind it. It still counts as
  pending. Own exercises store `user_id` `LOCAL_PROFILE_ID`; `null` is a global row. The
  profile rest fields sync both ways. Limits: reps 1 to 1000 and required, name 1 to 80,
  rest 0 to 3600 s. From 2.2a.
- **The session and set repository.** `addSet` takes the set without `set_index` and sets the
  highest index plus 1, deleted sets included. A finished session still takes a set. `updateSet`
  changes only `reps`, `weight_kg`, `rpe` and `completed_at`. From 2.2b.
- **The workout tables sync.** Mappings live in `lib/sync/mappings.ts`. A null-owner exercise is
  `GLOBAL_ROW`, a 23505 on a session is `ACTIVE_SESSION_ELSEWHERE`, both dead letters. A 23503 on a
  set is transient. A set behind a refused parent is held. Unknown `muscle_group` reads `core`,
  unknown `status` reads `finished`. The last push wins, in `architecture.md`. From 2.2c.
- **The set policy.** A set insert or update needs the exercise to be the user's own or global.
  `reps` is `not null`, 1 to 1000, on the server. No Dexie bump: no Dexie table changed. From 2.2d.
- **The lift metrics.** `roundTo2` in `lib/metrics/round.ts` is the one rounding. A record carries
  the set `completed_at`, else `created_at`. Best load and best volume are per set; a load tie goes
  to the earlier set. A null-load set is never a record. One rep returns the load itself. From 2.7a.
- **The week metrics.** `muscleBalance` shares are whole percents by the largest remainder; the
  15 % warning tests the rounded share. `sessionGaps` counts every daily row date, gym time or
  not, and its last bucket is 5 or more days. `caloriesPerMinute` gives one point per row. From 2.7b.
- **The exercise picker.** `SheetModal` takes an optional `footer`: header and footer stay fixed,
  the body scrolls. The picker pins its create button there; search and chips scroll with the list.
  Recent reads `lastSetsFor` once. `listExercises` takes `includeArchived`. Plate p4 is corrected:
  title, close, full list, muted row text, scrolling chips, Title Case, a 20 px header gap. From 2.3a.
- **Manage exercises.** Its own "Exercises" card on `/profile`, always shown, not in `DataCard`.
  No "43" count and no "past sets kept" count. The "Built in" badge is `MicroLabel` at 700.
  Rename is an inline field in the row. Plate p9 is corrected to match. From 2.3b.
- **The live workout.** The newest `started_at` wins when 2 sessions are active. The last set is
  by `completed_at`, else `created_at`. The active card has Reps and Load fields; Add set copies
  into them. No tick on a set row. The first set of an exercise is never a PR. The timer reads
  `42:17`. Finish caps `ended_at` at `started_at` and does not re-check a stored date, so a clock
  behind another device can always finish. The e2e `day` fixture clears sessions. Plate p3 is
  corrected. The offline to Supabase check passed on 2026-09-29. From 2.4a.
- **Edit, undo and resume.** A tap on a set row opens the edit sheet; swipe and long press are extras.
  Undo shows 5 s and calls `restoreSet`. `isNewRecord` compares with earlier sets only. Resume or
  Discard shows once per app open, on every `(app)` route except `/workout`; Discard reloads the
  page. Last time is Epley on the last earlier set, rounded to a whole kg; plate p3 reads 92 kg.
  A session's held sets are discarded only when the local session is deleted and nothing else
  waits for it. The edit sheet, the toast and the prompt have no plate; they are settled as built. From 2.4b.
- **The rest timer.** The end is the newest set's `completed_at` plus the rest plus 30 s a tap; the
  clock reads `1:24`. Default 90 s. Change is a text sheet (`1:30`, `90s`, `2m`) that saves through
  `setRestSeconds` and applies to the next rest. Skip and +30 s live in memory; a reload drops them.
  The alert fires only when the page sees zero. A 0 s rest shows no card. Mute is its own "Rest
  timer" card on `/profile`; plate p6 is corrected. The rest map is last push wins as a whole. From 2.5.
- **The server stamp is one transaction.** `stampRow` reads and writes inside one `rw` transaction on
  the entity table alone. Every competing write holds that table, so a save in between is kept. From fix(sync).
- **A sync call during a drain queues one follow-up drain**, for every trigger. Later calls join it. A follow-
  up after a halt returns offline and takes no lock. The extra drain costs one pull when nothing changed;
  kept. No reload on `online`: `reloadOnOnline={false}`. From fix(sync) and fix(pwa), 2026-10-01.
- **Checkpoint B passed in the browser.** iPhone 14 and Pixel 7 at 390 px: 1 session, 6 sets, no duplicate,
  outbox 0. Both timers right after a reload and a hidden tab. WebKit offline cuts Supabase only. 2026-10-01.
- **Safe area insets.** The shell, the sign-in and the offline page pad the top by the inset. The tab bar pads
  `max(inset, 10px)`. The session timer reads the clock on `visibilitychange`. From fix(ui), 2026-10-01.
- **No Supabase response in Cache Storage.** The Supabase rule in `app/sw.ts` is `NetworkOnly`; `activate` deletes the old
  `supabase` cache. `waitForServiceWorker` lives in `tests/e2e/support/signedIn.ts`. `security.spec.ts` skips WebKit and
  closes the "Session running" prompt with Close, never Discard. The host matcher stays `.supabase.co`. From 2.5b A.
- **The security headers.** `next.config.ts` sends 5 headers on `/:path*`, static files and `/sw.js` too. `headers()` returns
  `Promise.resolve`, because `require-await` refuses an `async` with no `await`. Lighthouse 11.4 PWA scores 1. From 2.5b C.
- **The gym time offer.** Length is `ended_at` minus `started_at`, whole seconds, rounded down. No offer at 0 s, over 24 h,
  or when the log holds the same value. Finish opens a sheet; Use writes `gym_seconds` only, Keep, × and Escape write nothing.
  `/log` offers the newest finished session of the date. A decline is not remembered. The shared sheet and its wording
  win over plate p8. A session belongs to its `entry_date`, past midnight too. From 2.6.
- **The lift charts.** Volume and one-rep max follow the Day/Week/Month tab; the record list is all-time, A to Z, no cap.
  The week change compares Monday to today with the same weekdays of last week. Default picks are the 2 most-trained lifts,
  3 at most. Est. 1RM is the best Epley over all sets; plate 45 × 8 reads 57.0. Imperial is display only. A line needs 2
  sessions. The volume chart turns a "below" average label into "band", and drops a bar value label within 3 px of the
  average line; both are named rules in `charts.md`. Record loads in lb show 1 decimal, no `.0`; kg as logged. From 2.8a.
- **The week charts.** Balance is always this week; gaps and calories a minute follow the Day/Week/Month tab. Gaps take every
  daily row date. Two or more groups under 15 % share one warning line that names them all. A 0 % group warns but has no legend
  row. The calorie average label sits on the side away from the end label, else in the band; a named rule in `charts.md`. The
  balance bar uses 4 new tokens, `data-pink` arms, `data-blue` shoulders, `data-yellow` core, `data-slate` cardio; `warn` means
  only the warning. Plate 11 is corrected. `chartPalette` does not take them. From 2.8b.
- **The sheet parser.** `parseSheet` is pure and never throws; cells are `ok`, `review` or `error`. A review reading is mm.ss first,
  decimal second, labelled by `formatDuration` style `minsec`. `"11,482"` steps read 11482. Blank, `0` or `-` is ok with no value;
  unreadable text is an error. A trailing newline is not a blank row. BOM, CRLF and doubled quotes parse. The fixture is synthetic,
  made-up numbers in the real cell shapes; the owner approved it in the repository. A missing column's cells, a short or long row
  and an unclosed quote are only proven not to throw; 2.9b decides what they show. From 2.9a.
- **The import review.** "Import the old sheet" on the Data card asks the year first; the review has "Change year", which reads the
  file again and clears every pick. Cards under 1024 px (2 columns from `md:`), a table at 1024 px and up. A picked cell keeps both
  buttons. Review cells on an error row are not counted. Similar means same column and same digits after the point. Rows number
  by position. Future dates are errors. Weight shows in kg. The table heading is "Kcal". Apply writes nothing yet. Plate p10 gains
  the laptop frame `pl-import`; its duplicate date card is marked for 2.9c. From 2.9b.
- **The import apply.** `importDays` writes every row and its outbox entry in one transaction; it checks `signed_out`, then the first
  daily pull. A logged date asks Skip, Overwrite or Merge and adds 1 to the count; "Apply to all duplicates" sets one choice. Overwrite
  keeps the `id` and the note and sets a blank cell to null. Merge fills null fields only; a Merge that fills nothing writes nothing and
  counts as skipped (the confirm sheet still counts it merged). A repeated date in the sheet keeps the first row. The result travels in
  `/?imported=`; the status region is always mounted, above the dashboard header. No import before `pulled_daily_entries`, written
  after a daily pull shorter than `PULL_PAGE_ROWS` (1000). The e2e build sets `NEXT_PUBLIC_ENABLE_CSV_IMPORT`; production stays off.
  Plates p10b and p10c added. From 2.9c.
- **The service worker wait reloads once.** A worker that activates during a navigation does not control that
  page. `waitForServiceWorker` waits for an active worker, reloads once if the page is not controlled. From fix(test).
- **The export.** "Export all data" on the Data card saves `gym-tracker-<date>.zip`, read from Dexie through `exportTables`, offline
  too. No `fflate`: `lib/csv/zip.ts` writes a stored zip. One `daily-entries-<year>.csv` per year in the old sheet's headers, plus a
  Note column the importer skips. Durations are `h:mm:ss`, the `'hms'` style. Exercises, sessions and sets files too; every file
  starts with a BOM. Soft-deleted rows and sets of a deleted session are left out. Web Share when the device can share the file,
  else a download link. The owner accepted it as built. From 2.10.
