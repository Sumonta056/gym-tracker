# Step E1 — The `DurationPicker` primitive

**Branch:** `fix/e1-duration-picker`, in worktree `../gym-tracker-e1`, cut from `fix/feedback-fixes` ·
**Wave:** 1 · **Size:** M · **Depends on:** W0 · **Unlocks:** E2, G1 ·
**Agent to use:** `test-writer` for the tests, then `ui-reviewer`
**Items:** 3 · **Skills to load:** `design-system`

## Before you start

### The worktree

```bash
cd /Users/cefalo_1/Documents/Projects/gym-tracker
git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-e1 -b fix/e1-duration-picker fix/feedback-fixes
cd ../gym-tracker-e1
cp ../gym-tracker/.env.local ../gym-tracker/.env.test.local .
export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"
pnpm install
```

If you are already in that worktree on that branch, skip this block. Run every command
below from the worktree root. Each new shell needs the `export PATH` line again before
`pnpm`.

### Dependency checks

Each line prints `FAIL` and the step name when that step is not merged into `fix/feedback-fixes`.

```bash
{ test -f scripts/e2e-lock.mjs && grep -q '"verify:parallel"' package.json; } || echo "FAIL: W0 is not merged (no scripts/e2e-lock.mjs or no verify:parallel script)"
echo "Dependency checks finished."
```

If any check fails, the step it names is not merged into `fix/feedback-fixes`. Stop. Report which check
failed. Do not do that step's work here.

### Already done check

```bash
test -f components/ui/DurationPicker.tsx && echo "DONE: E1 is already on this branch"
```

If it passes, stop and report.

## Context to read first

1. The names in **Do** step 2 are fixed. E2, E3, E5 and G1 import them by these exact
   names: `DurationPicker`, `DurationPickerProps`, `REST_PRESETS`, `SESSION_PRESETS`,
   `DEFAULT_STEP_SECONDS` and `NOT_SET`. Use the props and the 2 preset lists exactly as
   written there.
2. `docs/specs/2026-10-05-feedback-fixes-design.md`, section 3.7, and item 3 in section 1.
3. Load the `design-system` skill. Read `references/components.md`, sections 8
   (`DurationField`) and 9 (`SegmentedTabs`). The chip style comes from
   `SegmentedTabs`.
4. `.claude/rules/accessibility.md`.
5. `lib/duration.ts` — `formatDuration` and `MAX_DURATION_SECONDS`. The picker
   parses nothing. It only formats.
6. `components/ui/SegmentedTabs.tsx` and its test — the `aria-pressed` pattern.
7. `components/ui/DurationField.test.tsx` — the test style with a `Harness`.
8. `app/styleguide/page.tsx`, section "Fields", and `app/styleguide/page.test.tsx`.
9. `docs/design/prototype/index.html`, the `.pill` rule and plate 07, "Rest timer".

## Names this step uses from earlier steps

- W0: `pnpm verify:parallel`.
- Before this step: `formatDuration(seconds, style)` and `MAX_DURATION_SECONDS` in
  `lib/duration.ts`, `MAX_REST_SECONDS = 3600` in `lib/schema/profile.ts`, and
  `MicroLabel` and `cn` in `components/ui/`.
- This step runs in the same wave as A1, B1, C1 and C2. Some of them may also add to
  `app/styleguide/page.tsx` and `docs/design/prototype/index.html`. The merge keeps both
  additions. Take the plate number from the file in this worktree.

## State before the step

- Every duration on screen is typed as text. `DurationField` and the rest time sheet
  parse it with `parseInput`. "90" means 90 minutes.
- No component sets a duration with taps only.
- `swim_seconds` does not exist yet. D1 adds it in a later wave. This step does not
  need it.

## Goal

A tap-only duration input exists, is tested, and shows in `/styleguide` and in the
prototype. No screen uses it yet. E2 puts it in use.

## Do

1. Run the `test-writer` agent with the acceptance list below. The tests come first, in
   `components/ui/DurationPicker.test.tsx`.
