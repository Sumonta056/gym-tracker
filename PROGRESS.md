# Progress

**Start of every session:** read `CLAUDE.md`, then the step file named below, then do
that one step only. Stop and report when the step is done.

**Current phase:** Phase 3 — Coach plans · `docs/plan/03-phase-3.md` · **done** on 2026-10-21
**Step index:** `docs/plan/phase-3/index.md`
**Next step:** none. Phase 3 is closed. The owner picks the next phase or the open sync item below.
**Online sync fix** on 2026-10-21, after Phase 3. The `online` event and "Sync now" push an entry still in backoff at once (`sync({ ignoreBackoff: true })`, new `syncNow` in `lib/sync/worker.ts`); app start and the 30 s timer keep the backoff. The offline plan test drops from 41 to 53 s to about 10 s, so its 180 s limit is gone; the `Synced` wait in `offline.spec.ts:65` is 15 s. Owner decisions: accept that each open tab retries on `online` (a known limit in `.claude/rules/architecture.md`); "Sync now" skips the backoff too. The sync-auditor found no lost write, no duplicate row and no tight loop. Gates: `pnpm check:step` 1869 of 1870, the 1 failure `LiveSession.test.tsx` at load 117 then 91 of 91 alone; `lib/sync` 100 % lines; `pnpm e2e:step` offline and plans 11 of 12, the 1 failure `offline.spec.ts:111` then 3 of 3 alone; plans and offline on the phones 22 passed, 1 skipped; `offline.spec.ts:65` on WebKit 3 of 3.
**Step 3.12 done and Checkpoint C passed** on 2026-10-21. `a1fc431` is on `main`, pushed; Vercel built it for Production with state `success`. The full `pnpm verify` of 3.10 is the gate for this code. The owner marked the device check and every Phase 3 checklist item done. Claude did not check production: Vercel protection sends every `*.vercel.app` URL to the sign-in page.
**Step 3.10 done** on 2026-10-21, on `main`. `/styleguide` moves its body to `app/styleguide/Styleguide.tsx` with an `only` prop; `PlanSamples.tsx` adds the Guided step, the set rows and rest, and the Done samples: `StepFrame` in both views (new `initialView`), `StepProgress`, every `StepMark`, `StepListPanel`, `StepListSheet`, `FinishConfirmSheet`, the weight select, `PlanSessionDone`, the compact `SecondaryButton` and the `narrow` rest card. The style guide test split: 95 + 17 + 2 tests in about 17 s, was 99 in 110 s; each test now renders only its own sections. The plan tests read their counts from the data: a step added to Legs or Chest, or a new plan, breaks no test (was 21 tests in 8 files). From 1280 px the `narrow` rest card is 1 row (`REST`, time, Skip, +30 s), so `Skip this step` stays above the fold at 1440 × 900. New token `--font-glyph`: Figtree has no `○`, so the mark fell back to Arial at 6.7 px; it now matches the plates. `plans.spec.ts` adds the offline scenario on 3 projects; on WebKit the network down is Supabase only and the offline image check does not run, as a named `skip` annotation. `responsive.spec.ts` and `a11y.spec.ts` add `/workouts/chest-triceps` and plan mode with a set logged, the sheets and the Done screen. Owner decisions: the 1-row laptop rest card has no `Change`, as the plate shows; the slow sync after going online is an Open item; the commit scope is `feat(ui)`. Gates: `pnpm check:step` 537 of 537 changed-file tests; `pnpm e2e:step` plans, responsive, a11y 129 of 129; full `pnpm verify` 4316 unit tests, 99.29 % lines, build, 810 of 817 e2e with 6 skipped and 1 failed: `offline.spec.ts:65` on WebKit, which then passed 3 of 3 alone.
**Merged into `main`** on 2026-10-20 as `76639a3`, pushed. The owner chose to merge before 3.10. Then the owner switched this folder to `main` and deleted the merged local branches: `feat/phase-3-coach-plans`, `chore/3.11-coach-plan-skill`, `feat/phase-2-workout-log`, `fix/feedback-fixes`. The owner then removed the worktree `../gym-tracker-phase-3`. Phase 3 continues on `main` in `../gym-tracker`. A hook blocks Claude's commit and push on `main`; the owner runs both.
**Full `pnpm verify` before the `main` merge** on 2026-10-20: 4296 unit tests, 99.27 % lines, build, then 757 of 766 e2e with 6 skipped and 3 failed. The fixes: `workouts-offline.spec.ts` still looked for the old `Watch` link name (renamed in 3.8b); the reps field at 320 px overflowed by 1 px in WebKit, so below 390 px the reps column is 74 px, not 72. After the fixes, `plans.spec.ts` and `workouts-offline.spec.ts` on iPhone 14, Pixel 7 and desktop: 21 passed, 1 skipped by design. `chore/3.11-coach-plan-skill` is merged into the branch in the same commit.
**`main` merged in** on 2026-10-20: the day view `db58d5d` (the Today date picker) and `e8c2408`. No conflict. `pnpm check:step`: 1554 of 1563 passed; the 9 failures were timeouts in `app/styleguide/page.test.tsx` at a machine load of 115 to 250. With 60 s limits that file passed 99 of 99. `pnpm e2e:step` on dashboard, log-days, workout-history, import, plans and responsive: 106 of 106.
**Step 3.9 part 2 done** on 2026-10-20. `/workout` in plan mode builds plates 18f, 19, 19b and the laptop plate. `lib/metrics/planProgress.ts` adds `stepResults` (outcome, set count, heaviest ticked weight per step). New `PlanSessionDone` (the plan Done screen; a free session keeps the F1 sheet; `NewRecordsCard` comes out of `SessionSummary` unchanged) and `StepListPanel` (the 360 px list at 1024 px and up). `PlanStepHeader` shows the step count as plain text at 1024 px and up. `StepFooter` is fixed under 1024 px and sits in the right column above. `RestTimerCard` gets `narrow`; `SecondaryButton` gets `size="compact"` for `+ Add set` (44 px, 14 px text); `FinishConfirmSheet` says again "The summary lists them as not done." Owner decisions: the step image has no caption at all, in the app and the plates; a step that was skipped and is open at Finish reads `Not done`; the Done screen is the centred phone column at 1440 px; the Done screen turns focus mode off, so the tab bar shows. Gates: `pnpm check:step` 1348 changed-file tests, 99.37 % lines; `pnpm e2e:step` plans, responsive and workouts, 85 of 85, then plans 7 of 7 after the caption change.
**Step 3.11 done** on 2026-10-20, `a9c2027` on `chore/3.11-coach-plan-skill`, cut from `fa4e814`. `.claude/skills/coach-plan/` with `SKILL.md` and 2 scripts. It writes migration files only, never a live apply. All 6 acceptance runs passed. The worktree `../gym-tracker-3.11` is removed; its report is in `reports/2026-10-20-coach-plan-skill.html`. Merged into the Phase 3 branch on 2026-10-20. Owner decision: a new row stores the Free Exercise DB id, name and instructions, not its frames.
**Step 3.9 part 1 done** on 2026-10-20. `docs/design/prototype/index.html` only. New plate 18f (2 plans: `Shoulders + Legs`, `Step 6 of 8`, 8 bars), plate 19 rewritten (Session done), new 19b (0 of 9), and the 1440 laptop plate rewritten. The owner accepted the demo https://claude.ai/artifact/AURYc9BKbwT8eQnF6VicMd (version 2). Owner decisions: at 1024 px and up the right column is the 3.8b compact card, not Start, End and Muscles cells or the how-to text; the laptop header is the 3.8b 1-row header with `Finish` and the confirm, not `End session`, and `Step N of M · mm:ss` is plain text with no ▾ and no sheet, since the list on the left is always open; a plan session ends on the full Done screen of plate 19 (Gym time hero, `Volume · sets · N of M steps`, the F1 New records card, a Steps card, `Back to Workouts`), which drops the F1 3 number cells and the exercise count; a free session keeps the F1 sheet; a done row reads `✓ <sets> × <heaviest ticked weight>`, `Body` for a body weight step; the Done screen says `Not done`, the session (18c, 18e) says `Not started`; the progress bar stays on the laptop; the laptop sidebar follows `lib/nav.ts`; 18f shows no group name in the header; `Next step` is the 2-line button. From 1024 to 1279 px the rest timer, `Next step` and `Skip this step` stack under the set rows; the 300 px column starts at 1280 px. The gym time offer is gone since E3.
**Checkpoint B passed** on 2026-10-20. The owner tested the build of `fa4e814` and approved. The owner skipped the full `pnpm verify` at this checkpoint. The last full verify ran after 3.8, so run it at Checkpoint C or before the merge to `main` without fail.
**Step 3.8b part 2 done** on 2026-10-20. `/workout` in plan mode builds plates 17 to 18e. `PlanStepHeader` is 1 row: back, the title over a `Step N of M · mm:ss ▾` button that opens `StepListSheet`, and `Finish`, which opens `FinishConfirmSheet` when a step is not done. `StepFrame` is a full-bleed 16:9 image with `How to` and `Muscles`; Start and End are gone. The card shows the plain target, `Last time` and the chips, then `▶ Tutorial on YouTube`. `PlanSetRows` takes `equipment`: a native weight `<select>` from `lib/plans/weights.ts`, with `Other…` for a typed weight; a stored weight that is not on the list is added in order. The plan step schema gains `equipment`. `lib/duration.ts` gains the `spoken` style. `SheetModal` gains `initialFocus`, `closeLabel` and `subtitle`. Owner decisions: the 18e sentence "The summary lists them as not done." waits for 3.9, and the sheet reads "N steps not done. The K sets you ticked are kept."; the footer `Finish session` also asks first; a first-time select shows a disabled `Pick`; the weight cell label is `Set N weight`; under 390 px the set row narrows the set-number column and the padding, so `12.5 kg` and 2-digit reps fit at 320 px. Gates: `pnpm check:step` 2823 changed-file tests, 96.73 % lines; `pnpm e2e:step` plans, workouts and responsive, 82 of 82, then plans and responsive with the 320 px test, 80 of 80.
**Step 3.8b part 1 done** on 2026-10-20. `docs/design/prototype/index.html` only, no app code. Plates 18 (How to) and 18b (Muscles) now show the compact card: a full-bleed 16:9 image with `How to` and `Muscles` on it, the target and `Last time` as plain muted text, the muscle chips, `▶ Tutorial on YouTube`, a native weight `<select>` per equipment, and a 1-row header (back, title over a `Step 2 of 9 · 12:41 ▾` button, `Finish`). New plates: 18c the step list sheet, 18d the weight list, 18e the Finish confirm. Plate 17's watch pill reads `▶ Tutorial on YouTube` on its own line. The card is 363 px at 390 px, down from 509 px. The owner accepted the demo https://claude.ai/artifact/D4dbEj8jaio3vRVyCjeP5Z (version 3). Out of scope and still old: plate 19 shows only "skipped", and the 1440 laptop plate keeps the 4-button control; 3.9 owns both.
**Step 3.8 done** on 2026-10-20. `/workout` shows `PlanSession` when the session has `plan_ids`, else `LiveSession` unchanged. `PlanStepHeader`, `StepProgress`, `StepFrame` (Start, End, Play, Muscles; `next/image` with `unoptimized`), `PlanSetRows`, `StepFooter`; `AppShell` `mode="focus"` drops the bottom bar under 1024 px. Next, Back and Skip write the cursor first; Skip writes the step slug. Owner decisions: `lastSetsFor` counts finished, live sessions only, like `lastSetFor`, so the picker's Recent list leaves out the live session; `bodyweight` on the plan step from `equipment === 'body only'` (only `bench-dips`), a body-weight step shows a fixed `Body` cell and saves a null load; Skip is hidden on the last step; untick deletes with the undo toast; first-time reps fill `repsMin`. The first verify found a stale count in `workouts-offline.spec.ts` and a tap-target read during the page slide; `openPlanSession` now waits for the slide to end. The second verify: 4146 unit tests, 99.26 % lines, build, 717 of 724 e2e with 6 skipped; `offline.spec.ts:65` on WebKit failed once and passed 3 of 3 alone. The owner's device test raised the 3.8b feedback.
**Step 3.7 done** on 2026-10-20. `/workouts` shows `SuggestedPlanHero`, 4 `PlanCard`s (a `<button aria-pressed>`, a third tap drops the oldest), the coach's missed-day note, the free session under a `Free session` label, the history and `PlanStartBar`. `/workouts/[planId]` lists the steps with `WatchPill` links; `generateStaticParams` returns the 4 ids, an unknown id is a 404. Start checks for an active session and shows the Phase 2 resume prompt, else calls `startPlanSession` once with the ids in selection order, sets the cursor to step 0 and goes to `/workout`. `lib/plans` adds `planMuscles` and `findPlan`. `tests/e2e/workouts-offline.spec.ts` proves both routes offline after the first visit on desktop and Pixel 7; WebKit skips it. Owner decisions: Start a session and Resume are secondary, as in plate 16; a never-done hero reads "You have not done it yet"; the missed-day note uses the coach's words; a last set with no weight reads `body`; thumbnails are a plain `<img>` in `<picture>`, not `next/image`, since the images are local and precached; the preview Start bar sits above the tab bar. Plate 16 now suggests Legs.
**Step 3.6 done** on 2026-10-20. `lib/db/repository.ts`: `startPlanSession` shares `beginSession` with `startSession`; `getPlanCursor`, `setPlanCursor`, `clearPlanCursor` write `planCursors` only, no outbox; `lastSetFor`; `listPlanHistory`. `finishSession` and `discardSession` delete the cursor in their transaction; `clearAll` clears `planCursors`. The 4 sync-auditor notes from 3.3 are closed. `lib/sync/worker.ts` needed no change. Owner decisions: `toServerSession` sends `plan_ids` whenever it is non-null, at any status, and leaves the key out when it is null, so a local null never wipes the server and a refused start cannot lose the plan tag on the finish; the cursor writes refuse with `SignedOutOnThisDevice`; `lastSetFor` counts only finished, live sessions held on this device; `listPlanHistory` returns finished live plan sessions, newest first. The sync-auditor passed the final change.
**Checkpoint A passed** on 2026-10-20. The owner approved. The first full `pnpm verify` found the `/styleguide` "Coach step" select at 24 px in WebKit: a native select ignores `min-h-11`. The fix adds `appearance-none`, `pr-10` and a `StatIcon` chevron turned 90°. The second verify: 3903 unit tests, coverage 99.3 % lines, build, and 687 of 694 e2e pass with 5 skipped. 2 WebKit timeouts, `swim.spec.ts:3` and `workout-history.spec.ts:80`, each passed 3 of 3 alone. The step e2e runs the desktop project only, so a WebKit-only drift waits for the checkpoint.
**Step 3.4 done** on 2026-10-19. 52 WebP files in `public/exercises/`, 744 KB, from `docs/data/coach-images/` through `scripts/exercise-image.mjs`. The Serwist default glob precaches them: 122 URLs, 4.56 MB. **Licence:** the owner chose the coach images, source unknown, for personal use while the repository is private. Before the repository becomes public, switch to `docs/data/fedb-images/` or confirm the source. `offline-images.spec.ts` passes on desktop and Pixel 7. WebKit blocks service workers in Playwright, so the iPhone needs a device check.
**Step 3.5 done** on 2026-10-19. `lib/metrics/planSuggestion.ts` (`lastDoneByPlan`, `suggestPlan`) and `lib/metrics/planProgress.ts` (`stepStatuses`, `sessionSummary`). Owner decisions: a never-done plan is suggested first, then the plan done least recently; `cursor.skipped` holds step slugs; the cursor step is `now` even when skipped; the set count and the volume take every live set of the session.
**Step 3.4b done** on 2026-10-19. `components/plans/MuscleMap.tsx` (sizes `chip`, `card`, `frame`) and `MuscleTags.tsx`, drawn from `lib/design/body.ts`, which `scripts/coach-data.mjs` generates. Owner decisions: a helper chip has a dashed `border-dim` border, in the app and the prototype; the map label reads "Main: Chest. Helpers: Shoulders, Triceps."; frame figures cap at 88 px and the key is stacked; the JSON draws 22 regions, not 19. The spec `docs/specs/2026-09-24-coach-plans-design.md:241` still says 19. The plan was revised on 2026-10-17: `docs/specs/2026-09-24-coach-plans-design.md` sections 11 to 14, the accepted mockup https://claude.ai/artifact/FqAoJcGnmTCUEqQsTtNLa7, and the source data in `docs/data/`.
**Step 3.3 done** on 2026-10-19. 12 coach steps reuse a Phase 2 seed row: 8 exact names, and 4 aliases the owner chose (Flat Dumbbell Fly → Dumbbell Fly, Side Lateral Raise → Lateral Raise, One-Arm Dumbbell Row → Dumbbell Row, Shoulder Press → Dumbbell Shoulder Press). 14 new global rows. `workout_sessions.plan_ids text[]` refuses an empty list and an unknown id; null means no plan. Dexie version 6 adds `planCursors`. The rerun and bad-insert checks did not run on live: the auto mode check blocks a write through `execute_sql`.
**Fix track closed** on 2026-10-16. The owner passed the wave 12 checkpoint and the whole checklist in `docs/archive/04-feedback-fixes.md`, on the iPhone and the laptop, with the deferred A to F device checks and the B2 bar. Known limits from wave 3: an error at the same moment as a navigation can miss the log (deferred write, A3); the Errors card loop guard matches a text prefix; no plate for the edit set sheet or the chip fade. Each report's "Things to consider" has the rest.
**Branch:** `main`, since 2026-10-20 by owner decision. The Phase 3 branch is merged and deleted.
**Last commit:** `76639a3`, the merge into `main`. The fix track steps: `docs/archive/feedback/index.md`. Wave 3 reports: `reports/wave-3/`.

