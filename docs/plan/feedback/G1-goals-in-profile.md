# Step G1 — 6 goals in Profile, and the week start fact

**Branch:** `fix/g1-goals-in-profile`, in worktree `../gym-tracker-g1`, cut from `fix/feedback-fixes` ·
**Wave:** 5 · **Size:** M · **Depends on:** W0, D1, E1, B4 · **Unlocks:** G2, G3a, H1 ·
**Skills to load:** `design-system` · **Agent to use:** `test-writer`, then `ui-reviewer`

## Before you start

1. Make the worktree:

   ```bash
   cd /Users/cefalo_1/Documents/Projects/gym-tracker
   git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-g1 -b fix/g1-goals-in-profile fix/feedback-fixes
   cd ../gym-tracker-g1
   cp ../gym-tracker/.env.local ../gym-tracker/.env.test.local .
   export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"
   pnpm install
   ```

   If you are already in that worktree on that branch, skip this block.

2. Dependency checks. Run them from the worktree root. Each line prints `FAIL` and the
   step name when that step is not in `fix/feedback-fixes`:

   ```bash
   test -f scripts/e2e-lock.mjs || echo "FAIL W0: scripts/e2e-lock.mjs is missing"
   grep -qs "gym_goal_seconds: goalSeconds" lib/schema/profile.ts || echo "FAIL D1: the goal columns are missing in lib/schema/profile.ts"
   grep -qs "STORES_V4" lib/db/dexie.ts || echo "FAIL D1: Dexie v5 is missing in lib/db/dexie.ts"
   grep -qs "export function DurationPicker" components/ui/DurationPicker.tsx || echo "FAIL E1: DurationPicker is missing"
   grep -qs "export const SAVED_MESSAGE" components/ui/Toast.tsx || echo "FAIL B4: SAVED_MESSAGE is missing in components/ui/Toast.tsx"
   grep -qs "useToast" components/profile/TargetsCard.tsx || echo "FAIL B4: TargetsCard does not show the Saved toast"
   ```

   If any check fails, the step it names is not merged into `fix/feedback-fixes`. Stop. Report which
   check failed. Do not do that step's work here.

3. Already done check:

   ```bash
   grep -qs "export const WEEK_START" components/profile/UnitsCard.tsx && echo "G1 is already done"
   ```

   If it prints, stop and report.

## Names this step uses from earlier steps

- D1, `lib/schema/profile.ts`. `profileSchema` gains these nullable columns, each with
  `.default(null)`:
  - `calorie_goal`: whole number, 1 to `MAX_CALORIES_BURNT`.
  - `gym_goal_seconds` and `walk_goal_seconds`: whole seconds, `MIN_GOAL_SECONDS` (60) to
    `MAX_DURATION_SECONDS` (86 400). Below 60 the message is
    `A time goal must be at least 1 minute.`
  - `sessions_per_week_goal`: whole number, 1 to `MAX_SESSIONS_PER_WEEK` (14). Above 14 the
    message is `A session goal cannot be above 14 a week.`
  - `birth_year`, `max_heart_rate`, `stats_layout`. This step does not use them.
- D1, `lib/db/dexie.ts`. The local `Profile` interface holds the 7 new fields as
  **optional**, so a read gives `number | null | undefined`. Every read uses `?? null`.
  `DATABASE_VERSION` is 5.
- E1, `components/ui/DurationPicker.tsx`:

  ```ts
  export const DEFAULT_STEP_SECONDS = 15
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
  export function DurationPicker(props: DurationPickerProps): JSX.Element
  ```

- B4, `components/ui/Toast.tsx`: `export const SAVED_MESSAGE = 'Saved'` and
  `export function useToast(): { show: (message: string) => void }`. Outside a
  `ToastProvider`, `useToast` returns a silent stand-in. B4 made `TargetsCard.commit` call
  `toast.show(SAVED_MESSAGE)` after a save, and added the test "shows the Saved toast after
  a target saves" to `TargetsCard.test.tsx`. Keep both.

## Context to read first

1. This file. "Names this step uses from earlier steps" holds the D1 goal columns and
   the `DurationPicker` props. Use them exactly.
