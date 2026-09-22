# Progress

**Start of every session:** read `CLAUDE.md`, then the step file named below, then do
that one step only. Stop and report when the step is done.

**Current phase:** 1 — Daily tracker · `docs/plan/01-phase-1.md`
**Step index:** `docs/plan/phase-1/index.md`
**Next step:** 1.8 → `docs/plan/phase-1/S1.8-*.md`
**Branch:** `feat/phase-1-daily-tracker`
**Last commit:** the outbox drain, the pull cursor and the status hook. Checkpoint A
passed on a laptop. The iPhone half is open until step 1.17.

**Open from 1.7, for the owner:** the drain still stops at the first failure, with no
attempt ceiling. One unresolvable server error on one row holds back every other row.
A per-row dead letter would keep the ordering rule and remove that. Decide before 1.13.

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