2. Create `components/ui/DurationPicker.tsx`. It exports the index names, 3 pure
   helpers and the component. `className` is extra to the index props, because every
   primitive takes one (`references/components.md`, "House rules").

   ```tsx
   'use client'

   import { formatDuration, MAX_DURATION_SECONDS } from '../../lib/duration'

   import { cn } from './cn'
   import { MicroLabel } from './MicroLabel'

   export const DEFAULT_STEP_SECONDS = 15

   export const REST_PRESETS = [60, 90, 120, 180] as const

   export const SESSION_PRESETS = [1800, 2700, 3600, 5400] as const

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

   - The `<output>` element has the `status` role, so a screen reader reads the new
     value after each tap.
   - `MicroLabel` spreads its other props onto its element, so `id` reaches the
     `<span>` that `aria-labelledby` points at.
   - The −/+ buttons show a glyph only, so they carry an `aria-label`. The chips and
     Clear carry visible text, so their name is their text (voice control finds them).
   - No `<input>`. No keyboard opens on the phone.

3. Add a `/styleguide` entry. In `app/styleguide/page.tsx`, section "Fields", add 1 card
   after the `duration-sample` card:

   ```tsx
   <Card
     className="flex flex-col gap-4"
     data-testid="duration-picker-sample"
     data-ready={hydrated ? 'true' : 'false'}
   >
     <DurationPicker
       id="sample-rest-picker"
       label="Rest time"
       value={pickerRest}
       onChange={(next) => {
         if (next !== null) {
           setPickerRest(next)
         }
       }}
       presets={REST_PRESETS}
       max={MAX_REST_SECONDS}
     />
     <DurationPicker
       id="sample-gym-picker"
       label="Gym time"
       value={pickerGym}
       onChange={setPickerGym}
       presets={SESSION_PRESETS}
       allowClear
     />
     <p className="text-muted text-xs">
       {`Rest seconds: ${String(pickerRest)} · Gym seconds: ${pickerGym === null ? 'none' : String(pickerGym)}`}
     </p>
   </Card>
   ```

   State: `const [pickerRest, setPickerRest] = useState(90)` and
   `const [pickerGym, setPickerGym] = useState<number | null>(null)`. Import
   `MAX_REST_SECONDS` from `lib/schema/profile`.

4. Add the prototype plate. In `docs/design/prototype/index.html`:
   - Add these rules to the `<style>` block, after `.pill[aria-pressed='true']`:

     ```css
     .dp {
       display: flex;
       flex-direction: column;
       gap: 7px;
     }

     .dp-row {
       display: flex;
       align-items: center;
       justify-content: space-between;
       gap: 8px;
       padding: 4px;
       border: 1px solid var(--color-border);
       border-radius: var(--radius-input);
       background: var(--color-surface);
     }

     .dp-step {
       width: 44px;
       height: 44px;
       border-radius: var(--radius-pill);
       border: 1px solid var(--color-border);
       background: var(--color-surface-2);
       color: var(--color-text);
       font-size: 20px;
       font-weight: 700;
     }

     .dp-step:disabled {
       opacity: 0.5;
     }

     .dp-value {
       font-size: 18px;
       font-weight: 800;
       letter-spacing: -0.4px;
     }

     .dp-chips {
       display: flex;
       flex-wrap: wrap;
       gap: 8px;
     }
     ```

   - Add a new plate after the last numbered plate in `<main>`. Use the next free plate
     number (12, unless an earlier step of this track took it). The plate shows the rest
     sheet with the picker, which is the first screen E2 changes:

     ```html
     <!-- ============ 12 · duration picker ============
          New classes: dp, dp-row, dp-step, dp-value, dp-chips. -->
     <section class="plate" aria-labelledby="p-duration-picker">
       <div class="plate-label">
         <span class="n">12</span>
         <span class="name" id="p-duration-picker">Duration picker</span>
         <span class="route">/workout · rest sheet</span>
       </div>
       <div class="frame">
         <div class="screen" aria-hidden="true">
           <div class="topbar">
             <div>
               <h2>Session</h2>
               <p class="sub">Started 17:30</p>
             </div>
           </div>
         </div>
         <div class="scrim"></div>
         <div class="bottomsheet" role="dialog" aria-modal="true" aria-labelledby="dp-title">
           <div class="grabber" aria-hidden="true"></div>
           <span class="micro" id="dp-title">Rest for Bench press</span>
           <p class="muted" style="margin: 0">
             The next rest after this exercise uses the new time.
           </p>
           <div class="dp" role="group" aria-labelledby="dp-label">
             <span class="micro" id="dp-label">Rest time</span>
             <div class="dp-row">
               <button class="dp-step" type="button" aria-label="Decrease Rest time by 15 seconds">
                 <span aria-hidden="true">−</span>
               </button>
               <output class="dp-value">1:30</output>
               <button class="dp-step" type="button" aria-label="Increase Rest time by 15 seconds">
                 <span aria-hidden="true">+</span>
               </button>
             </div>
             <div class="dp-chips">
               <button class="pill" type="button" aria-pressed="false">1m</button>
               <button class="pill" type="button" aria-pressed="true">1:30</button>
               <button class="pill" type="button" aria-pressed="false">2m</button>
               <button class="pill" type="button" aria-pressed="false">3m</button>
             </div>
           </div>
           <button class="btn" type="button">Save rest time</button>
         </div>
       </div>
     </section>
     ```

5. Add a section `## 8b. DurationPicker` to
   `.claude/skills/design-system/references/components.md`, after section 8. Copy the
   component from step 2 and add these rules:
   - The value is integer seconds in and out. It formats with `formatDuration` and
     parses nothing.
   - The chips are `aria-pressed` toggles, the same look as `SegmentedTabs`.
   - The −/+ buttons are 44 px circles with an `aria-label`. The step defaults to 15 s.
   - `allowClear` adds a Clear chip while a value is set. Clear gives `null`.
   - The chip row wraps. It never scrolls sideways.

