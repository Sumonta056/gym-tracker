# Progress

**Start of every session:** read `CLAUDE.md`, then the step file named below, then do
that one step only. Stop and report when the step is done.

**Current phase:** 1 — Daily tracker · `docs/plan/01-phase-1.md`
**Step index:** `docs/plan/phase-1/index.md`
**Next step:** 1.16b → `docs/plan/phase-1/S1.16b-*.md`
**Branch:** `feat/phase-1-daily-tracker`
**Last commit:** the 1.16 end-to-end suite, on top of `b8e6b91`.
Checkpoints A, B and C are ticked. The iPhone half of A is open until step 1.17.

## Resume here

- Stopped on 2026-09-25 after 1.16. Start 1.16b in a new session.
- The report is `reports/2026-09-25-e2e-journey-suite.html`.
- Left in Phase 1: 1.16b, 1.17. The next stop is Checkpoint D,
  after 1.17. It needs a real iPhone and a Vercel account.
- Run each step in a fresh subagent. It stages and stops. The owner runs the commit.
- A UI change puts screenshots in the report. See `.claude/rules/git.md`.
- Stop any `next dev` before `pnpm verify`. A shared `.next` breaks the build.

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
- **Motion lives in `components/motion/`.** Chart labels fade in on every chart, bars too.
  The durations are in the design-system skill's Motion section. From 1.14.
- **The recipe wins over the prototype**, unless the recipe is wrong for real use.
  `NumberField` keeps `decimal`. The `/log` two-column form and the Phase 1 tab bar are
  named exceptions in `responsive.md`. A bar chart's goal label sits inside the plot. From 1.15.
- **Signed-in e2e tests use the test account** `E2E_EMAIL` in `.env.test.local` and CI secrets.
  A setup project signs in with the password and the anon key. No service-role key. From 1.16.

## Open, with the step that closes each one

- **1.17** — WebKit in Playwright cannot boot offline from the service worker, so test 6
  proves only the IndexedDB write there. The real iPhone proves the offline boot. From 1.16.
- **Owner** — add four CI secrets: `E2E_EMAIL`, `E2E_PASSWORD`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. From 1.16.
- **1.16b** — `clearAll` waits on `DRAIN_LOCK` with no timeout. The dead-letter cap resets
  each turn. A save in another tab after the clear, before sign-out ends, stays. From 1.13b.
- **1.16b** — a re-sign-in within 15 s of a sign-out waits for its first sync. With no Web
  Locks and a blocked `localStorage`, another tab can refill the device. From 1.13b.
- **Owner** — the prototype sync card lacks the failed-writes rows. From 1.13b.
- **Owner** — `/log` shows its chip only when offline. The recipe wants `SyncChip`. From 1.15.
- **Owner** — `/log` takes weight in kg only. The imperial setting is display only elsewhere.
  From 1.13.

## Phases

- [x] Phase 0 — Foundation (11 steps) · `docs/plan/00-phase-0.md`
- [ ] Phase 1 — Daily tracker (19 steps, 17 done) · `docs/plan/phase-1/index.md`
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
