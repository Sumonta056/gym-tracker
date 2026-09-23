# Tokens

Every colour, radius and font in the app comes from this table. **No component holds a
raw hex value.** If you are about to type `#`, stop: either a token already covers it,
or the design needs a new token added deliberately to `app/globals.css` and
`lib/design/tokens.ts` together.

## The source of truth

- `app/globals.css` — the Tailwind v4 `@theme` block.
- `lib/design/tokens.ts` — the same values as TypeScript, for chart code, which cannot
  read a CSS custom property.
- A unit test asserts the two agree. If it fails, change both files. Never loosen the
  test.

In a component you reach a token through its Tailwind class — `bg-surface`,
`text-muted`, `border-border`, `rounded-card`. In a chart you import it from
`lib/design/tokens.ts`.

## Colour

| Token                 | Value     | Use it for                                          |
| --------------------- | --------- | --------------------------------------------------- |
| `--color-ground`      | `#0B0B0D` | The page background. Nothing else.                  |
| `--color-surface`     | `#15151A` | Cards, inputs, the tab bar, the sheet.              |
| `--color-surface-2`   | `#1E1E25` | Pressed state, secondary button, an inset cell.     |
| `--color-border`      | `#24242C` | Every card and input border. Always 1 px.           |
| `--color-text`        | `#F4F4F7` | Primary text and every number the user reads.       |
| `--color-muted`       | `#8C8C99` | Labels and secondary text. The floor for body text. |
| `--color-dim`         | `#6E6E7B` | Inactive tab and hint text **only**.                |
| `--color-accent`      | `#C6F135` | The action, today, gym time, the selected state.    |
| `--color-accent-ink`  | `#10160A` | The only text colour allowed on an accent fill.     |
| `--color-data-cyan`   | `#22D3EE` | Walk, steps, volume load.                           |
| `--color-data-violet` | `#A78BFA` | Weight and the 7-day average.                       |
| `--color-warn`        | `#FB923C` | The cardio zone, a warning, the `OFFLINE` chip.     |
| `--color-danger`      | `#F87171` | The peak zone and anything destructive.             |
| `--color-ok`          | `#4ADE80` | Sync status when everything is pushed.              |

### The rules that go with the table

- **`--color-dim` never carries a value the user must read.** It is for an inactive tab
  label and a hint line. A number, a date or a unit goes in `--color-text` or
  `--color-muted`.
- **`--color-accent-ink` is the only text colour on an accent fill.** Not white, not
  `--color-text`. The pair is the one that clears 4.5:1.
- **The data colours mean something.** Cyan is movement and volume, violet is body
  weight, orange is the cardio zone, red is the peak zone, green is sync. Do not borrow
  a data colour because it looks nice; the reader learns the mapping across screens.
- **`--color-ok` also marks the fat-burn zone** in the heart rate zone bar.
- **Never carry meaning by colour alone.** A green dot is paired with the word
  `SYNCED`. A red bar is paired with the word `Peak`.
- Body text is 4.5:1 or better against the token behind it. Large text may drop to 3:1.

## Shape

| Token            | Value   | Use                                  |
| ---------------- | ------- | ------------------------------------ |
| `--radius-hero`  | `24px`  | The hero card only.                  |
| `--radius-card`  | `20px`  | Every other card.                    |
| `--radius-input` | `16px`  | Inputs and the full-width buttons.   |
| pill             | `999px` | Chips, filter pills, segmented tabs. |

- Card border is always 1 px, `--color-border`. A **selected** card uses
  `--color-accent` as its border, and nothing else changes.
- Side gutters are 20 px on the phone, 28 px from 640 px up.
- The gap between cards is 11 to 12 px.

## Type

Figtree, weights 400, 500, 600, 700, 800. `font-variant-numeric: tabular-nums` is set
on the body so numbers do not jump when they tick.

| Role         | Size      | Weight | Tracking               |
| ------------ | --------- | ------ | ---------------------- |
| Hero number  | 44–50 px  | 800    | -2.2 to -2.6 px        |
| Screen title | 23 px     | 700    | -0.6 px                |
| Card number  | 25 px     | 700    | -0.9 px                |
| Body         | 14–15 px  | 500    | 0                      |
| Micro label  | 9.5–10 px | 700    | 1.5–1.6 px, upper case |

A micro label is never hand-written. It is `MicroLabel`.

## Adding a token

Rarely, and never mid-screen. When it is genuinely needed:

1. Add it to the `@theme` block in `app/globals.css`.
2. Add the same value to `lib/design/tokens.ts`.
3. Add a swatch to `/styleguide`.
4. Add the row to this file and say what it is for.
5. Run `pnpm verify`; the token parity test must pass.