## Resume here

- Phase 0 to Phase 2 are closed. Their plans are in `docs/archive/`. Their settled
  decisions are in `docs/archive/PROGRESS-phase-0-2.md`. They still hold.
- The auth track has its own file: `docs/plan/auth/PROGRESS.md`. Phase B waits for a domain.
- Migrations `20260927142258_phase2_workouts`, `20260927151153_phase2_exercise_seed` and
  `20260928084529_phase2_set_policy_reps`, `20261008014222_feedback_goals_and_swim` and `20261019125214_phase3_coach_plans` are applied to the live project. Never apply them again.
- `pnpm types:db` needs `SUPABASE_PROJECT_ID` exported in the shell. Without it the script empties
  `lib/supabase/database.types.ts`. The MCP `generate_typescript_types` gives the same output.
- `apply_migration` records its own version. Rename the local file to the version that
  `list_migrations` shows.
- Run each step in a fresh subagent. PATH: `export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"`.
  `.nvmrc` pins `24.21.0`. It stages and stops. The owner runs the commit.
- A UI change puts screenshots in the report. See `.claude/rules/git.md`.
- Stop any `next dev` before `pnpm verify`. A shared `.next` breaks the build. After a branch
  change that deletes a route, delete `.next`: old route types fail `pnpm typecheck`.

