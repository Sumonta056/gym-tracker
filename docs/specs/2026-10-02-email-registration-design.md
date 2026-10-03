# Email registration — design

**Date:** 2026-10-02 · **Branch:** `feat/email-registration` · **Worktree:** `../gym-tracker-auth`
**Plan:** `docs/plan/auth/index.md` · **Progress:** `docs/plan/auth/PROGRESS.md`

## 1. Why

- The app has no way to make an account. The owner makes it by hand in the Supabase
  dashboard (root `PROGRESS.md`, "Password sign-in is the default").
- The magic link is not reliable, for 2 reasons:
  1. The built-in Supabase sender sends about 2 emails an hour, and only to addresses on
     the project team.
  2. On iOS the installed home-screen app has its own cookie store. A link in an email
     opens Safari. The session lands in Safari, and the installed app stays signed out.
- The owner wants a registration form with name, email and password, then a 6-digit code
  sent by email that the user types inside the app.

## 2. Decisions

| #   | Decision                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Registration is open to anyone. The app becomes multi-user. This reverses the "refuse sign-ups" control of step 2.5b on purpose.     |
| D2  | Remove the magic link: the mode, `sendMagicLink`, `/auth/callback` and `lib/auth/session.ts`.                                        |
| D3  | The form has 3 fields: name (1 to 60 characters), email, password (8 or more).                                                       |
| D4  | Use the native Supabase calls: `signUp`, `verifyOtp` with type `email`, `resend` with type `signup`. No new table, no Edge Function. |
| D5  | Email goes through Resend, set as custom SMTP in the Supabase dashboard. The owner does this setup.                                  |
| D6  | Two phases. Phase A: register with no verification. Phase B: a 6-digit code before the first session.                                |
| D7  | The name goes to Supabase as user metadata `display_name`. The trigger `on_auth_user_created` already copies it into `profiles`.     |
| D8  | The work runs in its own worktree and branch. It merges into `feat/phase-2-workout-log` when it is done.                             |

## 3. Phase A — register with no verification

Supabase "Confirm email" is off. `signUp` returns a session at once.

1. The user opens `/sign-up` and fills name, email and password.
2. The server action `signUp` calls `supabase.auth.signUp({ email, password, options: { data: { display_name } } })`.
3. The trigger creates the `profiles` row.
4. The action returns `{ status: 'signed-in' }`. The form calls `router.replace('/')`, then `router.refresh()`.
5. `SyncRunner` in the `(app)` layout runs the first sync. That sync lifts `signed_out` if it is set.

Error results:

| Supabase answer                | Result                 | Text on the screen                                           |
| ------------------------------ | ---------------------- | ------------------------------------------------------------ |
| `user_already_exists`          | `{ status: 'exists' }` | "An account with this email exists. Sign in instead." + link |
| `weak_password`                | `{ status: 'error' }`  | "Use 8 or more characters."                                  |
| `over_request_rate_limit` etc. | `{ status: 'error' }`  | "Too many tries. Wait a minute and try again."               |
| Any other                      | `{ status: 'error' }`  | "We could not create the account. Try again."                |

Confirm each exact error code in the Supabase docs (Context7) before the test is written.

Known gap of phase A: a person can register with an email that they do not own, and the
`exists` text tells that an email has an account. Phase B closes both.

## 4. Phase B — the 6-digit code

Supabase "Confirm email" is on. The confirm template sends `{{ .Token }}` and no link.

1. `signUp` returns a user and no session. The action returns `{ status: 'needs-code', email }`.
2. The form goes to `/verify?email=<email>`.
3. `/verify` shows 6 digit boxes as one input: `inputMode="numeric"`, `autoComplete="one-time-code"`,
   `pattern="[0-9]{6}"`. iOS offers the code from the email above the keyboard.
4. The server action `verifySignUpCode(email, token)` calls `verifyOtp({ email, token, type: 'email' })`.
   Success sets the session cookies. The page goes to `/`.
5. "Send a new code" calls `resendSignUpCode(email)` → `resend({ type: 'signup', email })`.
   The button waits 60 s between sends. The wait lives in memory.
6. Sign-in with an email that has no code yet: `signInWithPassword` returns
   `{ status: 'unverified', email }` for `email_not_confirmed`. The form sends a new code and
   goes to `/verify`.
7. With "Confirm email" on, Supabase answers `signUp` for an existing email with a user that
   has no identities and sends no email. The action returns `needs-code` in both cases. The
   screen never tells whether an email has an account. The `exists` result goes away.
8. Users made in phase A are confirmed already. Nothing to migrate.

Code errors: `otp_expired` and a wrong code both read "That code is wrong or too old. Send a
new code." Rate limit reads as in phase A.

## 5. Routes

| Route      | Public | A signed-in user is sent to `/` |
| ---------- | ------ | ------------------------------- |
| `/sign-in` | yes    | yes                             |
| `/sign-up` | yes    | yes                             |
| `/verify`  | yes    | yes                             |

`/auth/callback` leaves `PUBLIC_PATHS` with the magic link.

## 6. What does not change

- Dexie, the repository, the outbox and the sync worker. Any signed-in user maps to
  `LOCAL_PROFILE_ID` already.
- RLS. `user_id = auth.uid()` already keeps each account's rows apart.
- The sign-out. It clears all 8 tables, so a second person on one device sees nothing of the first.
- "The last push wins" stays per account.

## 7. The Supabase dashboard

The dashboard settings act on the live project at once, on every branch. The order is fixed
in `docs/plan/auth/index.md`, "The dashboard schedule".

## 8. Not in scope

- CAPTCHA. Supabase supports Turnstile and hCaptcha. Add it if bots register.
- Forgot password. The same code flow with type `recovery`. Cheap after phase B.
- Leaked password protection. It needs the Supabase Pro plan.
