# Progress

**Start of every session:** read `CLAUDE.md`, then the step file named below, then do
that one step only. Stop and report when the step is done.

**Current phase:** 3 — Coach plans · `docs/plan/03-phase-3.md`
**Step index:** `docs/plan/phase-3/index.md`
**Next step:** 3.1, the prototype plates and the docs → `docs/plan/phase-3/S3.1-design-contract.md`
**Branch:** a new branch cut from `main` after the Phase 2 merge, for example `feat/phase-3-coach-plans`.
**Last commit:** `docs(docs)`, `f0f4eed`. Phase 2 and the auth track phase A are merged.
The owner approved Phase 2 Checkpoint D on 2026-10-04.

## Resume here

- Phase 0 to Phase 2 are closed. Their plans are in `docs/plan/archive/`. Their settled
  decisions are in `docs/plan/archive/PROGRESS-phase-0-2.md`. They still hold.
- The auth track has its own file: `docs/plan/auth/PROGRESS.md`. Phase B waits for a domain.
- Migrations `20260927142258_phase2_workouts`, `20260927151153_phase2_exercise_seed` and
  `20260928084529_phase2_set_policy_reps` are applied to the live project. Never apply them again.
- `apply_migration` records its own version. Rename the local file to the version that
  `list_migrations` shows.
- Run each step in a fresh subagent. PATH: `export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"`.
  `.nvmrc` pins `24.21.0`. It stages and stops. The owner runs the commit.
- A UI change puts screenshots in the report. See `.claude/rules/git.md`.
- Stop any `next dev` before `pnpm verify`. A shared `.next` breaks the build. After a branch
  change that deletes a route, delete `.next`: old route types fail `pnpm typecheck`.

## Settled, do not reopen

- **Phase 0 to Phase 2:** every line is in `docs/plan/archive/PROGRESS-phase-0-2.md`.
- **Email and password, open registration.** `/sign-up` makes an account. The magic link,
  `/auth/callback` and `SITE_URL` are gone. Every decision: `docs/plan/auth/PROGRESS.md`.
- **Signed-in e2e tests use the test account** `E2E_EMAIL` in `.env.test.local` and CI secrets.
  A setup project signs in with the password and the anon key. No service-role key. From 1.16.
- **The recipe wins over the prototype**, unless the recipe is wrong for real use. From 1.15.

## Open, with the step that closes each one

- **Owner** — add four CI secrets: `E2E_EMAIL`, `E2E_PASSWORD`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. From 1.16.
- **Owner** — the prototype sync card lacks the failed-writes rows. From 1.13b.
- **Owner** — `/log` shows its chip only when offline. The recipe wants `SyncChip`. From 1.15.
- **Owner** — `/log` takes weight in kg only. The imperial setting is display only elsewhere.
  From 1.13.
- **Later step** — page the daily pull. A full page whose first row waits behind a queued write cannot move the cursor, so each pull
  returns the same 1000 rows and the import waits until that write is pushed. Nothing is lost. From 2.9c.
- **Owner** — `gym-tracker` and `gym-tracker-auth` share port 3100. With `reuseExistingServer` on, 2 suites at once test the wrong
  build. Use a port per worktree, or never run both at once. From 2.9c.
- **Owner** — no plate shows the open Data card: the year field, the file input and the read error. From 2.9b.
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
  in the Supabase cleanup helper. Each passes on rerun. From 2.2c. Also `dashboard.spec.ts:27` on WebKit: the
  dashboard showed the day with no gym time; it passed 5 of 5 alone. From 2.5b A. Again in the 2.10 verify; 3 of 3 alone.
- **Owner** — no test proves that `activate` deletes an old `supabase` cache on a device with the old worker. From 2.5b A.
- **Later step** — match the Supabase rule in `app/sw.ts` on the origin of `NEXT_PUBLIC_SUPABASE_URL`, not on the
  `.supabase.co` host, so a custom domain or a local stack is not cached. From 2.5b A.
- **Owner** — `get_advisors` warns that leaked password protection is off. An Auth setting. From 2.1a.
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
  Also check in Safari Web Inspector, Storage, Cache Storage, that no `supabase` cache exists. From 2.5b A.
- **Owner** — under the Playwright fake clock, `page-transition` can stay at opacity 0 after a tab change.
  Probably the test clock in `tests/e2e/support/signedIn.ts`. Check on the device. From Checkpoint B.
- **Owner** — at a load of about 79 the worker install takes about 22 s, past the 15 s
  `SERVICE_WORKER_TIMEOUT_MS`. Slow but correct. Raise the wait and use `test.slow()` if it returns. From fix(test).
- **Owner** — `JWT issued at future` in `tests/e2e/support/account.ts:275`, in the test row cleanup. Seen
  twice. Retry the cleanup or wait for the token refresh. From fix(test).
- **Owner** — plate p8 shows a small "Session finished" label and no ×; the build uses the shared sheet. No plate for "Not now" or
  "The session on <date> was". Correct the plate. From 2.6.
- **Owner** — a session whose `entry_date` is ahead of the device date cannot save its gym time: the future date check refuses it.
  `LiveSession` imports `prettyDate` from `DailyEntryForm`; move it to `lib/format`. From 2.6.