## Settled, do not reopen

- **Phase 0 to Phase 2:** every line is in `docs/archive/PROGRESS-phase-0-2.md`.
- **Email and password, open registration.** `/sign-up` makes an account. The magic link,
  `/auth/callback` and `SITE_URL` are gone. Every decision: `docs/plan/auth/PROGRESS.md`.
- **Signed-in e2e tests use the test account** `E2E_EMAIL` in `.env.test.local` and CI secrets.
  A setup project signs in with the password and the anon key. No service-role key. From 1.16.
- **The recipe wins over the prototype**, unless the recipe is wrong for real use. From 1.15.

## Open, with the step that closes each one

- **Owner** — plate 16 has no `Free session` label above the free session button. The step requires it in the app. From 3.7.
- **Owner** — `PrimaryButton` and `SecondaryButton` use 16 px side padding; the prototype `.btn` uses 18 px. Every screen. From 3.7.
- **Owner** — a body-weight step takes no added load, so a weighted dip cannot be logged. From 3.8.
- **Owner** — the Muscles key shows "helper" in faint accent; the map draws helpers faint in their group colour. Plate and app agree. From 3.8.
- **Owner** — do not run `next dev` in the worktree while a `next start` or a verify uses `.next`. It overwrote the production manifest on 2026-10-20. From 3.8.

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
  dashboard showed the day with no gym time; it passed 5 of 5 alone. From 2.5b A. Again in the 2.10 verify; 3 of 3 alone. At Checkpoint A: `swim.spec.ts:3` and `workout-history.spec.ts:80` on WebKit timed out at 5 s; each passed 3 of 3 alone.
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
- **Owner** — the live Stats page puts 16 px (`mt-4`) above the cards; plates p5 and p11 show 12 px. Older than I1. The owner left it. From I1.
- **Owner** — `journey.spec.ts` and `openRoute` expect the default Stats layout on the shared e2e account. Never save a layout on it by hand. If those tests break, set its `profiles.stats_layout` back to `null`. From I1.
- **Owner** — the e2e suite has no browser check of the focus move after Edit and Done on `/analytics`; unit tests cover it. From I1.
- **Later step** — `/styleguide` has no `ResumePrompt` sample, and its live workout sample is a 2-column grid with no header,
  "Done so far" or laptop list, unlike `LiveSession`. The style guide is the bug. From 2.11.
