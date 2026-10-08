# The eleven primitives

Every screen is built from these. **If a primitive exists, use it.** A hand-rolled card
or label is the single most common source of drift.

## House rules for writing one

- They live in `components/ui/`, one file per primitive, `PascalCase.tsx`.
- They are written with **plain Tailwind class strings**. `shadcn/ui`, `clsx`, `cva` and
  `tailwind-merge` are **not installed**. Do not write a recipe that imports them.
- Variants are a plain lookup object keyed by the variant name. Extra classes come in
  through a `className` prop appended last.
- Every one takes `className?: string` and spreads the rest of its native props, so a
  screen can add a grid position without forking the component.
- No raw hex. Every colour is a token class: `bg-surface`, `text-muted`,
  `border-border`, `bg-accent text-accent-ink`.
- Each one gets a test beside it and an entry in `/styleguide`. Both in the same change.

The merge helper used below is deliberately trivial — there is no dependency behind it:

```tsx
// components/ui/cn.ts
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}
```

---

## 1. `AppShell`

The responsive frame. **Every route renders inside it and no route writes its own
frame.** Tab bar under 1024 px, sidebar at 1024 px and up. Full rules in
`references/responsive.md`.

```tsx
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-ground text-text min-h-dvh">
      <Sidebar className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-60" />
      <main className="mx-auto w-full max-w-[1100px] px-5 pb-28 md:px-7 lg:pb-8 lg:pl-60">
        {children}
      </main>
      <TabBar className="lg:hidden" />
    </div>
  )
}
```

- `pb-28` clears the tab bar. It drops at `lg`, where there is no tab bar.
- The tab bar itself adds `pb-[env(safe-area-inset-bottom)]`.

---

## 2. `Card`

`surface` fill, 1 px `border`, `rounded-card`. The `selected` variant swaps the border
for the accent and changes nothing else.

```tsx
const cardTone = {
  default: 'border-border',
  selected: 'border-accent',
} as const

export function Card({
  tone = 'default',
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { tone?: keyof typeof cardTone }) {
  return (
    <div
      className={cn('rounded-card bg-surface border p-4', cardTone[tone], className)}
      {...rest}
    />
  )
}
```

The live `Card` also takes `tone="rest"`, used by the rest timer only. It mixes
`--color-data-cyan` into the fill (7 % over `--color-surface`) and the border (34 % over
`--color-border`) with `color-mix`, as the prototype `.rest-card` does. It names no new
colour; both mixes read tokens. `selected` still wins the border.

A card is a `div`. If the whole card is clickable it is a `button` with
`text-left w-full` — never a `div` with `onClick`.

---

## 3. `HeroCard`

The one filled accent card on a screen. `rounded-hero`, `bg-accent`, `text-accent-ink`.
It holds the 44–50 px hero number.

```tsx
export function HeroCard({ label, value, footer }: HeroCardProps) {
  return (
    <section className="rounded-hero bg-accent text-accent-ink p-4 pb-5">
      <MicroLabel className="text-accent-ink/70">{label}</MicroLabel>
      <p className="mt-2.5 text-[48px] leading-none font-extrabold tracking-[-2.4px]">{value}</p>
      {footer ? <p className="mt-1.5 text-[13px] font-semibold opacity-80">{footer}</p> : null}
    </section>
  )
}
```

`text-accent-ink` is the only text colour allowed here. One hero per screen.

---

## 4. `StatCard`

Micro label, then a 25 px number, then an optional 5 px bar or a sparkline.

```tsx
export function StatCard({ label, value, hint, progress, tone = 'data-cyan' }: StatCardProps) {
  return (
    <Card>
      <MicroLabel>{label}</MicroLabel>
      <p className="mt-2 text-[25px] font-bold tracking-[-0.9px]">{value}</p>
      {hint ? <p className="text-dim mt-1.5 text-xs">{hint}</p> : null}
      {progress !== undefined ? (
        <div className="bg-surface-2 mt-2.5 h-[5px] overflow-hidden rounded-full">
          <div
            className={cn('h-full rounded-full', barTone[tone])}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      ) : null}
    </Card>
  )
}
```