2. `docs/specs/2026-10-05-feedback-fixes-design.md`, items 14 and 17, and section 3.1 (the
   ranges of each column).
3. `components/profile/targets.ts` and its test — `TARGET_FIELDS`, `targetLabel`,
   `targetText`, `parseTarget`. `parseTarget` reads the range from `profileSchema.shape`.
4. `components/profile/TargetsCard.tsx` and its test — save on blur, 1 error per field.
5. `components/profile/UnitsCard.tsx` and its test.
6. `components/profile/Profile.tsx`, `saveTarget` — it calls `updateProfile(patch)` and
   sets the returned row. No change there.
7. `components/ui/DurationPicker.tsx` from E1.
8. Plate `p6` "Profile" in `docs/design/prototype/index.html`.

## State before the step

- After D1, `profileSchema` and the Dexie `Profile` row hold `calorie_goal`,
  `gym_goal_seconds`, `walk_goal_seconds` and `sessions_per_week_goal`, all nullable, and
  they sync. In the local `Profile` interface they are **optional** (a row from before v5
  lacks them), so a read gives `number | null | undefined`. Every read below uses `?? null`.
  `PROFILE` in `tests/fixtures/dashboard.ts` may lack them; the tests do not depend on it.
- The Targets card edits only the target weight, the step goal and the height.
- Every week already starts on Monday (`weekOf` in `components/dashboard/summary.ts`).
  Nothing in Profile says so.

## Goal

Profile edits 6 goals: steps, calories, gym time, walk time, sessions per week and the
target weight. Profile shows "Week starts on Monday." as a fixed fact, not a setting.

## Decisions in this step

- The card's micro label becomes `Goals`. The height stays in it.
- The order: step goal, calorie goal, sessions per week, target weight, height, then the 2
  pickers: gym time goal and walk time goal.
- Calorie goal and sessions per week are `NumberField`s that save on blur, as today. A
  blank field saves `null`, which means "no goal". Only the step goal refuses a blank.
- Gym time and walk time are `DurationPicker`s with `allowClear`. Each change saves at
  once, the same as the unit toggle. The picker shows the new value at once. A failed save
  puts the stored value back and shows the error under the picker.
- The picker step is 5 minutes, not 15 s: a goal is a round number. `min` 60 and `max`
  86 400, the range of the column.
- The week start sits in the Units card, because it is a display fact like the unit.

## Do

