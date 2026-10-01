# Progress

**Start of every session:** read `CLAUDE.md`, then the step file named below, then do
that one step only. Stop and report when the step is done.

**Current phase:** 2 — Workout log and import · `docs/plan/02-phase-2.md`
**Step index:** `docs/plan/phase-2/index.md`
**Next step:** fix(ui) the session timer reads the clock on `visibilitychange`. Then 2.5b → `docs/plan/phase-2/S2.5b-security-hardening.md`. Then 2.6 → `docs/plan/phase-2/S2.6-link-to-day.md`
**Branch:** `feat/phase-2-workout-log`, cut from `main` at `839ee97`.
**Last commit:** `fix(pwa)`, no reload on `online`, on top of the `fix(sync)` follow-up drain.
Checkpoint 0 is ticked. The owner accepted plates p7 to p11 on 2026-09-27.
The owner approved Checkpoint B on 2026-10-01 from a Playwright run at 390 px.

## Resume here

- Stopped on 2026-09-30 after 2.5. The report is `reports/2026-09-30-rest-timer.html`.
  The owner approved Checkpoint A on 2026-09-28.
- Migrations `20260927142258_phase2_workouts`, `20260927151153_phase2_exercise_seed` and
  `20260928084529_phase2_set_policy_reps` are applied to the live project. Never apply them again.
- `apply_migration` records its own version. Rename the local file to the version that
  `list_migrations` shows.
- Run each step in a fresh subagent. PATH: `export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"`.
  `.nvmrc` pins `24.21.0`. It stages and stops. The owner runs the commit.
- A UI change puts screenshots in the report. See `.claude/rules/git.md`.
- Stop any `next dev` before `pnpm verify`. A shared `.next` breaks the build.
- 2026-09-26: `feat/password-sign-in` adds password sign-in, commit `05813c8`. The report
  is `reports/2026-09-26-password-sign-in.html`. Not pushed. It is not a Phase 2 step.

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
- **Password sign-in is the default, the magic link is the fallback.** The email is the
  login name. No sign-up screen and no set-password screen. The owner sets the password
  in the Supabase dashboard. One generic error for every refusal. From 2026-09-26.
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

## Open, with the step that closes each one

- **Owner** — add four CI secrets: `E2E_EMAIL`, `E2E_PASSWORD`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. From 1.16.
- **Owner** — the prototype sync card lacks the failed-writes rows. From 1.13b.
- **Owner** — `/log` shows its chip only when offline. The recipe wants `SyncChip`. From 1.15.
- **Owner** — `/log` takes weight in kg only. The imperial setting is display only elsewhere.
  From 1.13.
- **2.9b** — import review has no plate at 1024 px and up. From 2.0.
- **Owner** — `lastSetFor` reads every set, because `workoutSets` has no `exercise_id` index.
  An index needs Dexie version 4. Acceptable for one user. From 2.2b.
- **Owner** — `deadLetters.ts` at 93.1 % lines once passed `pnpm verify` in a subagent run. Check
  that the `lib/sync/**` floor in `vitest.config` fails a single file. From 2.2a.
- **Owner** — `reps ?? MIN_REPS` in `lib/sync/mappings.ts` stays until the generated Supabase types
  say `reps: number`. Remove it with the type change. From 2.2d.
- **New step** — a refused session that is still live here (`ACTIVE_SESSION_ELSEWHERE`): Discard
  releases its held sets and they fail again. No write is lost. Hold them behind a marker until a
  later session write is confirmed. From 2.4b.
- **Owner** — the cleanup of out-of-date dead letters covers sessions and exercises only. The
  same rule fits daily entries and profiles. From 2.2c.
- **Owner** — the e2e suite fails 1 to 6 tests on some runs: WebKit timeouts and `fetch failed`
  in the Supabase cleanup helper. Each passes on rerun. From 2.2c.
- **Owner** — `get_advisors` warns that leaked password protection is off. An Auth setting. From 2.1a.
- **2.8b** — pass `sessionGaps` every daily row date, not only rows with gym time. The 1, 3, 3,
  3, 1 target needs 9 September. From 2.7b.
- **Owner** — no unique index on global exercise names. Only the seed adds global rows. The owner
  deferred it. From 2.1b.
- **Owner** — add plates for the edit sheet, the undo toast, the resume prompt and the rest Change sheet. From 2.4b.
- **Owner** — `tests/e2e/workout.spec.ts:382` runs about 14 s against its 15 s timeout and
  fails on some runs. Raise the timeout or trim the setup. From fix(sync).
- **Later step** — a 0 s rest shows no card, so its rest cannot be changed. Add a rest control in
  Manage exercises. From 2.5.
- **Owner** — at 1024 px and up, Tab reaches the active card before the exercise list. From 2.4b.
- **New step after 2.4b** — `md:` switches at 768 px, not 640 px: `globals.css` has no
  `--breakpoint-md`. Set it and check every screen at 640 to 767 px. From 2.4a.
- **Owner** — plates p4, p7, p8 and the laptop plate still show "· Push day", `00:42:17` and set
  ticks. Their tab bars say "Main"; the app says "Bottom navigation". From 2.4a.
- **Owner** — `offline.spec.ts:65` can read Syncing after 5 s on WebKit when 3 projects run at once. Guess:
  the follow-up waits behind postgrest-js GET retries. If it returns, turn off retries on pull GETs. From fix(sync).

- **Owner, after deploy** — on the iPhone, lock the phone for 60 s during a rest, and record a session in
  airplane mode. Playwright gives WebKit no service worker, so true WebKit offline is unproven. From Checkpoint B.
- **Owner** — under the Playwright fake clock, `page-transition` can stay at opacity 0 after a tab change.
  Probably the test clock in `tests/e2e/support/signedIn.ts`. Check on the device. From Checkpoint B.

## Phases

- [x] Phase 0 — Foundation (11 steps) · `docs/plan/00-phase-0.md`
- [x] Phase 1 — Daily tracker (19 steps) · `docs/plan/phase-1/index.md`
- [ ] Phase 2 — Workout log and import (22 steps) · `docs/plan/phase-2/index.md`
- [ ] Phase 2 — Workout log and import (11 steps) · `docs/plan/02-phase-2.md`

## Rules that block you

1. One step at a time. Finish it, prove it, then update this file.
2. Never work on `main`. A hook blocks it. Use the branch named above.
3. `pnpm verify` must pass before a step is done.
4. Load the `design-system` skill before touching `app/` or `components/`.
5. Write the tests first for `lib/duration.ts`, `lib/sync/**` and `lib/metrics/**`.
6. No commit without a report. Run the `commit-report` skill. A hook blocks you.
7. Conventional commit messages only. Scopes live in `commitlint.config.mjs`.
8. Stop at every checkpoint in the step index. Do not pass one without approval.
9. Never start Phase 2 before every Phase 1 checklist item passes.

### Use sub-agents

A step file names the agent it needs: `test-writer`, `sync-auditor` or `ui-reviewer`.
Run it in a sub-agent to keep the main session clean.

## How to update this file

Change three lines only: **Next step**, **Branch** and **Last commit**. Tick a phase
box when its checklist passes. Keep this file under 40 lines.