- The bar width is the one legitimate inline style: it is data, not design.
- The bar colour comes from a token class, never from a hex.
- The bar is decorative; the number above it is the accessible value.

---

## 5. `MicroLabel`

9.5–10 px, weight 700, tracking 1.5 px, upper case, `muted`. **Never hand-written.**

```tsx
export function MicroLabel({ className, ...rest }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('text-muted text-[10px] font-bold tracking-[1.5px] uppercase', className)}
      {...rest}
    />
  )
}
```

Write the text in normal case in the source (`Gym time today`) and let CSS upper-case
it, so a screen reader is not handed shouting.

---

## 6. `StatusChip`

A 6 px dot plus an upper-case word. Visible on every data screen.

```tsx
const chipTone = {
  synced: { dot: 'bg-ok', word: 'Synced' },
  offline: { dot: 'bg-warn', word: 'Offline' },
  syncing: { dot: 'bg-data-cyan', word: 'Syncing' },
} as const

export function StatusChip({ state }: { state: keyof typeof chipTone }) {
  const { dot, word } = chipTone[state]
  return (
    <span className="border-border bg-surface text-muted inline-flex min-h-7 items-center gap-1.5 rounded-full border px-3 text-[10px] font-bold tracking-[1.5px] uppercase">
      <span className={cn('size-1.5 shrink-0 rounded-full', dot)} aria-hidden="true" />
      {word}
    </span>
  )
}
```

The word carries the meaning; the dot only repeats it. The dot is `aria-hidden`. The
chip is not a button, so it is exempt from the 44 px rule.

The live chip adds a fourth state, `pending`, with a `muted` dot and the word
`Pending`: a write still waits in the outbox, a write the server refused waits in the
dead-letter table for a Retry or a Discard, or the last drain failed. `Synced` shows
only when both the outbox and the dead-letter table are empty. When a screen shows two chips, the second one passes
`announce={false}`, so the state is read out once.

---

## 7. `NumberField`

52 px tall, `rounded-input`, with the right phone keypad.

```tsx
export function NumberField({ id, label, inputMode = 'decimal', ...rest }: NumberFieldProps) {
  return (
    <div>
      <label htmlFor={id}>
        <MicroLabel className="mb-1.5 block">{label}</MicroLabel>
      </label>
      <input
        id={id}
        inputMode={inputMode}
        className="rounded-input border-border bg-surface text-text placeholder:text-dim h-13 w-full border px-3.5 text-base font-semibold"
        {...rest}
      />
    </div>
  )
}
```

- `inputMode` decides the keypad, and it **defaults to `decimal`**. Weight needs a
  decimal point, and the iOS `numeric` keypad has none, so the safe default is the one
  that can type every value.
- Pass `inputMode="numeric"` only on a field that holds whole numbers. Today that is
  heart rate, calories and steps on `/log`, and the step goal and height on
  `/profile`.
- Font size is 16 px or larger, or iOS Safari zooms the page on focus.
- On an error: `aria-invalid` on the input, `aria-describedby` pointing at the message,
  and the message in `text-danger` with words, not colour alone.

### Field wrappers: `EmailField` and `PasswordField`

These are not primitives. Each one is a thin wrapper on `Field` that fixes `type` and a
default `autoComplete`. The label, the hint, the error and the `aria` wiring all come
from `Field`. Do not restyle them.

```tsx
export function PasswordField({ autoComplete = 'current-password', ...rest }: PasswordFieldProps) {
  return <Field type="password" autoComplete={autoComplete} {...rest} />
}
```

- `EmailField` sets `type="email"`, `inputMode="email"` and `autoComplete="email"`.
- On the sign-in form, pass `autoComplete="username"` to `EmailField`. With
  `current-password` on `PasswordField`, iOS Keychain then saves and fills the pair.
- A new wrapper of this kind needs a test and a `/styleguide` entry, the same as a
  primitive.

---