1. Run the `test-writer` agent with the acceptance list. The tests come first.
2. `components/profile/targets.ts`:

   ```ts
   import { formatWeight, fromDisplayWeight, weightSymbol } from '../../lib/format/weight'
   import { profileSchema } from '../../lib/schema/profile'

   import type { Profile } from '../../lib/db/dexie'
   import type { UnitSystem } from '../../lib/schema/profile'

   export type TargetField =
     'step_goal' | 'calorie_goal' | 'sessions_per_week_goal' | 'target_weight_kg' | 'height_cm'

   export const TARGET_FIELDS: readonly TargetField[] = [
     'step_goal',
     'calorie_goal',
     'sessions_per_week_goal',
     'target_weight_kg',
     'height_cm',
   ]

   export type DurationTarget = 'gym_goal_seconds' | 'walk_goal_seconds'

   export const DURATION_TARGETS: readonly DurationTarget[] = [
     'gym_goal_seconds',
     'walk_goal_seconds',
   ]

   export const GOAL_PRESETS: Record<DurationTarget, readonly number[]> = {
     gym_goal_seconds: [2700, 3600, 5400, 7200],
     walk_goal_seconds: [1800, 2700, 3600, 5400],
   }

   export const GOAL_STEP_SECONDS = 300

   export const GOAL_MIN_SECONDS = 60

   export const GOAL_MAX_SECONDS = 86400

   export type TargetParse = { ok: true; patch: Partial<Profile> } | { ok: false; message: string }

   const LABEL: Record<Exclude<TargetField, 'target_weight_kg'>, string> = {
     step_goal: 'Daily step goal',
     calorie_goal: 'Daily calorie goal (kcal)',
     sessions_per_week_goal: 'Sessions per week goal',
     height_cm: 'Height (cm)',
   }

   const DURATION_LABEL: Record<DurationTarget, string> = {
     gym_goal_seconds: 'Daily gym time goal',
     walk_goal_seconds: 'Daily walk time goal',
   }

   export function targetLabel(field: TargetField, unit: UnitSystem): string {
     return field === 'target_weight_kg' ? `Target weight (${weightSymbol(unit)})` : LABEL[field]
   }

   export function durationLabel(field: DurationTarget): string {
     return DURATION_LABEL[field]
   }

   export function targetText(profile: Profile, field: TargetField, unit: UnitSystem): string {
     if (field === 'target_weight_kg') {
       const kg = profile.target_weight_kg

       return kg === null ? '' : formatWeight(kg, unit, 1)
     }

     const value = profile[field] ?? null

     return value === null ? '' : String(value)
   }

   function readNumber(text: string): number | null {
     const trimmed = text.trim()

     return trimmed === '' ? null : Number(trimmed)
   }

   function toStored(field: TargetField, value: number | null, unit: UnitSystem): number | null {
     if (field !== 'target_weight_kg' || value === null || !Number.isFinite(value)) {
       return value
     }

     return fromDisplayWeight(value, unit)
   }

   function checked(field: TargetField | DurationTarget, value: unknown): TargetParse {
     const result = profileSchema.shape[field].safeParse(value)

     if (!result.success) {
       return { ok: false, message: result.error.issues[0]?.message ?? 'Check this value.' }
     }

     return { ok: true, patch: { [field]: result.data } }
   }

   export function parseTarget(field: TargetField, text: string, unit: UnitSystem): TargetParse {
     const value = toStored(field, readNumber(text), unit)

     return checked(field, value ?? (field === 'step_goal' ? NaN : null))
   }

   export function parseDurationTarget(field: DurationTarget, seconds: number | null): TargetParse {
     return checked(field, seconds)
   }
   ```

   If `profileSchema` is no longer a plain `z.object` after D1 (a `.refine` hides
   `.shape`), read the shape from the object D1 refines, not a copy. Never re-declare a range.

