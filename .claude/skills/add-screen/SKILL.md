---
name: add-screen
description: Scaffold a new route in the Gym Tracker app — its page, its responsive shell, its
  test and its style guide entry. Use when adding any screen under `app/`, when asked
  to "add a page", "add a route", "create a screen", or when a plan step names a new
  URL.
---

# Add a screen

## Before you start

1. Load `.claude/skills/design-system/`. No page work happens without it. Until step
   0.9 builds it, use the design rules in `CLAUDE.md`.
2. Read `.claude/rules/accessibility.md`.
3. Open `docs/design/prototype/index.html`. It is the visual contract.

Ask the user for the route path and the screen's one-sentence purpose if the request
does not already name both.

## Steps

### 1. The route

Create `app/<segment>/page.tsx`. It is a server component unless it needs state.

- It reads data through `lib/db/repository.ts` only. Never Supabase, never
  `lib/sync/**`.
- Export `metadata` with a `title`.

### 2. The responsive shell

The screen renders inside the app shell. Write the phone layout as the base and add
`md:` and `lg:` upward only.

| Range          | Layout                                                                |
| -------------- | --------------------------------------------------------------------- |
| Under 640 px   | One column, 20 px gutters, bottom tab bar with a centre action        |
| 640 to 1023 px | Two-column card grid, bottom tab bar stays, 28 px gutters             |
| 1024 px and up | Left sidebar 240 px, content capped at 1100 px centred, three columns |

- No raw hex. Every color is a token.
- Card radius 20 px, hero 24 px, input 16 px, pill 999 px. Gap 11 to 12 px.
- No horizontal scroll from 320 px to 2560 px.
- Every tap target 44 px or taller.

### 3. The components

Anything reused goes in `components/`. Anything used once stays in the route file.
Never re-declare a shape — import the zod schema from `lib/schema/`.

### 4. The test

- `app/<segment>/page.test.tsx` renders the screen and asserts its heading and its
  main affordance.
- Add the route to `tests/e2e/` coverage: it loads, it has one `h1`, and axe reports
  zero serious or critical issues.

### 5. The style guide entry

Add any new visual pattern to `/styleguide`. If `/styleguide` and the prototype
differ, one of them is a bug — say which, do not guess.

### 6. The navigation entry

Add the route to the tab bar or the sidebar if the user is meant to reach it.

## Done when

- `pnpm verify` passes.
- The screen is checked at 390 px, 768 px and 1440 px.
- axe is clean on the new route.
