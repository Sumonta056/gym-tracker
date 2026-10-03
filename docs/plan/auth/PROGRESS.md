# Auth track — progress

**Start of every session:** run `/resume-auth`. It reads this file, then the step file named below.

**Worktree:** `/Users/cefalo_1/Documents/Projects/gym-tracker-auth`
**Branch:** `feat/email-registration`, cut from `feat/phase-2-workout-log` at `c9ffdc0`.
**Next step:** A1, the sign-up schema and server action → `docs/plan/auth/A1-sign-up-action.md`
**Last commit:** A0, `docs(design): add the sign-up and verify plates`.
**Phase 2 branch last seen at:** `c9ffdc0`. M1 merges from its tip.

## Resume here

- 2026-10-02: worktree made, `.env.local` and `.env.test.local` copied, `pnpm install` done.
- 2026-10-03: A0 done. Plates p0, p0b and p0c approved by the owner. Plan docs in git.
- PATH: `export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"`. Node 20 breaks jsdom tests.
- Before any e2e run, port 3100 must be free. See index rule 3.

## Settled, do not reopen

- Open registration, multi-user. Magic link removed. Fields: name, email, password 8+.
- Native Supabase `signUp`, `verifyOtp`, `resend`. Resend as SMTP. Phase A, then phase B.
- Separate worktree and branch. Merge into `feat/phase-2-workout-log` at M1.
- A0: plates p0 (sign-in, no magic link, "Create an account" link), p0b `/sign-up`, p0c `/verify` are the contract.
- A0: A2 widens `Field`'s `error` to a `ReactNode`, so the p0b error can hold the "Sign in instead" link.
- A0: `/verify` shows the heading "Check your email", not "Gym Tracker". B2 gives the auth header a title setting.
- A0: the prototype "Thirteen plates" text and its 390 px sideways scroll wait for M1.

## Open, with the step that closes each one

- **Owner** — does a production deploy exist? Decide before "Allow new users to sign up" goes on. Before Checkpoint A.
- **Owner** — a domain for Resend. Before B0.

## Dashboard state

| Setting                          | Now |
| -------------------------------- | --- |
| Allow new users to sign up       | off |
| Custom SMTP (Resend)             | off |
| Confirm email                    | off |
| "Confirm signup" template = code | no  |

## Steps

- [x] A0 · [ ] A1 · [ ] A2 · [ ] A3 · [ ] Checkpoint A
- [ ] B0 · [ ] B1 · [ ] B2 · [ ] Checkpoint B
- [ ] M1

## How to update this file

After a step: change **Next step** and **Last commit**, tick the step, add a line under
"Settled" for each decision the step made, and update the dashboard table when it changed.