3. `components/profile/TargetsCard.tsx`:

   ```tsx
   'use client'

   import { useState } from 'react'

   import { Card } from '../ui/Card'
   import { DurationPicker } from '../ui/DurationPicker'
   import { MicroLabel } from '../ui/MicroLabel'
   import { NumberField } from '../ui/NumberField'
   import { SAVED_MESSAGE, useToast } from '../ui/Toast'

   import {
     DURATION_TARGETS,
     durationLabel,
     GOAL_MAX_SECONDS,
     GOAL_MIN_SECONDS,
     GOAL_PRESETS,
     GOAL_STEP_SECONDS,
     parseDurationTarget,
     parseTarget,
     TARGET_FIELDS,
     targetLabel,
     targetText,
   } from './targets'

   import type { DurationTarget, TargetField } from './targets'
   import type { Profile } from '../../lib/db/dexie'
   import type { UnitSystem } from '../../lib/schema/profile'

   export const SAVE_FAILED = 'This target could not be saved on this device.'

   export const SAVED = 'Saved on this device.'

   export type TargetsCardProps = {
     profile: Profile
     unit: UnitSystem
     onSave: (patch: Partial<Profile>) => Promise<void>
     className?: string
   }

   type Drafts = Partial<Record<TargetField, string>>

   type Held = Partial<Record<DurationTarget, number | null>>

   type Errors = Partial<Record<TargetField | DurationTarget, string>>

   const DECIMAL: ReadonlySet<TargetField> = new Set(['target_weight_kg', 'height_cm'])

   export function TargetsCard({ profile, unit, onSave, className }: TargetsCardProps) {
     const [drafts, setDrafts] = useState<Drafts>({})
     const [held, setHeld] = useState<Held>({})
     const [errors, setErrors] = useState<Errors>({})
     const [saved, setSaved] = useState(false)
     const toast = useToast()

     function fail(field: TargetField | DurationTarget, message: string): void {
       setSaved(false)
       setErrors((current) => ({ ...current, [field]: message }))
     }

     function pass(field: TargetField | DurationTarget): void {
       setErrors((current) => ({ ...current, [field]: undefined }))
     }

     async function commit(field: TargetField): Promise<void> {
       const draft = drafts[field]

       if (draft === undefined || draft === targetText(profile, field, unit)) {
         pass(field)
         setDrafts((current) => ({ ...current, [field]: undefined }))
         return
       }

       const parsed = parseTarget(field, draft, unit)

       if (!parsed.ok) {
         fail(field, parsed.message)
         return
       }

       try {
         await onSave(parsed.patch)
         setSaved(true)
         toast.show(SAVED_MESSAGE)
         pass(field)
         setDrafts((current) => ({ ...current, [field]: undefined }))
       } catch {
         fail(field, SAVE_FAILED)
       }
     }

     function changeDuration(field: DurationTarget, seconds: number | null): void {
       const parsed = parseDurationTarget(field, seconds)

       if (!parsed.ok) {
         fail(field, parsed.message)
         return
       }

       setHeld((current) => ({ ...current, [field]: seconds }))
       onSave(parsed.patch).then(
         () => {
           setSaved(true)
           toast.show(SAVED_MESSAGE)
           pass(field)
         },
         () => {
           setHeld((current) => ({ ...current, [field]: undefined }))
           fail(field, SAVE_FAILED)
         },
       )
     }

     return (
       <Card className={className}>
         <MicroLabel as="p">Goals</MicroLabel>
         <div className="mt-2.5 grid gap-2.5">
           {TARGET_FIELDS.map((field) => (
             <NumberField
               key={field}
               label={targetLabel(field, unit)}
               inputMode={DECIMAL.has(field) ? 'decimal' : 'numeric'}
               value={drafts[field] ?? targetText(profile, field, unit)}
               error={errors[field]}
               onChange={(event) => {
                 setDrafts((current) => ({ ...current, [field]: event.target.value }))
               }}
               onBlur={() => {
                 void commit(field)
               }}
             />
           ))}
           {DURATION_TARGETS.map((field) => {
             const error = errors[field]

             return (
               <div key={field}>
                 <DurationPicker
                   id={`goal-${field}`}
                   label={durationLabel(field)}
                   value={held[field] === undefined ? (profile[field] ?? null) : held[field]}
                   onChange={(seconds) => {
                     changeDuration(field, seconds)
                   }}
                   presets={GOAL_PRESETS[field]}
                   step={GOAL_STEP_SECONDS}
                   min={GOAL_MIN_SECONDS}
                   max={GOAL_MAX_SECONDS}
                   allowClear
                 />
                 {error === undefined ? null : (
                   <p role="alert" className="text-danger mt-1.5 text-xs">
                     {error}
                   </p>
                 )}
               </div>
             )
           })}
         </div>
         <p role="status" className="text-muted mt-2.5 min-h-4 text-xs">
           {saved ? SAVED : ''}
         </p>
       </Card>
     )
   }
   ```

   `height_cm` was `numeric` before. It takes 1 decimal in the schema, so it becomes
   `decimal` here. Keep `numeric` if the owner wants no change; the test does not depend on it.

   The code keeps the B4 toast: `toast.show(SAVED_MESSAGE)` after each number save and
   after each picker save. Never drop it when you replace the file.

4. `components/profile/UnitsCard.tsx`: under the display-only line, add the week fact:

   ```tsx
   export const WEEK_START = 'Week starts on Monday.'
   ```

   ```tsx
   <p className="text-text mt-2.5 text-sm font-semibold">{WEEK_START}</p>
   <p className="text-muted mt-1 text-xs">Every week total and chart counts from Monday.</p>
   ```

   No control. It is text.

5. `components/profile/ProfileView.tsx`: no prop change. `TargetsCard` keeps
   `className="md:row-span-2"`. Check at 768 px that the taller card does not leave a hole
   in the grid; if it does, use `md:row-span-3`.
