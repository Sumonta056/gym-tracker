# Progress

**Start of every session:** read `CLAUDE.md`, then the current phase file below,
then do the next step only. Stop and report when the step is done.

**Current phase:** 0 — Foundation → `docs/plan/00-phase-0.md`
**Next step:** 0.11 Phase 0 verification
**Branch:** `main`. The user chose to work on `main` for Phase 0.
**Last commit:** `cfadaae`, steps 0.6 and 0.7. Steps 0.8, 0.9 and 0.10 are done but
not yet committed. Reports live in `reports/`.

## Phases

- [ ] Phase 0 — Foundation (11 steps) · `docs/plan/00-phase-0.md`
- [ ] Phase 1 — Daily tracker (17 steps) · `docs/plan/01-phase-1.md`
- [ ] Phase 2 — Workout log and import (11 steps) · `docs/plan/02-phase-2.md`

## Rules that block you

1. One step at a time. Finish it, prove it, then update this file.
2. Never work on `main`. A hook blocks it. Use a feature branch.
3. `pnpm verify` must pass before a step is done.
4. Load the `design-system` skill before touching `app/` or `components/`.
   Until Phase 0 step 0.9 builds it, use the design rules in `CLAUDE.md`.
5. Write the tests first for `lib/duration.ts`, `lib/sync/**` and `lib/metrics/**`.
6. No commit without a report. Run the `commit-report` skill. A hook blocks you.
   Until Phase 0 step 0.8 builds it, write the report by hand into `reports/`.
7. Conventional commit messages only. Scopes live in `commitlint.config.mjs`.
8. Never start Phase 2 before every Phase 1 checklist item passes.

### Use sub-agents

When you start a phase, inside there are sub-steps. Run substep in subagents to keep main session clean and proper context.

## How to update this file

Change four lines only: **Current phase**, **Next step**, **Branch**, **Last commit**.
Tick a phase box when its checklist passes. Keep this file under 40 lines.
