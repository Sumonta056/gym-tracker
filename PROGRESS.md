# Progress

**Start of every session:** read `CLAUDE.md`, then the step file named below, then do
that one step only. Stop and report when the step is done.

**Current phase:** 2 — Workout log and import · `docs/plan/02-phase-2.md`
**Step index:** `docs/plan/phase-2/index.md`
**Next step:** 2.3a → `docs/plan/phase-2/S2.3a-exercise-picker.md`
**Branch:** `feat/phase-2-workout-log`, cut from `main` at `839ee97`.
**Last commit:** 2.7b, the muscle balance, gap and calorie rate metrics, on top of `0e89536`.
Checkpoint 0 is ticked. The owner accepted plates p7 to p11 on 2026-09-27.

## Resume here

- Stopped on 2026-09-28 after 2.7b. The report is `reports/2026-09-28-week-metrics.html`.
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

## Open, with the step that closes each one

- **Owner** — add four CI secrets: `E2E_EMAIL`, `E2E_PASSWORD`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. From 1.16.
- **Owner** — the prototype sync card lacks the failed-writes rows. From 1.13b.
- **Owner** — `/log` shows its chip only when offline. The recipe wants `SyncChip`. From 1.15.
- **Owner** — `/log` takes weight in kg only. The imperial setting is display only elsewhere.
  From 1.13.
- **2.4a** — the live workout plate has no current Workouts tab. From 2.0.
- **2.9b** — import review has no plate at 1024 px and up. From 2.0.
- **Owner** — `lastSetFor` reads every set, because `workoutSets` has no `exercise_id` index.
  An index needs Dexie version 4. Acceptable for one user. From 2.2b.
- **2.3a** — `listExercises` hides archived rows. Add `includeArchived` so a screen can restore
  one. From 2.2a.
- **Owner** — `deadLetters.ts` at 93.1 % lines once passed `pnpm verify` in a subagent run. Check
  that the `lib/sync/**` floor in `vitest.config` fails a single file. From 2.2a.
- **2.4a** — the manual browser check: log a session offline, reload, go online, see the rows in
  Supabase. No screen writes a set before `/workout`. Checkpoint A passes without it. From 2.2d.
- **Owner** — `reps ?? MIN_REPS` in `lib/sync/mappings.ts` stays until the generated Supabase types
  say `reps: number`. Remove it with the type change. From 2.2d.
- **2.4b** — `isNewRecord` compares with every set in `history`, later sets too. An edit of an old
  set must pass only the earlier sets, or a later heavier set hides the badge. From 2.7a.
- **2.4a** — discarding a refused session in the sync card also discards its held sets. Today
  the sets are released and fail again. From 2.2c.
- **2.4a** — after an active session conflict, a pull can bring a second active session onto this
  device. The live screen must choose one. From 2.2c.
- **Owner** — the cleanup of out-of-date dead letters covers sessions and exercises only. The
  same rule fits daily entries and profiles. From 2.2c.
- **Owner** — the e2e suite fails 1 to 6 tests on some runs: WebKit timeouts and `fetch failed`
  in the Supabase cleanup helper. Each passes on rerun. From 2.2c.
- **Owner** — `get_advisors` warns that leaked password protection is off. An Auth setting. From 2.1a.
- **2.8b** — pass `sessionGaps` every daily row date, not only rows with gym time. The 1, 3, 3,
  3, 1 target needs 9 September. From 2.7b.
- **2.3b** — no unique index on global exercise names. Only the seed adds global rows. The owner
  deferred it. From 2.1b.

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