6. `/styleguide`: the Targets sample shows the new fields.
7. Plate `p6`: rename the card `Goals`, add the 3 new number fields with the ids
   `pr-calories` and `pr-sessions`, and 2 duration pickers drawn as in the E1 plate. Add the
   2 week lines to the Units card.

## Acceptance criteria

- [ ] `targetLabel` names the calorie goal and the sessions per week goal.
- [ ] `durationLabel` names the gym time goal and the walk time goal.
- [ ] `targetText` writes a stored calorie goal and sessions goal, and `''` for null.
- [ ] `parseTarget` saves a calorie goal, and `null` for a blank field.
- [ ] `parseTarget` refuses a calorie goal of 0 and a sessions goal of 15 with the schema message.
- [ ] `parseDurationTarget` saves 3600, saves `null`, and refuses 30 with the schema message.
- [ ] The card labels all 7 fields: 5 number fields and 2 pickers.
- [ ] A calorie goal saves on blur. A blank calorie goal saves `null`.
- [ ] A sessions goal of 15 is refused, tied to its field, and nothing saves.
- [ ] A gym time goal from the picker saves `{ gym_goal_seconds: 3600 }`.
- [ ] Clearing the walk time goal saves `{ walk_goal_seconds: null }`.
- [ ] A picker value under 60 s is refused with an alert, and nothing saves.
- [ ] The picker shows the new value before the save ends.
- [ ] A failed picker save puts the stored value back and shows `SAVE_FAILED`.
- [ ] The Units card says `Week starts on Monday.` and holds no control for it.
- [ ] Every control is 44 px or taller and has a label.
      Test: `tests/e2e/responsive.spec.ts` on `/profile`, and axe in the e2e suite.
- [ ] The B4 test "shows the Saved toast after a target saves" in
      `TargetsCard.test.tsx` still passes.
- [ ] A picker save also shows the `Saved` toast inside a `ToastProvider`. Test:
      `it('shows the Saved toast after a time goal saves')` in `TargetsCard.test.tsx`.
- [ ] A goal set on `/profile` is still there after a reload. Manual check at 390 px,
      768 px and 1440 px.
- [ ] `/styleguide` shows the `Goals` card with the 7 fields. Test:
      `app/styleguide/page.test.tsx`.
- [ ] Plate `p6` shows the `Goals` card and the 2 week lines. Manual check: the
      `ui-reviewer` agent reports no drift.

## Tests

`components/profile/targets.test.tsx`, add:

```tsx
import { profileSchema } from '../../lib/schema/profile'

import { durationLabel, parseDurationTarget, parseTarget, targetLabel, targetText } from './targets'

const GOALS = { ...PROFILE, calorie_goal: 800, sessions_per_week_goal: 4 }

function schemaMessage(
  field: 'calorie_goal' | 'sessions_per_week_goal' | 'gym_goal_seconds',
  value: number,
) {
  return profileSchema.shape[field].safeParse(value).error?.issues[0]?.message
}

describe('targetLabel for the goals', () => {
  it('names the calorie goal and the sessions per week goal', () => {
    expect(targetLabel('calorie_goal', 'metric')).toBe('Daily calorie goal (kcal)')
    expect(targetLabel('sessions_per_week_goal', 'metric')).toBe('Sessions per week goal')
  })
})

describe('durationLabel', () => {
  it('names the gym time goal and the walk time goal', () => {
    expect(durationLabel('gym_goal_seconds')).toBe('Daily gym time goal')
    expect(durationLabel('walk_goal_seconds')).toBe('Daily walk time goal')
  })
})

describe('targetText for the goals', () => {
  it('writes a stored calorie goal and sessions goal', () => {
    expect(targetText(GOALS, 'calorie_goal', 'metric')).toBe('800')
    expect(targetText(GOALS, 'sessions_per_week_goal', 'metric')).toBe('4')
  })

  it('leaves an unset goal blank', () => {
    expect(targetText(PROFILE, 'calorie_goal', 'metric')).toBe('')
  })
})

describe('parseTarget for the goals', () => {
  it('stores a whole calorie goal', () => {
    expect(parseTarget('calorie_goal', '800', 'metric')).toEqual({
      ok: true,
      patch: { calorie_goal: 800 },
    })
  })

  it('clears the calorie goal when the field is blank', () => {
    expect(parseTarget('calorie_goal', ' ', 'metric')).toEqual({
      ok: true,
      patch: { calorie_goal: null },
    })
  })

  it('refuses a calorie goal of 0 with the schema message', () => {
    expect(parseTarget('calorie_goal', '0', 'metric')).toEqual({
      ok: false,
      message: schemaMessage('calorie_goal', 0),
    })
  })

  it('refuses 15 sessions a week with the schema message', () => {
    expect(parseTarget('sessions_per_week_goal', '15', 'metric')).toEqual({
      ok: false,
      message: schemaMessage('sessions_per_week_goal', 15),
    })
  })
})

describe('parseDurationTarget', () => {
  it('stores a gym time goal in seconds', () => {
    expect(parseDurationTarget('gym_goal_seconds', 3600)).toEqual({
      ok: true,
      patch: { gym_goal_seconds: 3600 },
    })
  })

  it('stores no goal as null', () => {
    expect(parseDurationTarget('walk_goal_seconds', null)).toEqual({
      ok: true,
      patch: { walk_goal_seconds: null },
    })
  })

  it('refuses a goal under 1 minute with the schema message', () => {
    expect(parseDurationTarget('gym_goal_seconds', 30)).toEqual({
      ok: false,
      message: schemaMessage('gym_goal_seconds', 30),
    })
  })
})
```