- **Owner** — `LiveSession.test.tsx` "reads from started_at after a remount" read 42:17, not 42:20, once under load; it passed 3 of 3 alone.
  From 2.6. The `ManageExercisesSheet.test.tsx` focus race is closed: its checks wait with `waitFor`. From fix(test).
  Also flaky under load, each passed alone: `LiveSession.test.tsx` "rings the alert it is handed with the muted setting", and
  `app/styleguide/page.test.tsx` "shows the pending warning on the profile sample" (15 s timeout). From 2.9b.
  Also `motion.spec.ts:198` on WebKit: the fade took 783 ms against 600; it passed 3 of 3 alone. From 2.9c.
- **New step** — `referencePlacement` in `DailyBars.tsx` puts the value-label box 3 px too high, so a "below" label can overlap a
  value by about 4 px. Fix all 3 boxes against measured browser geometry. From 2.8a.
- **Owner** — the analytics plate reads 56.3 for 45 × 8 (Epley gives 57.0) and writes its badge in upper case. Correct the plate. From 2.8a.
- **Owner** — more e2e tests seen flaky in full runs, each passed alone: `analytics.spec.ts:381` and `workout.spec.ts:401`
  (`waitForServiceWorker`) on desktop, `dashboard.spec.ts:27` and `a11y.spec.ts:155` (`JWT issued at future`) on WebKit. From 2.8b.
- **Owner** — probably a process outside the session staged `PROGRESS.md` and the step index during the pre-commit hook of `96f40e5`.
  The gate checks the hash before the hook, so it did not see it. From fix(ui), 2026-10-01.
- **Owner** — the export hides in production: the Data card shows only with `NEXT_PUBLIC_ENABLE_CSV_IMPORT`. Show the card with the
  export alone? The export only reads. From 2.10.
- **Owner** — a Mac browser that can share a file gets a share sheet, not a download. Share only in the home-screen app? From 2.10.
- **Later step** — the importer skips the export's Note column, so notes do not come back. A stored 0 duration comes back empty,
  as 2.9a settled. Also swap in `fflate` if the owner wants it. From 2.10.
- **Owner** — plate p6 has no Data card, and the busy export state has no spoken confirmation. From 2.10.
- **Owner, after deploy** — the 2.11 device check ran in Chromium at 390 px on a local build, not on the iPhone. Still unproven:
  Safari and the home-screen app, a real airplane mode with a cold start, a real screen lock, and the iOS share sheet for the
  export. Push the branch, set `NEXT_PUBLIC_ENABLE_CSV_IMPORT` on Preview, and run them. From 2.11.
- **Later step** — the new screens in `responsive.spec.ts` skip "clips no text" and "keeps the navigation in view at the foot of
  the page", which the older routes run. The picker sheet skips the one-navigation check, as the style guide sheet does. From 2.11.
- **Later step** — `lib/csv/export.ts` branches are 92.85 %; lines 114 and 150 are not taken. The folder is 95 %. From 2.11.
- **Later step** — `/styleguide` has no `ResumePrompt` sample, and its live workout sample is a 2-column grid with no header,
  "Done so far" or laptop list, unlike `LiveSession`. The style guide is the bug. From 2.11.
- **Owner** — plate p3 shows the rest card with no Skip, +30 s or Change. "Last time" is `dim`, not `muted`, on p3 and the laptop
  plate, and sits after Add set there. Plate p8 says "Sat 20 Sep"; it is a Sunday. Correct the plates. From 2.11.
- **Later step** — `ImportConfirmSheet.tsx:103` puts its error at the end of the scrolling body, not above the buttons as p10b
  shows. `ResumePrompt.tsx:154` copies the `PrimaryButton` classes by hand. From 2.11.

## Phases

- [x] Phase 0 — Foundation (11 steps) · `docs/plan/archive/00-phase-0.md`
- [x] Phase 1 — Daily tracker (19 steps) · `docs/plan/archive/phase-1/index.md`
- [x] Phase 2 — Workout log and import (23 steps) · `docs/plan/archive/phase-2/index.md`
- [x] Auth track, phase A and M1 · `docs/plan/archive/auth/`
- [ ] Phase 3 — Coach plans (12 steps) · `docs/plan/phase-3/index.md`
- [ ] Auth track, phase B · `docs/plan/auth/index.md`

## Rules that block you

1. One step at a time. Finish it, prove it, then update this file.
2. Never work on `main`. A hook blocks it. Use the branch named above.
3. `pnpm verify` must pass before a step is done.
4. Load the `design-system` skill before touching `app/` or `components/`.
5. Write the tests first for `lib/duration.ts`, `lib/sync/**` and `lib/metrics/**`.
6. No commit without a report. Run the `commit-report` skill. A hook blocks you.
7. Conventional commit messages only. Scopes live in `commitlint.config.mjs`.
8. Stop at every checkpoint in the step index. Do not pass one without approval.
9. Never start Phase 4 before every Phase 3 checklist item passes.

### Use sub-agents

A step file names the agent it needs: `test-writer`, `sync-auditor` or `ui-reviewer`.
Run it in a sub-agent to keep the main session clean.

## How to update this file

Change three lines only: **Next step**, **Branch** and **Last commit**. Tick a phase
box when its checklist passes. Keep this file under 40 lines.