## Acceptance criteria

- [ ] `stepWords` reads 15 as "15 seconds", 1 as "1 second", 60 as "1 minute" and 300
      as "5 minutes".
- [ ] `presetLabel` reads 90 as "1:30", 60 as "1m", 3600 as "1h" and 5400 as "1h 30m".
- [ ] `stepSeconds` adds the step to `null` from `min`, and clamps at `min` and at `max`.
- [ ] The picker is a `group` named by its visible label.
- [ ] The picker shows its value through `formatDuration(value, 'clock')`, and "Not
      set" for `null`.
- [ ] Each preset is a `button` with `aria-pressed`. Only the chip equal to the value is
      pressed.
- [ ] A tap on a preset hands its seconds to `onChange`.
- [ ] A preset above `max` hands `max` to `onChange`.
- [ ] The + button adds the step. The − button takes the step off.
- [ ] The −/+ buttons are named "Decrease Rest time by 15 seconds" and "Increase Rest
      time by 15 seconds". A step of 60 names them "by 1 minute".
- [ ] The − button is disabled at `min` and for `null`. The + button is disabled at
      `max`.
- [ ] With `allowClear` and a value, a Clear button hands `null` to `onChange`. With no
      value, or with no `allowClear`, there is no Clear button.
- [ ] Every button carries `type="button"` and the `min-h-11` or `size-11` class.
- [ ] The picker holds no text field.
- [ ] `/styleguide` shows the picker sample, and a tap on a preset changes the stored
      seconds line.
- [ ] The prototype has the "Duration picker" plate.
- [ ] `.claude/skills/design-system/references/components.md` has the section
      `8b. DurationPicker`. Check: `grep -n "8b. DurationPicker"` on that file.
- [ ] No screen other than `/styleguide` uses the picker. Check:
      `grep -rln "DurationPicker" app components` lists only the picker, its test,
      `app/styleguide/page.tsx` and its test.
- [ ] `pnpm design:check` passes: no raw hex, a `type` on every button.
- [ ] Manual: at 390, 768 and 1440 px the chips wrap, nothing scrolls sideways, and
      each button is 44 px tall (**Verification** 3, screenshots in the report).