`components/profile/TargetsCard.test.tsx`. The picker is E1's unit, with its own tests.
Here a stand-in proves the wiring. Add the mock at the top, and these cases:

```tsx
vi.mock('../ui/DurationPicker', () => ({
  DurationPicker: ({
    id,
    label,
    value,
    onChange,
  }: {
    id: string
    label: string
    value: number | null
    onChange: (seconds: number | null) => void
  }) => (
    <div>
      <span id={id}>{`${label}: ${value === null ? 'none' : String(value)}`}</span>
      <button
        type="button"
        onClick={() => {
          onChange(3600)
        }}
      >{`Set ${label}`}</button>
      <button
        type="button"
        onClick={() => {
          onChange(null)
        }}
      >{`Clear ${label}`}</button>
      <button
        type="button"
        onClick={() => {
          onChange(30)
        }}
      >{`Short ${label}`}</button>
    </div>
  ),
}))
```

```tsx
describe('TargetsCard goals', () => {
  it('labels the calorie goal and the sessions per week goal', () => {
    renderCard()
    expect(screen.getByLabelText('Daily calorie goal (kcal)')).toHaveValue('')
    expect(screen.getByLabelText('Sessions per week goal')).toHaveValue('')
  })

  it('shows the 2 duration goals', () => {
    renderCard()
    expect(screen.getByText('Daily gym time goal: none')).toBeInTheDocument()
    expect(screen.getByText('Daily walk time goal: none')).toBeInTheDocument()
  })

  it('saves a calorie goal when the field loses focus', async () => {
    const onSave = renderCard()
    await userEvent.type(screen.getByLabelText('Daily calorie goal (kcal)'), '800')
    await userEvent.tab()
    expect(onSave).toHaveBeenCalledWith({ calorie_goal: 800 })
  })

  it('saves no calorie goal when the field is cleared', async () => {
    const onSave = vi.fn(() => Promise.resolve())
    render(<TargetsCard profile={{ ...SET, calorie_goal: 800 }} unit="metric" onSave={onSave} />)
    await userEvent.clear(screen.getByLabelText('Daily calorie goal (kcal)'))
    await userEvent.tab()
    expect(onSave).toHaveBeenCalledWith({ calorie_goal: null })
  })

  it('refuses 15 sessions a week and ties the message to the field', async () => {
    const onSave = renderCard()
    const field = screen.getByLabelText('Sessions per week goal')
    await userEvent.type(field, '15')
    await userEvent.tab()
    expect(onSave).not.toHaveBeenCalled()
    expect(field).toHaveAttribute('aria-invalid', 'true')
  })

  it('saves a gym time goal from the picker', async () => {
    const onSave = renderCard()
    await userEvent.click(screen.getByRole('button', { name: 'Set Daily gym time goal' }))
    expect(onSave).toHaveBeenCalledWith({ gym_goal_seconds: 3600 })
    expect(await screen.findByText(SAVED)).toBeInTheDocument()
  })

  it('saves no walk time goal when the picker is cleared', async () => {
    const onSave = vi.fn(() => Promise.resolve())
    render(
      <TargetsCard profile={{ ...SET, walk_goal_seconds: 1800 }} unit="metric" onSave={onSave} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Clear Daily walk time goal' }))
    expect(onSave).toHaveBeenCalledWith({ walk_goal_seconds: null })
  })

  it('refuses a picker goal under 1 minute and saves nothing', async () => {
    const onSave = renderCard()
    await userEvent.click(screen.getByRole('button', { name: 'Short Daily gym time goal' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows the picked value before the save ends', async () => {
    renderCard(vi.fn(() => new Promise<void>(() => undefined)))
    await userEvent.click(screen.getByRole('button', { name: 'Set Daily gym time goal' }))
    expect(screen.getByText('Daily gym time goal: 3600')).toBeInTheDocument()
  })

  it('puts the stored value back when the picker save fails', async () => {
    renderCard(vi.fn(() => Promise.reject(new Error('locked'))))
    await userEvent.click(screen.getByRole('button', { name: 'Set Daily gym time goal' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(SAVE_FAILED)
    expect(screen.getByText('Daily gym time goal: none')).toBeInTheDocument()
  })

  it('shows the Saved toast after a time goal saves', async () => {
    render(
      <ToastProvider>
        <TargetsCard profile={SET} unit="metric" onSave={vi.fn(() => Promise.resolve())} />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Set Daily gym time goal' }))
    expect(await screen.findByTestId('toast-region')).toHaveTextContent(SAVED_MESSAGE)
  })
})
```

