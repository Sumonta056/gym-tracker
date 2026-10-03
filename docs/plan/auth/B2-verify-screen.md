# Step B2 — `/verify` and the routes into it

**Branch:** `feat/email-registration` · **Size:** M · **Depends on:** B1
**Unlocks:** Checkpoint B · **Agents to use:** `ui-reviewer`, `test-writer` · **Commit:** `feat(auth)`

## Context to read first

1. Plate p0c in `docs/design/prototype/index.html`.
2. `.claude/skills/design-system/` and the `add-screen` skill — load both.
3. `app/(auth)/sign-up/SignUpForm.tsx`, `app/(auth)/sign-in/SignInForm.tsx`.
4. `middleware.ts`, `supabase/config.toml` `[auth.email]` (:220-233).
5. `docs/plan/auth/B0-resend-setup.md` — the template text.

## State before the step

The 3 actions exist (B1). No screen takes a code.

## Goal

A user types the 6-digit code in the app and lands on Today.

## Do

1. Tests first, `app/(auth)/verify/VerifyCodeForm.test.tsx`:
   - The input has a label, `inputMode="numeric"`, `autoComplete="one-time-code"`, `maxLength={6}`.
   - A code that fails `codeSchema` shows the field error and calls nothing.
   - `signed-in` → `router.replace('/')` then `router.refresh()`.
   - `bad-code` shows "That code is wrong or too old. Send a new code."
   - "Send a new code" is disabled for 60 s after a send, with the countdown text. Use fake timers.
   - No `email` in the query: show a link back to `/sign-up` and no form.
2. Build `app/(auth)/verify/page.tsx` and `VerifyCodeForm.tsx` to match p0c. The page reads `email`
   from `searchParams` and passes it down. Show it as text. Never put it in `innerHTML`.
3. `SignUpForm`: `needs-code` → `router.push('/verify?email=' + encodeURIComponent(email))`.
4. `SignInForm`: `unverified` → call `resendSignUpCode`, then the same push.
5. `middleware.ts`: add `/verify` to `PUBLIC_PATHS`, and send a signed-in user on it to `/`. Tests first.
6. `supabase/config.toml`: `enable_confirmations = true` (:225). Write the B0 template to
   `supabase/templates/confirmation.html` and add `[auth.email.template.confirmation]` with
   `subject` and `content_path`.
7. E2E: anonymous `/verify?email=a@b.co` loads, a 5-digit code shows the field error. Add `/verify`
   to `PUBLIC_ROUTES` in `tests/e2e/responsive.spec.ts`.
8. Run the `ui-reviewer` agent.

## Acceptance criteria

- [ ] `/verify` matches p0c at 390, 768 and 1440 px.
- [ ] Sign-up and an unverified sign-in both land on `/verify` with the email shown.
- [ ] The resend wait is 60 s and the countdown is readable by a screen reader (`aria-live="polite"`).
- [ ] axe: no serious or critical issue. Every control 44 px or taller. No sideways scroll.
- [ ] `config.toml` turns on confirmations and points at the template file.

## Verification

1. `pnpm verify` (port 3100 free first).
2. Do not turn on "Confirm email" in the dashboard in this step. The owner does it at
   Checkpoint B, after the schedule in `index.md`.

## Files touched

- `app/(auth)/verify/page.tsx`, `VerifyCodeForm.tsx` and tests (new)
- `app/(auth)/sign-up/SignUpForm.tsx`, `app/(auth)/sign-in/SignInForm.tsx` and tests
- The auth header and its test: a title setting, so `/verify` shows "Check your email" (A0 decision)
- `middleware.ts`, `middleware.test.ts`
- `supabase/config.toml`, `supabase/templates/confirmation.html` (new)
- `tests/e2e/auth.spec.ts`, `tests/e2e/responsive.spec.ts`

## When the step is done

Stage and stop. Report screenshots of `/verify` next to p0c. Then the owner turns on
"Confirm email" and runs Checkpoint B.