- [ ] The `ui-reviewer` agent reports no drift on `components/ui/DurationPicker.tsx`.

## Tests

`components/ui/DurationPicker.test.tsx`, one `it` per criterion 1 to 14. Use a
`Harness` with `useState`, as `DurationField.test.tsx` does:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import {
  DurationPicker,
  NOT_SET,
  presetLabel,
  REST_PRESETS,
  stepSeconds,
  stepWords,
} from './DurationPicker'

function Harness({
  initial = 90,
  allowClear = false,
  max,
  step,
  onSeen = () => undefined,
}: {
  initial?: number | null
  allowClear?: boolean
  max?: number
  step?: number
  onSeen?: (seconds: number | null) => void
}) {
  const [value, setValue] = useState<number | null>(initial)

  return (
    <DurationPicker
      id="rest"
      label="Rest time"
      value={value}
      onChange={(next) => {
        onSeen(next)
        setValue(next)
      }}
      presets={REST_PRESETS}
      allowClear={allowClear}
      max={max}
      step={step}
    />
  )
}

function group() {
  return screen.getByRole('group', { name: 'Rest time' })
}

describe('stepWords', () => {
  it('names a step under a minute in seconds', () => {
    expect(stepWords(15)).toBe('15 seconds')
    expect(stepWords(1)).toBe('1 second')
  })

  it('names a whole minute step in minutes', () => {
    expect(stepWords(60)).toBe('1 minute')
    expect(stepWords(300)).toBe('5 minutes')
  })
})

describe('presetLabel', () => {
  it('writes a whole minute short and any other value as a clock', () => {
    expect(presetLabel(90)).toBe('1:30')
    expect(presetLabel(60)).toBe('1m')
    expect(presetLabel(3600)).toBe('1h')
    expect(presetLabel(5400)).toBe('1h 30m')
  })
})

describe('stepSeconds', () => {
  it('starts from min when there is no value', () => {
    expect(stepSeconds(null, 15, 0, 3600)).toBe(15)
  })

  it('never goes below min or above max', () => {
    expect(stepSeconds(10, -15, 0, 3600)).toBe(0)
    expect(stepSeconds(3590, 15, 0, 3600)).toBe(3600)
  })
})