Import `{ SAVED_MESSAGE, ToastProvider }` from `'../ui/Toast'` at the top of the test file,
if B4 did not already.

`components/profile/UnitsCard.test.tsx`, add:

```tsx
it('states that the week starts on Monday, with no control for it', () => {
  render(<UnitsCard unit="metric" onUnitChange={vi.fn()} />)
  expect(screen.getByText(WEEK_START)).toBeVisible()
  expect(screen.getAllByRole('button')).toHaveLength(2)
})
```

## Verification

1. `pnpm test:cov`.
2. The `ui-reviewer` agent reports no drift against plate `p6`.
3. Check `/profile` at 390 px, 768 px and 1440 px. Set each goal, reload, and see it kept.
4. `pnpm verify:parallel`.

## Files touched

- `components/profile/targets.ts` and its test
- `components/profile/TargetsCard.tsx` and its test
- `components/profile/UnitsCard.tsx` and its test
- `components/profile/ProfileView.tsx`, only if the row span changes
- `app/styleguide/page.tsx` and its test
- `docs/design/prototype/index.html` (plate `p6`)

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer when
   another step runs its e2e suite. Never skip a check, and never add a design-check or
   test exemption to pass.
2. Stage the files of step 3 with the same `git add` line first. The skill describes the
   staged diff, and it refuses to run when nothing is staged. Then run the `commit-report`
   skill.
   The report needs screenshots of every changed page at 390, 768 and 1440 px, next
   to the matching prototype plate.
3. Commit on `fix/g1-goals-in-profile`:

   ```bash
   git add components/profile/targets.ts \
     components/profile/targets.test.tsx \
     components/profile/TargetsCard.tsx \
     components/profile/TargetsCard.test.tsx \
     components/profile/UnitsCard.tsx \
     components/profile/UnitsCard.test.tsx \
     components/profile/ProfileView.tsx \
     app/styleguide/page.tsx \
     app/styleguide/page.test.tsx \
     docs/design/prototype/index.html
   git commit -m "feat(ui): edit 6 goals in profile and state the week start"
   ```

   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.

4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked,
   and anything the owner must check on the iPhone.
