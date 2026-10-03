# Step A0 — Plan docs and the sign-up and verify plates

**Branch:** `feat/email-registration` · **Size:** S · **Depends on:** —
**Unlocks:** A1 · **Agents to use:** `ui-reviewer` · **Commit:** `docs(design)`

## Context to read first

1. `docs/specs/2026-10-02-email-registration-design.md` — sections 3, 4 and 5.
2. `docs/plan/auth/index.md` — "Rules that keep Phase 2 unblocked", rule 5.
3. `.claude/skills/design-system/` — load it.
4. `docs/design/prototype/index.html:1190-1268` — plate p0, "Sign in".
5. `app/(auth)/sign-in/SignInForm.tsx` — the shipped sign-in screen.

## State before the step

- Plate p0 shows email, password, "Sign in", "Email me a link instead" and the install card.
- No plate exists for sign-up or for the code screen.
- The plan docs, the spec and `.claude/commands/resume-auth.md` exist on disk, not in git.

## Goal

The prototype is the visual contract for the 2 new screens before any code. The plan docs are in git.

## Do

1. In plate p0, delete the "Email me a link instead" button. Add a line under "Sign in":
   "New here? **Create an account**" as a real `<a>`, 44 px tall.
2. Add plate **p0b, "Create account", route `/sign-up`**, right after p0, in the same section
   style. Same header block as p0 (brand mark, `h1`). Fields: Name (`autocomplete="name"`),
   Email (`autocomplete="email"`), Password (`autocomplete="new-password"`, hint "8 or more
   characters"). Primary button "Create account". Line "Have an account? **Sign in**".
3. Add plate **p0c, "Check your email", route `/verify`**, after p0b.
   - Text: "We sent a 6-digit code to <strong>sumonta@example.com</strong>."
   - One code input, `inputmode="numeric"`, `autocomplete="one-time-code"`, wide letter spacing,
     tabular numbers. Not 6 separate inputs.
   - Primary button "Verify". Secondary button "Send a new code". A muted line "You can send a
     new code in 0:42" for the wait state.
   - "Use a different email" link back to `/sign-up`.
4. Show the error state of p0b once, under the email field: "An account with this email exists.
   Sign in instead." tied by `aria-describedby`, the input with `aria-invalid="true"`.
5. Keep every change inside plate p0 and the 2 new plates. Do not touch any other plate (rule 5).
6. Run the `ui-reviewer` agent on the prototype change.
7. Stage the prototype, the spec, `docs/plan/auth/**` and `.claude/commands/resume-auth.md`.

## Acceptance criteria

- [ ] p0 has no magic link button and has a "Create an account" link.
- [ ] p0b and p0c exist, each with its name, its number and its route in the plate label.
- [ ] Every field has a visible label tied by `for`. Every control is 44 px or taller.
- [ ] Only tokens, no raw hex. `pnpm design:check` passes.
- [ ] The p0b error state uses `aria-describedby` and `aria-invalid`.
- [ ] `git diff --stat` shows no change outside the prototype, the spec, `docs/plan/auth/` and the command file.

## Verification

1. Open `docs/design/prototype/index.html` at 390, 768 and 1440 px. No sideways scroll.
2. `pnpm static`.
3. `pnpm verify` (port 3100 free first, index rule 3).

## Files touched

- `docs/design/prototype/index.html`
- `docs/specs/2026-10-02-email-registration-design.md` (new)
- `docs/plan/auth/*` (new)
- `.claude/commands/resume-auth.md` (new)

## When the step is done

Stage and stop. Report the screenshots of p0, p0b and p0c at 390 px. The main session asks the
owner to approve the plates before A1. The report needs the Screenshots section (`.claude/rules/git.md`).
