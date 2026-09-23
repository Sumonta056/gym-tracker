# Progress

**Start of every session:** read `CLAUDE.md`, then the step file named below, then do
that one step only. Stop and report when the step is done.

**Current phase:** 1 — Daily tracker · `docs/plan/01-phase-1.md`
**Step index:** `docs/plan/phase-1/index.md`
**Next step:** 1.13b → `docs/plan/phase-1/S1.13b-*.md`
**Branch:** `feat/phase-1-daily-tracker`
**Last commit:** `56888e4`, the analytics charts. The 1.13 profile commits on top of it.
Checkpoints A, B and C are ticked. The iPhone half of A is open until step 1.17.

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

## Open, with the step that closes each one

- **1.13b** — a dead-letter table, a second-tab lock, a `haltSync` timeout and the
  sign-out backoff. The step file is written. From 1.7 and 1.13.
- **1.16** — no signed-in Playwright fixture, so `/log` offline is untested. From 1.9.
- **1.15** — `StatusChip` frame and `SecondaryButton` size drift from their recipes. From 1.13.
- **Owner** — `/log` takes weight in kg only. The imperial setting is display only elsewhere.
  From 1.13.
- **1.16** — `/`, `/log` and `/analytics` are proven at three widths only through
  `/styleguide` samples. The signed-in fixture proves the live routes. From 1.12.

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
