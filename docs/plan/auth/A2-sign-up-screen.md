# Step A2 — `/sign-up`, the middleware, the sign-in link

**Branch:** `feat/email-registration` · **Size:** M · **Depends on:** A1
**Unlocks:** A3 · **Agents to use:** `ui-reviewer`, `test-writer` · **Commit:** `feat(auth)`

## Context to read first

1. Plates p0 and p0b in `docs/design/prototype/index.html` — the visual contract.
2. `.claude/skills/design-system/` and the `add-screen` skill — load both.
3. `app/(auth)/sign-in/SignInForm.tsx` and its test — the form pattern: `noValidate`, field
   errors, pending text, `router.replace('/')` then `router.refresh()`.
4. `components/ui/EmailField.tsx`, `components/ui/PasswordField.tsx`, `PrimaryButton`.
5. `middleware.ts` and `middleware.test.ts` — `PUBLIC_PATHS` at :7.
6. `tests/e2e/auth.spec.ts`, `tests/e2e/responsive.spec.ts:12`.

## State before the step

The `signUp` action and `signUpSchema` exist (A1). No route uses them.

## Goal

A person with no account can open `/sign-up`, make an account and land on Today.

## Do

1. Tests first for the form, in `app/(auth)/sign-up/SignUpForm.test.tsx`:
   - Each field shows its error from `signUpSchema` on submit, with `aria-invalid` and `aria-describedby`.
   - The button reads "Creating account…" and is disabled while pending.
   - `signed-in` calls `router.replace('/')` then `router.refresh()`.
   - `exists` shows the exists text with a link to `/sign-in`.
   - `error` shows the message in a `role="alert"` region.
2. Build `app/(auth)/sign-up/page.tsx` and `SignUpForm.tsx` to match p0b. Reuse the sign-in header
   component. If it is private to `SignInForm.tsx`, move it to `app/(auth)/AuthHeader.tsx` with its own test.
3. In `SignInForm.tsx`, add "New here? Create an account" as a `next/link` to `/sign-up`, as in p0.
   Leave the magic link in place. A3 removes it.
4. In `middleware.ts`, add `/sign-up` to `PUBLIC_PATHS`, and send a signed-in user on `/sign-up` to
   `/`, the same as `/sign-in`. Tests first in `middleware.test.ts`.
5. In `supabase/config.toml`, set `enable_signup = true` at :175 and :220. Leave
   `enable_confirmations = false`.
6. E2E, in `tests/e2e/auth.spec.ts`: anonymous `/sign-up` loads, field errors show, the 2 links
   between `/sign-in` and `/sign-up` work. No test submits a valid form (index rule 4).
7. In `tests/e2e/responsive.spec.ts:12`, add `/sign-up` to `PUBLIC_ROUTES`. Change nothing else.
8. Add the screen to `/styleguide` only if the `add-screen` skill says so for an `(auth)` route.
9. Run the `ui-reviewer` agent.

## Acceptance criteria

- [ ] `/sign-up` matches p0b at 390, 768 and 1440 px.
- [ ] An anonymous user can open `/sign-up`. A signed-in user on `/sign-up` goes to `/`.
- [ ] The form imports `signUpSchema`. It declares no shape of its own.
- [ ] Every field has a label, every control is 44 px or taller, axe reports no serious or critical issue.
- [ ] Sign-in and sign-up link to each other.
- [ ] `config.toml` allows sign-ups, confirmations stay off.
- [ ] No sideways scroll from 320 px to 2560 px on `/sign-up`.

## Verification

1. `pnpm verify` (port 3100 free first).
2. Manual, only when the owner has turned on "Allow new users to sign up" (index, dashboard
   schedule): register one account on `pnpm dev`, land on Today, see the name on `/profile`.
   Otherwise skip, and say so in the report.

## Files touched

- `app/(auth)/sign-up/page.tsx`, `SignUpForm.tsx` and tests (new)
- `app/(auth)/sign-in/SignInForm.tsx` and its test
- `components/ui/Field.tsx` and its test: `error` takes a `ReactNode`, keeps `role="alert"` (A0 decision)
- `app/(auth)/AuthHeader.tsx` and test (new, only if moved)
- `middleware.ts`, `middleware.test.ts`
- `supabase/config.toml`
- `tests/e2e/auth.spec.ts`, `tests/e2e/responsive.spec.ts`

## When the step is done

Stage and stop. Report screenshots of `/sign-up` at 390, 768 and 1440 px next to p0b.
