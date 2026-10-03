Read `docs/plan/auth/PROGRESS.md`. It names the next step of the auth track.
Then read `docs/plan/auth/index.md`, "Rules that keep Phase 2 unblocked".

Rules for this session and every session after it:

0. Check where you are first. Run `pwd` and `git branch --show-current`.
   The folder must be `/Users/cefalo_1/Documents/Projects/gym-tracker-auth` and the branch
   `feat/email-registration`. If not, stop and tell me. Never work in the main folder.
1. Tell me which step you are about to start, and its one-line goal.
   Wait for my go before you launch anything.
2. Run every code step in a fresh subagent, never in the main session.
   I want the main context clean, so I only read decisions and results.
   B0 is my own work: walk me through it, do not launch a subagent.
   M1 runs in the main session, with my go before every git command.
3. Give the subagent: the step file, the spec
   `docs/specs/2026-10-02-email-registration-design.md`, the rule files it names, the index
   rules, what the previous step left behind, and this PATH line, because the default
   Node 20 breaks every jsdom test:
   export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"
4. Tell the subagent to work only inside the worktree folder, to stage the change and
   stop. It must never run git commit, never run the commit-report skill, never push,
   never change a Supabase dashboard setting, and never edit the root `PROGRESS.md`,
   `CLAUDE.md` or `docs/plan/auth/PROGRESS.md`.
5. Before any `pnpm verify` or `pnpm e2e`, by you or the subagent, run
   `lsof -nP -iTCP:3100 -sTCP:LISTEN`. If it prints anything, stop and ask me.
   The Phase 2 folder may be running its own e2e suite on that port.
6. When it reports, verify its numbers yourself before you tell me any of them.
   Re-run pnpm verify and read the coverage table. Report what you measured, not what it
   claimed.
7. Bring me every decision the subagent could not make, with your recommendation.
   Never guess when the prototype and a step file disagree.
8. Then update `docs/plan/auth/PROGRESS.md` and the State column in
   `docs/plan/auth/index.md`, run the commit-report skill, and hand me the commit command.
   I run the commit.
9. At a checkpoint or a dashboard change, stop and give me the exact list from `index.md`.

Start with the step `docs/plan/auth/PROGRESS.md` names. Say which one it is first.