## 8. `DurationPicker`

Rest time, gym time, walk time. A tap-only duration input: a −/+ stepper and a row of
preset chips. **It parses nothing.** The value is integer seconds in and out, and it
formats with `formatDuration` from `lib/duration.ts`.

```tsx
'use client'

import { formatDuration, MAX_DURATION_SECONDS } from '../../lib/duration'

import { cn } from './cn'
import { MicroLabel } from './MicroLabel'

export const DEFAULT_STEP_SECONDS = 15

export const REST_PRESETS = [60, 90, 120, 180] as const

export const SESSION_PRESETS = [1800, 2700, 3600, 5400] as const

export const CARDIO_PRESETS = [900, 1800, 2700, 3600] as const

export const SESSION_STEP_SECONDS = 60

export const NOT_SET = 'Not set'

export type DurationPickerProps = {
  id: string
  label: string
  value: number | null
  onChange: (seconds: number | null) => void
  presets: readonly number[]
  step?: number
  min?: number
  max?: number
  allowClear?: boolean
  className?: string
}

const STEP_BUTTON =
  'bg-surface-2 border-border text-text inline-flex size-11 shrink-0 items-center justify-center rounded-full border text-xl font-bold disabled:opacity-50'

const CHIP =
  'inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-[13px] font-bold whitespace-nowrap'

export function clampSeconds(seconds: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, seconds))
}

export function stepSeconds(value: number | null, by: number, min: number, max: number): number {
  return clampSeconds((value ?? min) + by, min, max)
}

export function presetLabel(seconds: number): string {
  return formatDuration(seconds, seconds % 60 === 0 ? 'short' : 'clock')
}

export function stepWords(step: number): string {
  if (step % 60 === 0) {
    const minutes = step / 60

    return minutes === 1 ? '1 minute' : `${String(minutes)} minutes`
  }

  return step === 1 ? '1 second' : `${String(step)} seconds`
}

export function DurationPicker({
  id,
  label,
  value,
  onChange,
  presets,
  step = DEFAULT_STEP_SECONDS,
  min = 0,
  max = MAX_DURATION_SECONDS,
  allowClear = false,
  className,
}: DurationPickerProps) {
  const labelId = `${id}-label`
  const words = stepWords(step)

  return (
    <div
      id={id}
      role="group"
      aria-labelledby={labelId}
      className={cn('flex w-full min-w-0 flex-col gap-[7px]', className)}
    >
      <MicroLabel id={labelId}>{label}</MicroLabel>
      <div className="bg-surface border-border rounded-input flex items-center justify-between gap-2 border p-1">
        <button
          type="button"
          aria-label={`Decrease ${label} by ${words}`}
          disabled={value === null || value <= min}
          onClick={() => {
            onChange(stepSeconds(value, -step, min, max))
          }}
          className={STEP_BUTTON}
        >
          <span aria-hidden="true">−</span>
        </button>
        <output
          className={cn(
            'min-w-0 text-center text-lg font-extrabold tracking-[-0.4px]',
            value === null ? 'text-muted' : 'text-text',
          )}
        >
          {value === null ? NOT_SET : formatDuration(value, 'clock')}
        </output>
        <button
          type="button"
          aria-label={`Increase ${label} by ${words}`}
          disabled={value !== null && value >= max}
          onClick={() => {
            onChange(stepSeconds(value, step, min, max))
          }}
          className={STEP_BUTTON}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          const pressed = value === preset

          return (
            <button
              key={preset}
              type="button"
              aria-pressed={pressed}
              onClick={() => {
                onChange(clampSeconds(preset, min, max))
              }}
              className={cn(
                CHIP,
                pressed
                  ? 'bg-accent border-accent text-accent-ink'
                  : 'bg-surface-2 border-border text-muted',
              )}
            >
              {presetLabel(preset)}
            </button>
          )
        })}
        {allowClear && value !== null ? (
          <button
            type="button"
            onClick={() => {
              onChange(null)
            }}
            className={cn(CHIP, 'bg-surface-2 border-border text-text')}
          >
            Clear <span className="sr-only">{label}</span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
```

