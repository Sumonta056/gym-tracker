# Step A1 — The sign-up schema and server action

**Branch:** `feat/email-registration` · **Size:** S · **Depends on:** A0
**Unlocks:** A2 · **Agents to use:** `test-writer` · **Commit:** `feat(auth)`

## Context to read first

1. `docs/specs/2026-10-02-email-registration-design.md` — sections 2 and 3.
2. `lib/auth/actions.ts` and `lib/auth/actions.test.ts` — the pattern: `'use server'`, a typed
   result union, one generic message per failure, Supabase mocked.
3. `lib/auth/email.ts` — `normaliseEmail`, `isValidEmail`. Reuse them.
4. `lib/schema/` — one zod schema per entity (CLAUDE.md rule 8).
5. `supabase/migrations/20260921162445_phase1_profiles_and_daily_entries.sql:96-113` — the trigger reads `display_name`.

## State before the step

No sign-up code exists. `grep -rn signUp lib app` finds nothing.

## Goal

A tested server action that makes an account and signs the user in, with phase A settings.

## Do

1. Confirm in the Supabase docs (Context7, `@supabase/supabase-js` auth `signUp`) the exact error
   codes for an existing email, a weak password and a rate limit. Write them in the report.
2. Write `lib/schema/signUp.ts` and its test first:
   - `signUpSchema`: `name` trimmed, 1 to 60 characters; `email` through `normaliseEmail` and
     `isValidEmail`; `password` 8 to 72 characters (72 is the bcrypt limit).
   - Export `SignUpInput` from `z.infer`. The form in A2 imports this schema. Never re-declare it.
3. Write the tests in `lib/auth/actions.test.ts` first, in a new `describe('signUp')`:
   - `it('sends the name as display_name metadata')`
   - `it('normalises the email before it calls Supabase')`
   - `it('returns signed-in when Supabase returns a session')`
   - `it('returns exists for an email that has an account')`
   - `it('returns an error with the password hint for a weak password')`
   - `it('returns an error for a rate limit')`
   - `it('returns an error for any other failure')`
   - `it('refuses input that fails the schema with no Supabase call')`
4. Add to `lib/auth/actions.ts`:
   - `export type SignUpResult = { status: 'signed-in' } | { status: 'exists' } | { status: 'needs-code'; email: string } | { status: 'error'; message: string }`.
     `needs-code` is used in B1. Define it now so the union does not change shape later.
   - `export async function signUp(input: SignUpInput): Promise<SignUpResult>`.
   - With a session: `signed-in`. With a user and no session: `needs-code`.
5. Do not touch `sendMagicLink` or `signInWithPassword` in this step.

## Acceptance criteria

- [ ] `signUp` calls `supabase.auth.signUp` once with `options.data.display_name`.
- [ ] Each result in the spec table maps from its documented Supabase error code.
- [ ] Bad input returns `error` and never calls Supabase.
- [ ] `lib/schema/signUp.ts` is the only declaration of the sign-up shape.
- [ ] Coverage for `lib/**` stays at or above 85 / 75 / 85.
- [ ] No file outside `lib/auth/` and `lib/schema/` changed.

## Verification

`pnpm static`, then `pnpm test:cov`, then `pnpm verify` (port 3100 free first).

## Files touched

- `lib/schema/signUp.ts`, `lib/schema/signUp.test.ts` (new)
- `lib/auth/actions.ts`, `lib/auth/actions.test.ts`

## When the step is done

Stage and stop. Report the confirmed Supabase error codes and the coverage of `lib/auth/actions.ts`.
