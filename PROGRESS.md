# Progress

**Start of every session:** read `CLAUDE.md`, then the step file named below, then do
that one step only. Stop and report when the step is done.

**Current phase:** 1 — Daily tracker · `docs/plan/01-phase-1.md`
**Step index:** `docs/plan/phase-1/index.md`
**Next step:** 1.11 → `docs/plan/phase-1/S1.11-*.md`
**Branch:** `feat/phase-1-daily-tracker`
**Last commit:** `45f09ec`, the daily log form. Checkpoints A and B are ticked. The
iPhone half of A is open until step 1.17.

## Settled, do not reopen

- **Zones are modelled, not measured.** Floors 0.6, 0.7, 0.85 of the session's own peak.
  A true `220 − age` needs a migration. The bar is indicative, never clinical. From 1.10.
- **The zone bar has four segments**, warm included. The prototype is corrected. From 1.10.

## Open, with the step that closes each one

- **1.13** — the drain stops at the first failure, with no ceiling. Dead letter? From 1.7.
- **1.13** — the chip reads `navigator.onLine`; rule 1 blocks `lib/sync/**`. From 1.9.
- **1.16** — no signed-in Playwright fixture, so `/log` offline is untested. From 1.9.
- **1.12, 1.13** — `/analytics` and `/profile` are in the tab bar with no route.

## Phases

- [x] Phase 0 — Foundation (11 steps) · `docs/plan/00-phase-0.md`
- [ ] Phase 1 — Daily tracker (17 steps) · `docs/plan/phase-1/index.md`
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