describe('DurationPicker', () => {
  it('is a group named by its visible label', () => {
    render(<Harness />)
    expect(group()).toBeInTheDocument()
  })

  it('shows the value as a clock, and Not set when there is none', () => {
    const { unmount } = render(<Harness initial={90} />)
    expect(within(group()).getByRole('status')).toHaveTextContent('1:30')
    unmount()
    render(<Harness initial={null} />)
    expect(within(group()).getByRole('status')).toHaveTextContent(NOT_SET)
  })

  it('presses only the preset equal to the value', () => {
    render(<Harness initial={90} />)
    expect(within(group()).getByRole('button', { name: '1:30' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    for (const name of ['1m', '2m', '3m']) {
      expect(within(group()).getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('hands the preset seconds to its owner', async () => {
    const onSeen = vi.fn()
    render(<Harness onSeen={onSeen} />)
    await userEvent.click(within(group()).getByRole('button', { name: '2m' }))
    expect(onSeen).toHaveBeenLastCalledWith(120)
  })

  it('hands max for a preset above max', async () => {
    const onSeen = vi.fn()
    render(<Harness max={100} onSeen={onSeen} />)
    await userEvent.click(within(group()).getByRole('button', { name: '3m' }))
    expect(onSeen).toHaveBeenLastCalledWith(100)
  })

  it('adds and takes off one step', async () => {
    render(<Harness initial={90} />)
    await userEvent.click(screen.getByRole('button', { name: 'Increase Rest time by 15 seconds' }))
    expect(within(group()).getByRole('status')).toHaveTextContent('1:45')
    await userEvent.click(screen.getByRole('button', { name: 'Decrease Rest time by 15 seconds' }))
    await userEvent.click(screen.getByRole('button', { name: 'Decrease Rest time by 15 seconds' }))
    expect(within(group()).getByRole('status')).toHaveTextContent('1:15')
  })

  it('names the step buttons by a minute step', () => {
    render(<Harness step={60} />)
    expect(screen.getByRole('button', { name: 'Increase Rest time by 1 minute' })).toBeVisible()
  })

  it('turns the minus button off at min and with no value, and the plus button off at max', () => {
    const { unmount } = render(<Harness initial={0} />)
    expect(screen.getByRole('button', { name: /^Decrease/ })).toBeDisabled()
    unmount()
    const second = render(<Harness initial={null} />)
    expect(screen.getByRole('button', { name: /^Decrease/ })).toBeDisabled()
    second.unmount()
    render(<Harness initial={100} max={100} />)
    expect(screen.getByRole('button', { name: /^Increase/ })).toBeDisabled()
  })

  it('clears to null when clear is allowed and a value is set', async () => {
    const onSeen = vi.fn()
    render(<Harness allowClear onSeen={onSeen} />)
    await userEvent.click(screen.getByRole('button', { name: 'Clear Rest time' }))
    expect(onSeen).toHaveBeenLastCalledWith(null)
    expect(screen.queryByRole('button', { name: 'Clear Rest time' })).not.toBeInTheDocument()
  })

  it('shows no clear button without allowClear', () => {
    render(<Harness />)
    expect(screen.queryByRole('button', { name: /^Clear/ })).not.toBeInTheDocument()
  })

  it('gives every button a type and a 44 px target', () => {
    render(<Harness allowClear />)
    for (const button of within(group()).getAllByRole('button')) {
      expect(button).toHaveAttribute('type', 'button')
      expect(button.className).toMatch(/\b(min-h-11|size-11)\b/)
    }
  })

  it('holds no text field, so no keyboard opens', () => {
    render(<Harness />)
    expect(within(group()).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(group()).queryByRole('spinbutton')).not.toBeInTheDocument()
  })
})
```

`app/styleguide/page.test.tsx`, 1 new `it` for criterion 15:

```tsx
it('sets the picker sample with taps only', async () => {
  const sample = within(screen.getByTestId('duration-picker-sample'))
  await userEvent.click(
    within(sample.getByRole('group', { name: 'Gym time' })).getByRole('button', { name: '45m' }),
  )
  expect(sample.getByText('Rest seconds: 90 · Gym seconds: 2700')).toBeInTheDocument()
})
```

Criterion 16 is checked by eye in the report.

## Verification

1. `pnpm test:cov`. `components/**` stays at 85 lines, 75 branches, 85 functions.
2. `pnpm design:check`. No raw hex, a `type` on every button.
3. Open `/styleguide` at 390, 768 and 1440 px. The chips wrap. Nothing scrolls sideways.
   Each button is 44 px tall.
4. Run the `ui-reviewer` agent on `components/ui/DurationPicker.tsx` and the style guide.
5. `pnpm verify:parallel`.

## Files touched

- `components/ui/DurationPicker.tsx` and its test (new)
- `app/styleguide/page.tsx` and its test
- `docs/design/prototype/index.html`
- `.claude/skills/design-system/references/components.md`

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer
   when another step runs its e2e suite. Never skip a check, and never add a
   design-check or test exemption to pass.
2. Run the `commit-report` skill. The report needs screenshots of every changed page at 390, 768 and 1440 px, next to the matching prototype plate: `/styleguide`, section "Fields", next to the new Duration picker plate.
3. Commit on `fix/e1-duration-picker`:
   ```bash
   git add components/ui/DurationPicker.tsx \
     components/ui/DurationPicker.test.tsx \
     app/styleguide/page.tsx \
     app/styleguide/page.test.tsx \
     docs/design/prototype/index.html \
     .claude/skills/design-system/references/components.md
   git commit -m "feat(ui): add the duration picker primitive"
   ```
   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.
4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked,
   and anything the owner must check on the iPhone. No real screen changes yet. On the iPhone the owner looks at `/styleguide`: the chips wrap and no tap opens the keyboard.
