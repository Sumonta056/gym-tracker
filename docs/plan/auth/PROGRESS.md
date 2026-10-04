# Auth track — progress

**Start of every session:** run `/resume-auth`. It reads this file, then the step file named below.

**Worktree:** `/Users/cefalo_1/Documents/Projects/gym-tracker-auth`
**Branch:** `feat/email-registration`, cut from `feat/phase-2-workout-log` at `c9ffdc0`.
**Next step:** M1, phase A only. Merge into Phase 2 → `docs/plan/auth/M1-merge.md`. Phase B waits for a domain.
**Last commit:** `fix(ui): refresh today when the profile arrives from a pull`.
**Phase 2 branch last seen at:** `37baf7f`. M1 merges from its tip.

## Resume here

- 2026-10-02: worktree made, `.env.local` and `.env.test.local` copied, `pnpm install` done.
- 2026-10-03: A0 done. Plates p0, p0b and p0c approved by the owner. Plan docs in git.
- 2026-10-03: A1 done. `signUpSchema` in `lib/schema/signUp.ts`, `signUp` in `lib/auth/actions.ts`. Verify passed.
- 2026-10-04: A2 done. `/sign-up`, `AuthHeader`, the middleware and the sign-in link. Verify passed. Manual registration skipped: the dashboard sign-up switch is off.
- 2026-10-04: A3 done. Magic link, `/auth/callback`, `lib/auth/session.ts` and `SITE_URL` removed. Verify passed on the second run.
- 2026-10-04: `fix(ui)` Today reads the profile live. Checkpoint A passed, ticked by the owner.
- 2026-10-04: B0 paused at step 1, no domain. Phase B paused. Next is M1 with phase A only.
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
- A1: `signUp` maps `user_already_exists` to `exists`, `weak_password` to the 8-character message,
  `over_request_rate_limit` and `over_email_send_rate_limit` to the rate limit message. Every other code is generic.
- A1: `email_exists` is not mapped. The spec names only `user_already_exists`. B1 decides again.
- A1: the password limit counts 72 characters, not 72 bytes. A multi-byte password over 72 bytes gets the generic error.
- A1: the Supabase docs (MCP `search_docs`) and `@supabase/auth-js@2.116.0` replaced Context7 as the source for the codes.
- A1: `needs-code` is in `SignUpResult` now, so the union keeps its shape for B1.
- A2: the sign-in header moved to `app/(auth)/AuthHeader.tsx`. Both forms use it.
- A2: `EmailField` and `PasswordField` widen `error` to a `ReactNode`, to match `Field`.
- A2: a server error shows as a centred danger line above "Create account". p0b has no such state. Add it in the M1 prototype pass.
- A2: `needs-code` sends the user to `/verify?email=`. Until B2, the middleware sends that visit to `/sign-in`.
- A2: the axe check for `/sign-up` is in `auth.spec.ts`. M1 adds `/sign-up` to `a11y.spec.ts`.
- A2: no `/styleguide` entry for `/sign-up`, the same as `/sign-in`.
- A2: `/sign-up` first load is 219 kB against 124 kB for `/sign-in`, because zod ships with `signUpSchema`. Accepted.
- A3: `/auth/callback` is not public. Anonymous goes to `/sign-in`, signed in gets 404. Unit and e2e tests prove both.
- A3: `SITE_URL` removed from `.env.example`. `siteOrigin` was its only reader. A local `.env.local` may still hold it; harmless.
- A3: `page.test.tsx` for sign-in changed too. It mocked `sendMagicLink`.
- A3: sign-in at 390 px checked against p0 by structure and by the report screenshots.
- A3: the e2e fixture cleanup can fail with "JWT issued at future" (`tests/e2e/support/account.ts:275`). Clock skew with the live project, not auth code. A `fix(test)` outside this track.
- Checkpoint A: "Confirm email" was on in the dashboard. Sign-up sent the default link and `needs-code`. The owner turned it off on 2026-10-04.
- Checkpoint A: the name shows only as the initial in the Today header. Profile shows the email, no name. Checkpoint text changed to match. A name on Profile needs a plate first.
- Checkpoint A: Today did not re-render after the first pull wrote the profile. Fixed in a `fix(ui)` commit before the checkpoint.
- Checkpoint A: a sign-in by an unconfirmed user shows "That email and password do not match." B1 maps `email_not_confirmed` to `/verify`.
- M1: drop "the magic link" from `.claude/rules/architecture.md:15`. Drop the magic link, `SITE_URL` and `/auth/callback` lines from root `PROGRESS.md`.
- A2: `supabase/config.toml` sets `enable_signup = true` at :175 and :220. `enable_confirmations` stays false. Local stack only.
- B0: a production deploy exists at `gym-tracker-ten-gamma.vercel.app`. "Allow new users to sign up" stays on. Anyone can register there with no email check. The owner accepts that risk.
- B0: paused at step 1 on 2026-10-04. No domain yet. M1 runs with phase A only, as `index.md` "Order" allows. B0, B1, B2 and Checkpoint B continue later on a new branch from the merged result.
- M1: spec :251 must not name `/verify` yet. Phase A ships `/sign-up` only.
- B0: Resend refuses `*.vercel.app`. The owner buys a domain. The sender is a subdomain, `mail.<domain>`.
- B0: the first Resend API key was pasted in a chat. The owner revokes it. The real key is made in step 3 and goes only into the Supabase SMTP password.

## Open, with the step that closes each one

- **Owner** — remove the `/auth/callback` Redirect URLs from the Supabase dashboard. Dead since A3. Any time.
- **Owner** — buy a domain for Resend. Phase B waits until Resend accepts it.
- **Owner** — revoke the Resend API key that was pasted in the chat.

## Dashboard state

| Setting                          | Now |
| -------------------------------- | --- |
| Allow new users to sign up       | on  |
| Custom SMTP (Resend)             | off |
| Confirm email                    | off |
| "Confirm signup" template = code | no  |

## Steps

- [x] A0 · [x] A1 · [x] A2 · [x] A3 · [x] Checkpoint A
- [ ] B0 · [ ] B1 · [ ] B2 · [ ] Checkpoint B
- [ ] M1

## How to update this file

After a step: change **Next step** and **Last commit**, tick the step, add a line under
"Settled" for each decision the step made, and update the dashboard table when it changed.
