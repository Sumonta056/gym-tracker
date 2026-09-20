# Accessibility rules

axe must report zero serious or critical issues on every route. These four rules cover
almost all of it.

## 1. Tap targets are 44 px or taller

At every breakpoint, from 320 px to 2560 px. An icon button needs padding, not a
smaller icon. Charts and tab bars are no exception.

## 2. Real elements

- Something that does a thing is a `<button>`.
- Something that goes somewhere is an `<a>` or a `next/link`.
- Never a `<div>` with `onClick`. Never a clickable `<span>`.
- A real element gives keyboard focus, Enter and Space, and the right role for free.
- Focus is always visible. Never `outline: none` without a replacement ring.

## 3. Every control has a label

- Every input has a `<label>` tied by `htmlFor`, or an `aria-label` when the design
  shows no visible text.
- An icon-only button has an `aria-label`.
- An error message is tied to its input by `aria-describedby`, and the input carries
  `aria-invalid`.
- A chart has a text alternative: the same numbers are readable outside the canvas.

## 4. Contrast is 4.5:1 or better

For body text, against the token behind it. Large text may drop to 3:1.

- `--color-muted` on `--color-surface` is the floor for secondary text.
- `--color-dim` is for inactive and hint text only. Never for a value the user must
  read.
- `--color-accent-ink` is the only text color on an `--color-accent` fill.
- Never carry meaning by color alone. Pair it with text or a shape.
