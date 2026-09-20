---
name: design-system
description: The Gym Tracker design system — colour tokens, the eleven primitives, the responsive
  contract and the pass-or-fail checklist. Load this before any work under `app/` or
  `components/`, before writing or changing any Tailwind class, CSS, layout, colour,
  spacing, radius or typography, and before building a screen, a component or a chart.
  Use when asked to "style", "restyle", "make it look right", "fix the spacing", "add a
  card", "change the colour", "match the design", or when reviewing a screen for drift.
---

# The Gym Tracker design system

One style, held by three artefacts. Nothing under `app/` or `components/` is written
without them.

| Artefact                           | Role                                                  |
| ---------------------------------- | ----------------------------------------------------- |
| This skill                         | The rules. Tokens, recipes, contract, checklist.      |
| `docs/design/prototype/index.html` | The **target**. All seven screens at 390 px. Open it. |
| `/styleguide`                      | The **truth**. The real tokens and primitives, live.  |

The prototype shows the target, the style guide shows the truth. **If the two differ,
one of them is a bug. Say which, do not guess and do not silently change the other.**

## Before you touch a file

1. Read `references/tokens.md`. Every colour comes from a token. No raw hex, ever.
2. Read `references/components.md`. If a primitive exists, use it. Do not hand-roll a
   card, a label or a button.
3. Read `references/responsive.md`. Write the phone style as the base, add `md:` and
   `lg:` upward only.
4. Open `docs/design/prototype/index.html` in a browser and look at the screen you are
   about to build.
5. Read `.claude/rules/accessibility.md`.

## Reference files

| File                       | What it holds                                      |
| -------------------------- | -------------------------------------------------- |
| `references/tokens.md`     | The full token table and when to use each colour   |
| `references/components.md` | All eleven primitives, each with its markup recipe |
| `references/responsive.md` | The three-range layout table and the fixed rules   |
| `references/checklist.md`  | The nine-point pass-or-fail list, in full          |

## The nine-point checklist

Every screen and every component passes all nine before it is called done. The long
form, with how to check each one, is in `references/checklist.md`.

1. Does every colour come from a token? No raw hex in a component.
2. Does the page use `AppShell`, not its own frame?
3. Is there a bottom tab bar under 1024 px and a sidebar at 1024 px and up?
4. Is every tap target 44 px or taller?
5. Does the page render with no horizontal scroll at 320, 390, 768, 1024 and 1440 px?
6. Is every interactive element a real `button`, `a` or `input` with a label?
7. Do numbers use tabular figures?
8. Do the micro labels use `MicroLabel`, not a hand-written style?
9. Is the new component in the style guide route?

## Where the tokens live

- `app/globals.css` — the Tailwind v4 `@theme` block. The one source of truth.
- `lib/design/tokens.ts` — the same values as TypeScript, because chart code cannot
  read a CSS custom property. A unit test asserts the two agree. If they drift, that
  test fails, and the fix is to change both, never to loosen the test.

## The `/styleguide` route

`/styleguide` renders every token swatch, every type step and every primitive at the
current breakpoint. **Every new visual pattern gets an entry there, in the same change
that introduces it.** A primitive that is not in the style guide cannot be reviewed for
drift, so it is not done.

The route is guarded behind the `NEXT_PUBLIC_ENABLE_STYLEGUIDE` environment flag. When
the flag is absent the route calls `notFound()`, so it never reaches the live app. Set
`NEXT_PUBLIC_ENABLE_STYLEGUIDE=1` in `.env.local` to see it in development.

## The three habits that cause most drift

- **A one-off colour.** Somebody needed "a slightly lighter border" and typed a hex.
  Use `--color-surface-2` or add a token deliberately; never a stray value.
- **A hand-written micro label.** `text-[10px] uppercase tracking-wide` looks close and
  is not. Use `MicroLabel`.
- **A `div` with an `onClick`.** It fails the keyboard, the screen reader and axe at
  once. Use a real `button`.

## Done when

- All nine checklist points pass.
- The screen is checked at 390 px, 768 px and 1440 px.
- Any new pattern appears in `/styleguide`.
- `pnpm verify` passes.
