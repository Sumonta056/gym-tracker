# Step B1 — Verify, resend and the unverified sign-in

**Branch:** `feat/email-registration` · **Size:** S · **Depends on:** A3, B0
**Unlocks:** B2 · **Agents to use:** `test-writer` · **Commit:** `feat(auth)`

## Context to read first

1. `docs/specs/2026-10-02-email-registration-design.md` — section 4.
2. `lib/auth/actions.ts` and its test — `signUp` (A1), `signInWithPassword`.
3. `lib/schema/signUp.ts`.

## State before the step

`signUp` returns `signed-in` or `exists`. `needs-code` is in the union but never returned in
practice, because "Confirm email" is off.

## Goal

The 3 server actions that phase B needs, tested against mocked Supabase.

## Do

1. Confirm in the Supabase docs (Context7) the codes for: a wrong code, an expired code
   (`otp_expired`), sign-in before confirmation (`email_not_confirmed`), and the shape of the
   `signUp` answer for an existing email when confirmations are on (a user with an empty
   `identities` array, no session). Write them in the report.
2. Add `codeSchema` to `lib/schema/signUp.ts`: exactly 6 digits, spaces stripped. Test first.
3. Tests first, then code, in `lib/auth/actions.ts`:
   - `verifySignUpCode(email, token)` → `verifyOtp({ email, token, type: 'email' })`.
     Results: `{ status: 'signed-in' }`, `{ status: 'bad-code' }` for a wrong or expired code,
     `{ status: 'error', message }` for a rate limit or any other failure.
   - `resendSignUpCode(email)` → `resend({ type: 'signup', email })`. Results: `{ status: 'sent' }`
     or `{ status: 'error', message }`. A rate limit says "Wait a minute before you ask for a new code."
   - `signUp`: a user with an empty `identities` array returns `needs-code`, the same as a new user.
     Remove the `exists` result and its branch. Update the A1 tests.
   - `signInWithPassword`: `email_not_confirmed` returns `{ status: 'unverified', email }`. Every
     other refusal keeps the one generic message.
4. Each action normalises the email with `normaliseEmail` and checks it with the schema before any call.

## Acceptance criteria

- [ ] `signUp` never tells whether an email has an account: new and existing both return `needs-code`.
- [ ] A wrong code and an expired code both return `bad-code`.
- [ ] `signInWithPassword` returns `unverified` only for `email_not_confirmed`.
- [ ] Bad input never reaches Supabase.
- [ ] Coverage floors hold.

## Verification

`pnpm static`, `pnpm test:cov`, then `pnpm verify` (port 3100 free first).

## Files touched

- `lib/schema/signUp.ts` and test
- `lib/auth/actions.ts` and test
- `app/(auth)/sign-up/SignUpForm.tsx` and test — remove the `exists` branch only

## When the step is done

Stage and stop. Report the confirmed Supabase codes.
