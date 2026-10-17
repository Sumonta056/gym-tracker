# Step M1 — Merge into Phase 2, docs, remove the worktree

**Branch:** `feat/email-registration` then `feat/phase-2-workout-log` · **Size:** S
**Depends on:** Checkpoint B (or Checkpoint A, see `index.md`, "Order") · **Commit:** `docs(docs)` + a merge

The merge touches the Phase 2 branch. Every git command in this step needs the owner's go in that
turn. The main session runs this step itself, not a subagent, because it needs the owner at each gate.

## Context to read first

1. `docs/plan/auth/PROGRESS.md` — every "Settled" line.
2. Root `PROGRESS.md`, `CLAUDE.md`, `docs/specs/2026-09-20-gym-tracker-design.md` :30, :97, :251.
3. `.claude/rules/architecture.md` — "The last push wins".

## Goal

The Phase 2 branch holds the auth work, all docs say "multi-user", and the worktree is gone.

## Do

1. **Ask the owner** that the Phase 2 folder has no uncommitted work and no running server.
2. **Bring Phase 2 into this branch first,** in the worktree, so conflicts are solved here and the
   Phase 2 branch only fast-forwards:
   `git merge feat/phase-2-workout-log`. Expected conflicts: the prototype, `responsive.spec.ts`.
   Keep both sides. Re-run `pnpm design:check` on the prototype.
   After the merge, fix 2 prototype items that A0 left on purpose: the header text "Thirteen
   plates" (`index.html:1177`) gets the real count, and the page scrolls sideways at 390 px
   (each plate is 390 px plus a 20 px gutter).
3. **Docs, one commit `docs(docs)`:**
   - `CLAUDE.md:3` — "One user" becomes "Open registration. Each account sees only its own rows."
   - Spec :30 "Users", :97 "safe because there is one user" → "one user per account", :251 `/sign-in`
     → "Email and password. `/sign-up` and `/verify` make an account."
   - `.claude/rules/architecture.md` "The last push wins" — "This app has one user" → "one person per account".
   - Root `PROGRESS.md`: replace the "Password sign-in is the default" and "The magic link" lines in
     "Settled" with one line that points at `docs/plan/auth/PROGRESS.md`. Remove the open item
     "Owner, at deploy — SITE_URL…". Keep the file's 3 head lines as Phase 2 left them.
4. `pnpm verify` in the worktree (port 3100 free first). Commit report, owner commits.
5. **Fast-forward the Phase 2 branch,** in the main folder, with the owner's go:
   `git -C /Users/cefalo_1/Documents/Projects/gym-tracker merge --ff-only feat/email-registration`.
   If it is not a fast-forward, Phase 2 moved again: repeat from step 2.
6. `pnpm verify` in the main folder.
7. **Remove the worktree,** with the owner's go:
   `git worktree remove /Users/cefalo_1/Documents/Projects/gym-tracker-auth`, then
   `git branch -d feat/email-registration`.

## Acceptance criteria

- [ ] `feat/phase-2-workout-log` contains every auth commit, and its `pnpm verify` passes.
- [ ] `grep -rn "One user\|one user" CLAUDE.md docs/specs .claude/rules` finds only intended text.
- [ ] Root `PROGRESS.md` "Next step" line is unchanged by this track.
- [ ] `git worktree list` shows one folder.

## Not in this step

Push and a pull request. The owner asks for them separately.