- **Owner** — plate p3 shows the rest card with no Skip, +30 s or Change. "Last time" is `dim`, not `muted`, on p3 and the laptop
  plate, and sits after Add set there. Plate p8 says "Sat 20 Sep"; it is a Sunday. Correct the plates. From 2.11.
- **Later step** — `ImportConfirmSheet.tsx:103` puts its error at the end of the scrolling body, not above the buttons as p10b
  shows. `ResumePrompt.tsx:154` copies the `PrimaryButton` classes by hand. From 2.11.
- **Later step** — leaving `/log` through the tab bar drops unsaved edits with no question. A day change asks first (E4). A guard needs in-app navigation interception. From E4.

## Phases

- [x] Phase 0 — Foundation (11 steps) · `docs/archive/00-phase-0.md`
- [x] Phase 1 — Daily tracker (19 steps) · `docs/archive/phase-1/index.md`
- [x] Phase 2 — Workout log and import (23 steps) · `docs/archive/phase-2/index.md`
- [x] Auth track, phase A and M1 · `docs/archive/auth/`
- [ ] Phase 3 — Coach plans (14 steps) · `docs/plan/phase-3/index.md`
- [ ] Auth track, phase B · `docs/plan/auth/index.md`

## Rules that block you

1. One step at a time. Finish it, prove it, then update this file.
2. Never work on `main`. A hook blocks it. Use the branch named above.
3. In Phase 3 a step runs `pnpm check:step`, then `pnpm e2e:step <spec>` for the spec its step file names. The full `pnpm verify` runs at each checkpoint and before the merge.
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
