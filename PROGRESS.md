# Progress

**Start of every session:** read `CLAUDE.md`, then the step file named below, then do
that one step only. Stop and report when the step is done.

**Current phase:** 2 — Workout log and import · `docs/plan/02-phase-2.md`
**Step index:** `docs/plan/phase-2/index.md`
**Next step:** 2.2a → `docs/plan/phase-2/S2.2a-schemas-exercises.md`
**Branch:** `feat/phase-2-workout-log`, cut from `main` at `839ee97`.
**Last commit:** 2.1b, the global exercise seed, on top of `be9fc8c`.
Checkpoint 0 is ticked. The owner accepted plates p7 to p11 on 2026-09-27.

## Resume here

- Stopped on 2026-09-27 after 2.1b. The report is `reports/2026-09-27-global-exercise-seed.html`.
- Migrations `20260927142258_phase2_workouts` and `20260927151153_phase2_exercise_seed` are
  applied to the live project. Never apply them again.
- `apply_migration` records its own version. Rename the local file to the version that
  `list_migrations` shows.
- Run each step in a fresh subagent on Node 24. It stages and stops. The owner runs the commit.
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

## Open, with the step that closes each one

- **Owner** — add four CI secrets: `E2E_EMAIL`, `E2E_PASSWORD`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. From 1.16.
- **Owner** — the prototype sync card lacks the failed-writes rows. From 1.13b.
- **Owner** — `/log` shows its chip only when offline. The recipe wants `SyncChip`. From 1.15.
- **Owner** — `/log` takes weight in kg only. The imperial setting is display only elsewhere.
  From 1.13.
- **2.4a** — the live workout plate has no current Workouts tab. From 2.0.
- **2.9b** — import review has no plate at 1024 px and up. From 2.0.
- **2.2a** — `MuscleGroup` and `WorkoutSessionStatus` live in `lib/db/dexie.ts` for now. The zod
  schema must own them, and `dexie.ts` imports them. From 2.1a.
- **2.2a / 2.5** — the Dexie `Profile` lacks `rest_sound_muted` and `rest_seconds_by_exercise`.
  Existing device rows need defaults. From 2.1a.
- **2.2c** — decide what `Exercise.user_id` holds on the device: the session id,
  `LOCAL_PROFILE_ID` or a flag. From 2.1a.
- **2.2c** — the `workout_sets` policies do not check that `exercise_id` is the user's own or a
  global row. Only the foreign key applies. Needs a new migration if closed. From 2.1a.
- **Owner** — `get_advisors` warns that leaked password protection is off. An Auth setting. From 2.1a.
- **2.3b** — no unique index on global exercise names. Only the seed adds global rows. The owner
  deferred it. From 2.1b.

## Phases

- [x] Phase 0 — Foundation (11 steps) · `docs/plan/00-phase-0.md`
- [x] Phase 1 — Daily tracker (19 steps) · `docs/plan/phase-1/index.md`
- [ ] Phase 2 — Workout log and import (21 steps) · `docs/plan/phase-2/index.md`
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
