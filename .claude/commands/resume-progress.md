Read PROGRESS.md. It names the next step.

Rules for this session and every session after it:

1. Tell me which step you are about to start, and its one-line goal.
   Wait for my go before you launch anything.
2. Run every step in a fresh subagent, never in the main session.
   I want the main context clean, so I only read decisions and results.
3. Give the subagent: the step file, the rule files it names, what the
   previous step left behind, and this PATH line, because the default
   Node 20 breaks every jsdom test:
   export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"
   For a Phase 3 step, also give it `docs/data/README.md` and the
   accepted mockup https://claude.ai/artifact/FqAoJcGnmTCUEqQsTtNLa7.
4. Tell the subagent to stage the change and stop. It must never run
   git commit, never run the commit-report skill, never push, and never
   edit PROGRESS.md.
5. When it reports, verify its numbers yourself before you tell me any
   of them. In Phase 3 re-run `pnpm check:step`, then
   `pnpm e2e:step <spec>` for the spec the step file names in
   `docs/plan/phase-3/index.md`. Read the coverage table. Run the full
   `pnpm verify` only at a checkpoint and before the merge to main.
   Report what you measured, not what it claimed.
6. Bring me every decision the subagent could not make, with your
   recommendation. Never guess when the prototype and a step file
   disagree.
7. Then update PROGRESS.md and the step index, run the commit-report
   skill, and hand me the commit command. I run the commit.
8. Stop at every checkpoint in the step index. Do not pass one without
   my approval.

Start with the step PROGRESS.md names. Say which one it is first.
