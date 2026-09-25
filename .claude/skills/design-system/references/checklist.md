# The nine-point checklist

Pass or fail. Nine out of nine, or the screen is not done. Run it on every change under
`app/` or `components/`, before `pnpm verify` and before any report is written.

## Five points now run by machine

You no longer check these by hand. They fail the build.

| Point                                | Command             | Where it runs                        |
| ------------------------------------ | ------------------- | ------------------------------------ |
| 1, raw hex and hand mixed colour     | `pnpm design:check` | pre-commit, `pnpm static`, CI Static |
| 2, the page builds its own frame     | `pnpm design:check` | pre-commit, `pnpm static`, CI Static |
| 8, a hand written micro label        | `pnpm design:check` | pre-commit, `pnpm static`, CI Static |
| 3, one navigation per width          | `pnpm e2e`          | `pnpm verify`, CI Browser            |
| 4, every tap target 44 px or taller  | `pnpm e2e`          | `pnpm verify`, CI Browser            |
| 5, no sideways scroll 320 to 2560 px | `pnpm e2e`          | `pnpm verify`, CI Browser            |

Points 6, 7 and 9 still need your eyes. ESLint and axe carry most of point 6.

Every allowed exception is a named entry with a reason in `scripts/design-check.mjs`.
Never add one to get past the gate.

---

### 1. Does every colour come from a token? No raw hex in a component.

```
grep -rnE "#[0-9a-fA-F]{3,8}\b" app components
```

The only expected hits are inside `app/globals.css`. A hit anywhere else is a fail.
Chart colours come from `lib/design/tokens.ts`, not from a literal. A chart also
passes every rule in `references/charts.md`. An `rgba()` with a
hand-mixed channel is the same failure wearing a different hat — use a token with an
opacity modifier.

**Fix:** replace it with the token class, or add a token deliberately (see
`references/tokens.md`).

---

### 2. Does the page use `AppShell`, not its own frame?

The route renders its content inside `AppShell`. It does not set its own
`min-h-dvh`, its own background, its own max width or its own gutters.

**Fix:** delete the local frame. If the page genuinely needs something the shell cannot
give, change the shell once rather than forking it per route.

---

### 3. Is there a bottom tab bar under 1024 px and a sidebar at 1024 px and up?

Resize through 1023 px and 1024 px. Exactly one navigation is visible at every width.
Never both, never neither. The tab bar clears the home indicator with
`env(safe-area-inset-bottom)`, and the content clears the tab bar.

---

### 4. Is every tap target 44 px or taller?

Every `button`, `a`, `input`, tab, chip-that-acts, sheet row and icon button, at every
breakpoint — not just on the phone.

**Check:** in devtools, inspect the smallest control on the screen and read its box
height. An icon button is the usual offender.

**Fix:** add padding, or `min-h-11` plus `min-w-11`. Never shrink the icon instead.

---

### 5. Does the page render with no horizontal scroll at 320, 390, 768, 1024 and 1440 px?

At each of the five widths, the page does not scroll sideways.

```js
document.documentElement.scrollWidth <= document.documentElement.clientWidth
```

The common causes are listed at the end of `references/responsive.md`.

---

### 6. Is every interactive element a real `button`, `a` or `input` with a label?

- Something that **does** a thing is a `<button>` with an explicit `type`.
- Something that **goes** somewhere is an `<a>` or a `next/link`.
- **Never** a `div` with `onClick`. Never a clickable `span`.
- Every input has a `<label htmlFor>`, or an `aria-label` where the design shows no
  visible text. Every icon-only button has an `aria-label`.
- An error is tied to its input by `aria-describedby`, and the input carries
  `aria-invalid`.
- Focus is always visible. `outline: none` without a replacement ring is a fail.

**Check:** tab through the whole screen with the keyboard. Every control is reachable,
the focus ring is visible, and Enter and Space both work.

---

### 7. Do numbers use tabular figures?

`font-variant-numeric: tabular-nums` is set on the body, so this is normally free. It
is a fail if a component overrides it, or if a number is rendered inside something that
resets the font. A ticking timer that jitters is the symptom.

---

### 8. Do the micro labels use `MicroLabel`, not a hand-written style?

```
grep -rn "tracking-\[1.5px\]\|uppercase" app components
```

Every hit outside `components/ui/MicroLabel.tsx` is suspect. A hand-written
`text-[10px] uppercase tracking-wide` looks close and is not the same.

---

### 9. Is the new component in the style guide route?

Every new visual pattern has an entry in `/styleguide`, in the **same change** that
introduces it. A primitive that is not in the style guide cannot be reviewed for drift,
so it is not done.

`/styleguide` is guarded behind `NEXT_PUBLIC_ENABLE_STYLEGUIDE` and calls `notFound()`
when the flag is absent. Set `NEXT_PUBLIC_ENABLE_STYLEGUIDE=1` in `.env.local` to see
it while developing.

---

## After the nine

- Compare the screen against `docs/design/prototype/index.html`. **If the prototype and
  `/styleguide` disagree, one of them is a bug — name which one. Do not quietly change
  the other to match.**
- axe reports zero serious or critical issues on the route.
- `pnpm verify` passes.