- The value is integer seconds in and out. It formats with `formatDuration` and parses
  nothing.
- The chips are `aria-pressed` toggles, the same look as `SegmentedTabs`.
- The −/+ buttons are 44 px circles with an `aria-label`. The step defaults to 15 s.
  Rest time keeps 15 s. Gym, walk and swim time pass `SESSION_STEP_SECONDS`, 60 s.
- `allowClear` adds a Clear chip while a value is set. Clear gives `null`.
- The chip row wraps. It never scrolls sideways.
- The `<output>` element has the `status` role, so a screen reader reads the new value
  after each tap. No `<input>`, so no keyboard opens on the phone.
- No duration in the app is typed. `lib/duration.ts` keeps `parseInput` for the CSV
  import.

---

## 9. `SegmentedTabs`

Day / Week / Month. A toggle button group, not a tab list. An accent pill marks the
pressed button.

```tsx
export function SegmentedTabs({ label, options, value, onValueChange }: SegmentedTabsProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className="bg-surface border-border inline-flex w-full gap-1 rounded-full border p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onValueChange(option.value)}
          className={cn(
            'h-11 flex-1 rounded-full px-4 text-sm font-bold',
            option.value === value ? 'bg-accent text-accent-ink' : 'text-muted',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
```

`h-11` is 44 px. The selected state is the accent fill **and** `aria-pressed`, so it is
not carried by colour alone.

It is `role="group"` with `aria-pressed`, never `role="tablist"` with `aria-selected`.
The buttons switch a value; they own no tab panels and no arrow key roving, so a tab
role would promise a screen reader behaviour that is not there.

---

## 10. `PrimaryButton` and `SecondaryButton`

54 px tall. Primary is the accent fill with `accent-ink` text. Secondary is
`surface-2` with a 1 px border. A destructive action is the secondary shape with
`text-danger`.

```tsx
const buttonTone = {
  primary: 'bg-accent text-accent-ink border-accent',
  secondary: 'bg-surface-2 text-text border-border',
  danger: 'bg-surface-2 text-danger border-border',
} as const

export function Button({
  tone = 'primary',
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: keyof typeof buttonTone }) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-input inline-flex min-h-[54px] w-full items-center justify-center gap-2 border px-4 text-[15px] font-bold',
        'disabled:opacity-50',
        buttonTone[tone],
        className,
      )}
      {...rest}
    />
  )
}
```

- Something that **does** a thing is this button. Something that **goes** somewhere is
  a `next/link`, styled the same way.
- In the live code the destructive shape is `SecondaryButton` with `tone="danger"`.
- An icon-only button carries an `aria-label`.
- Always set `type`. An unset button inside a form submits it.

---

## 11. `SheetModal`

A bottom sheet under 1024 px, a centred dialog at 1024 px and up. Used by the exercise
picker.

```tsx
export function SheetModal({ open, onClose, label, children }: SheetModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="bg-ground/70 absolute inset-0"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cn(
          'rounded-t-hero border-border bg-surface absolute inset-x-0 bottom-0 max-h-[78%] overflow-y-auto border-t px-5 pt-2.5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]',
          'lg:rounded-hero lg:inset-0 lg:m-auto lg:h-fit lg:max-h-[80vh] lg:w-[520px] lg:border',
        )}
      >
        <div
          className="bg-border mx-auto mt-1 mb-1.5 h-1 w-10 rounded-full lg:hidden"
          aria-hidden="true"
        />
        {children}
      </div>
    </div>
  )
}
```

- Focus moves into the sheet on open and returns to the opener on close.
- `Escape` closes it. The scrim is a real `button` so it is reachable by keyboard.
- The sheet's own content scrolls; the page behind it does not.

---

## Before you call a primitive done

- It is in `components/ui/`, with a test beside it.
- It has an entry in `/styleguide`.
- It matches the same component in `docs/design/prototype/index.html`.
- It passes all nine points in `references/checklist.md`.
