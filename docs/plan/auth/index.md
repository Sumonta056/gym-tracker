# Auth track — step index

**Design:** `docs/specs/2026-10-02-email-registration-design.md` is the source of truth.
**Progress:** `docs/plan/auth/PROGRESS.md`. Not the root `PROGRESS.md`.
**Command:** `/resume-auth` runs the next step.

**Branch:** phase A and M1 are merged. Phase B starts on a new branch from `main`.
**Worktree:** none. Removed in M1. Phase B runs in the main folder.
**Done steps:** A0 to A3 and M1 live in `docs/plan/archive/auth/`.

One step is one session. Never do two steps in one session.

## Rules that kept Phase 2 unblocked

These rules applied while the worktree existed. Rules 3 and 4 still apply to any second folder.

1. **Work only in the worktree.** Never `cd` into `/Users/cefalo_1/Documents/Projects/gym-tracker`
   and never check out another branch there.
2. **Never edit the root `PROGRESS.md`, `CLAUDE.md` or `docs/plan/archive/phase-2/**`.** Step M1 changes
   them once, at merge time.
3. **One e2e run at a time across both folders.** Playwright uses port 3100 with
   `reuseExistingServer` (`playwright.config.ts:11`, `:53`). A server from the other folder on that
   port makes this folder's tests run against the other branch, and they still pass. Before
   `pnpm verify` or `pnpm e2e`, run:
   ```
   lsof -nP -iTCP:3100 -sTCP:LISTEN
   ```
   Any output: stop, and ask the owner. Never kill a process that this session did not start.
4. **Both folders share the live Supabase project and the `E2E_EMAIL` account.** The e2e cleanup
   deletes that account's test rows, so rule 3 also protects the data. No e2e test in this track
   creates a real user.
5. **Shared files.** Only these files are edited in both tracks. Keep each change in its own block,
   so the merge is by hand and small:
   - `docs/design/prototype/index.html` — add auth plates in one new section. Delete only the
     magic link plate.
   - `tests/e2e/responsive.spec.ts` — add the 2 routes to the route list. Change nothing else.
   - `middleware.ts` and `middleware.test.ts` — Phase 2 does not plan to touch them.
6. **The dashboard follows the schedule below.** Never change a Supabase Auth setting in a step
   that does not name it.
7. **Stage and stop.** A step subagent never commits, never pushes, never runs the
   `commit-report` skill. The owner runs the commit. The commit gate and `pnpm verify` apply as
   on any branch.

## The steps

| Step | File                      | Title                                         | Size | Depends on   | Commit               | State  |
| ---- | ------------------------- | --------------------------------------------- | ---- | ------------ | -------------------- | ------ |
| A0   | `A0-design-contract.md`   | Plan docs and the sign-up and verify plates   | S    | —            | `docs(design)`       | done   |
| A1   | `A1-sign-up-action.md`    | The sign-up schema and server action          | S    | A0           | `feat(auth)`         | done   |
| A2   | `A2-sign-up-screen.md`    | `/sign-up`, the middleware, the sign-in link  | M    | A1           | `feat(auth)`         | done   |
| A3   | `A3-remove-magic-link.md` | Remove the magic link and the callback        | S    | A2           | `refactor(auth)`     | done   |
| B0   | `B0-resend-setup.md`      | Resend as SMTP — the owner, no code           | S    | Checkpoint A | none                 | paused |
| B1   | `B1-code-actions.md`      | Verify, resend and the unverified sign-in     | S    | A3, B0       | `feat(auth)`         | —      |
| B2   | `B2-verify-screen.md`     | `/verify` and the routes into it              | M    | B1           | `feat(auth)`         | —      |
| M1   | `M1-merge.md`             | Merge into Phase 2, docs, remove the worktree | S    | Checkpoint B | `docs(docs)` + merge | done   |

## Checkpoints

### Checkpoint A — after A3

The owner, on a laptop and on the iPhone at 390 px:

- [x] Registers a new account at `/sign-up`, lands on Today, the Today header shows the name's initial with no reload.
- [x] Signs out, signs in with the same email and password.
- [x] Sees no magic link anywhere.
- [x] Deletes the test accounts in the Supabase dashboard.

### Checkpoint B — after B2

- [ ] Registers in the installed iPhone app. The code arrives by Resend within 1 minute.
- [ ] Types the code in the installed app, not in Safari. Lands on Today.
- [ ] A wrong code shows the error. "Send a new code" waits 60 s.
- [ ] Sign-in with an unconfirmed email opens `/verify` and sends a code.
- [ ] Registering an existing email shows "Check your email" and sends nothing.

## The dashboard schedule

The Supabase project is live and shared by both tracks. These switches act at once.

| When                                                                                                       | Setting                                                                                                      | Who   |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----- |
| Before Checkpoint A                                                                                        | Authentication → Sign In / Providers → "Allow new users to sign up": **on**                                  | owner |
| B0                                                                                                         | SMTP settings: Resend. Email template "Confirm signup": the code template. Rate limit for emails: 30 an hour | owner |
| Right after B2 is merged into the branch that is deployed, or before Checkpoint B when nothing is deployed | Email provider → "Confirm email": **on**                                                                     | owner |
| Never before B2 ships                                                                                      | "Confirm email" on. With it on and no `/verify`, sign-up gives no session and no screen for the code.        | —     |

Before "Allow new users to sign up" goes on, check whether a production deploy exists. When one
exists, anyone can register there from that moment, with no verification. The owner decides.

## Order

A0 → A1 → A2 → A3 → Checkpoint A → B0 → B1 → B2 → Checkpoint B → M1.

B0 is the owner's work and can run at any time before B1. When Phase 2 reaches step 2.11 before
this track reaches Checkpoint B, M1 may run after Checkpoint A with phase A only. Phase B then
continues on a new branch from the merged result.
