# The prototype

`index.html` beside this file is the **visual contract** for Gym Tracker. It shows all
seven screens of the specification side by side, each in a 390 px frame, with the
screen name and the route above it.

Canvas mockups: https://claude.ai/artifact/8pajWGN8ykJNhxaGLSNNG4

## An honest limit — read this first

**The prototype was built from the written specification and the token table only.**
Nobody on this side could open the canvas mockups linked above, so **the prototype has
never been compared against them.**

That is a stated limit, not a failure. Everything in the file traces to a source we
could read:

- the token table, the radii and the spacing in `CLAUDE.md`,
- section 6 (Design system) and section 7 (Screens) of
  `docs/specs/2026-09-20-gym-tracker-design.md`,
- the responsive contract and the primitive list in `docs/plan/00-phase-0.md` § 0.9.

Anything the canvas shows that the prose does not say is therefore **not** in this
file. Before the prototype is treated as final, somebody who can open the canvas link
must compare the two and report the differences. Until that happens, treat the
prototype as "faithful to the written spec", not as "faithful to the mockups".

## How to open it

Double-click `docs/design/prototype/index.html`, or drag it into any browser. There is
no build step, no server and no install.

Read it at a wide window. The seven frames wrap into rows, so a narrow window simply
stacks them.

## What it is allowed to contain

- **No project import.** It never reads `app/globals.css`, `lib/design/tokens.ts` or
  any component. That is deliberate: the prototype cannot drift because a refactor
  moved a class. It only changes when a person changes it.
- **No network request.** No script tag, no style sheet from elsewhere, no web font,
  no image from a remote host. It opens correctly from the file system with the
  network off, which is the same condition the app itself has to survive in a gym
  basement.
- **No JavaScript.** Every state you see — a pressed tick, a selected tab, the open
  bottom sheet — is a static mock of that state, not a live one.

### The font limit that follows from "no network"

The app loads **Figtree** from Google Fonts. The prototype may not, because it must
make no network request. It names Figtree first in the stack and falls back to the
system UI font:

```
'Figtree', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, ...
```

So the prototype renders in Figtree only on a machine that already has Figtree
installed. **Letter shapes and text widths may differ slightly from the live app.**
Judge colour, spacing, radius, hierarchy and layout from this file; judge the exact
type rendering from `/styleguide`.

## The prototype and `/styleguide`

Two artefacts, two jobs.

| Artefact                           | Job                                                   |
| ---------------------------------- | ----------------------------------------------------- |
| `docs/design/prototype/index.html` | The **target**. What the screens are meant to look like. |
| `/styleguide` (live route)         | The **truth**. What the real tokens and primitives do.  |

`/styleguide` is the drift detector. It renders every token swatch, every type step and
every primitive at the current breakpoint, using the real `app/globals.css` and the
real components. **If the two differ, one of them is a bug.** Say which one, do not
quietly change the other to match.

The `/styleguide` route is guarded behind the `NEXT_PUBLIC_ENABLE_STYLEGUIDE`
environment flag and calls `notFound()` when the flag is absent, so it never ships to
the live app.

## Changing the prototype

- The prototype changes when the **design** changes, never to paper over a shortfall in
  the code.
- `docs/design/prototype/` is listed in `.prettierignore`. Do not format it; the
  formatting is hand-held so the diff of a design change stays readable.
- Keep every colour coming from a custom property on `:root`. No raw hex in the markup.
