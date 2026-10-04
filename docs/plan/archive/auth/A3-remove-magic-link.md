# Step A3 — Remove the magic link and the callback

**Branch:** `feat/email-registration` · **Size:** S · **Depends on:** A2
**Unlocks:** Checkpoint A · **Agents to use:** `test-writer` · **Commit:** `refactor(auth)`

## Context to read first

1. `app/(auth)/sign-in/SignInForm.tsx` — `MagicLinkSignIn` (:144-247), the mode state (:26).
2. `lib/auth/actions.ts` — `sendMagicLink`, `siteOrigin`, `SendMagicLinkResult`.
3. `lib/auth/session.ts`, `app/auth/callback/route.ts` and their tests.
4. `middleware.ts:7` — `/auth/callback` in `PUBLIC_PATHS`.
5. `tests/e2e/auth.spec.ts` — the mode toggle test.

## State before the step

Sign-in has 2 modes. `/auth/callback` exchanges a PKCE code. Only the magic link sends users there.

## Goal

One sign-in path: email and password. No dead code from the magic link.

## Do

1. Prove that nothing else uses the code that goes:
   `grep -rn "sendMagicLink\|exchangeCodeForSession\|auth/callback\|SITE_URL\|siteOrigin" app lib components middleware.ts tests`.
   Report every hit. If a hit is outside the magic link, stop and ask.
2. Delete `MagicLinkSignIn`, the `Mode` state and the "Email me a link instead" button. The form
   is the password form alone. Keep the install card.
3. Delete `sendMagicLink`, `SendMagicLinkResult`, `siteOrigin` and their tests from `lib/auth/actions.ts`.
4. Delete `lib/auth/session.ts`, `app/auth/callback/route.ts` and their tests.
5. Remove `/auth/callback` from `PUBLIC_PATHS`. Update `middleware.test.ts`.
6. Remove the mode toggle test from `tests/e2e/auth.spec.ts`.
7. Remove `SITE_URL` from `.env.example` only if step 1 found no other reader. B1 does not need it:
   a code needs no redirect.

## Acceptance criteria

- [ ] `grep -rn "signInWithOtp\|exchangeCodeForSession\|sendMagicLink" app lib components` finds nothing.
- [ ] `/auth/callback` is no longer public: an anonymous request goes to `/sign-in`, a signed-in one gets 404.
- [ ] Sign-in at 390 px matches plate p0.
- [ ] `pnpm test:required` passes: no source file lost its test, no test lost its source.
- [ ] Coverage floors hold.

## Verification

`pnpm verify` (port 3100 free first).

## Files touched

- `app/(auth)/sign-in/SignInForm.tsx` and its test
- `lib/auth/actions.ts` and its test
- `lib/auth/session.ts`, `app/auth/callback/route.ts` and tests (deleted)
- `middleware.ts`, `middleware.test.ts`
- `tests/e2e/auth.spec.ts`, maybe `.env.example`

## When the step is done

Stage and stop. Then the owner runs Checkpoint A (`docs/plan/auth/index.md`).
