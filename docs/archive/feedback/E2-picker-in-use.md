# Step E2 — The picker for rest, gym and walk time

**Branch:** `fix/e2-picker-in-use`, in worktree `../gym-tracker-e2`, cut from `fix/feedback-fixes` ·
**Wave:** 5 · **Size:** S · **Depends on:** W0, E1, B3, B4 · **Unlocks:** E3 ·
**Agent to use:** `test-writer` for the tests, then `ui-reviewer`
**Items:** 3 · **Skills to load:** `design-system`

## Before you start

### The worktree

```bash
cd /Users/cefalo_1/Documents/Projects/gym-tracker
git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-e2 -b fix/e2-picker-in-use fix/feedback-fixes
cd ../gym-tracker-e2
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
{ grep -q "export function DurationPicker" components/ui/DurationPicker.tsx && grep -q "export const SESSION_PRESETS" components/ui/DurationPicker.tsx; } || echo "FAIL: E1 is not merged (no DurationPicker or SESSION_PRESETS)"
{ grep -q "createPortal" components/ui/SheetModal.tsx && test -f tests/e2e/sheet.spec.ts; } || echo "FAIL: B3 is not merged (SheetModal has no createPortal, or no tests/e2e/sheet.spec.ts)"
{ grep -q "export const SAVED_MESSAGE" components/ui/Toast.tsx && test -f tests/e2e/saved-toast.spec.ts; } || echo "FAIL: B4 is not merged (no SAVED_MESSAGE in components/ui/Toast.tsx)"
echo "Dependency checks finished."
```

If any check fails, the step it names is not merged into `fix/feedback-fixes`. Stop. Report which check
failed. Do not do that step's work here.

### Already done check

```bash
grep -q "export const CARDIO_PRESETS" components/ui/DurationPicker.tsx && echo "DONE: E2 is already on this branch"
```

If it passes, stop and report.

## Stop and ask the owner

This step meets an open owner decision. Ask it before you write any code:

> Gym, walk and swim time step by 60 s in the picker (`SESSION_STEP_SECONDS = 60`), not
> by the 15 s default, because 15 s steps over an hour need too many taps. Rest time
> keeps 15 s. Keep 60 s for gym, walk and swim, or use another step?

Stop, report the question, and wait for the answer. Do not choose. If the message that
gave you this file already answers it, follow that answer and quote it in the report.
If the owner picks another step, use that number for `SESSION_STEP_SECONDS`, and change
every "by 1 minute" name in the tests below to the words `stepWords` gives for it.

## Context to read first

1. **Names this step uses from earlier steps** below.
2. `docs/specs/2026-10-05-feedback-fixes-design.md`, section 3.7, and item 3.
3. Load the `design-system` skill. Read `references/components.md`, sections 8 and 8b.
4. `components/ui/DurationPicker.tsx` from E1.
5. `components/workout/RestTimeSheet.tsx` and its test.
6. `components/DailyEntryForm.tsx` and its test.
7. `components/workout/LiveSession.test.tsx`, `describe('changing the rest time')`.
8. `app/styleguide/page.tsx` and its test: the `duration-sample` card and the rest
   sheet sample.
9. `tests/e2e/support/signedIn.ts` (`openRoute`, `recordDay`), `tests/e2e/log.spec.ts`,
   `tests/e2e/dashboard.spec.ts`, `tests/e2e/journey.spec.ts`,
   `tests/e2e/offline.spec.ts`, `tests/e2e/security.spec.ts`.

## Names this step uses from earlier steps

From E1, `components/ui/DurationPicker.tsx`:

```ts
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
export function DurationPicker(props: DurationPickerProps)
export function stepWords(step: number): string
export function presetLabel(seconds: number): string
```

- The picker is a `group` named by `label`. Its value is an `<output>`, role `status`.
- The step buttons are named `Increase <label> by <stepWords(step)>` and
  `Decrease <label> by <stepWords(step)>`. Clear is named `Clear <label>`.
- A chip is named by `presetLabel`: `1m`, `1:30`, `2m`, `3m`, `30m`, `45m`, `1h`,
  `1h 30m`.
- `/styleguide` has the card `data-testid="duration-picker-sample"` with a "Rest time"
  picker (max `MAX_REST_SECONDS`), a "Gym time" picker (`allowClear`, the default 15 s
  step) and the line `Rest seconds: 90 · Gym seconds: none`.

From B3:

- `components/ui/SheetModal.tsx` renders through `createPortal`, with an iOS scroll lock
  and a `footer?: ReactNode` prop.
- `RestTimeSheet` keeps its Save button in the sheet `footer`:
  `<PrimaryButton type="submit" form={formId} disabled={busy}>Save rest time</PrimaryButton>`,
  with `formId` from `useId()`. `RestTimeForm` takes `{ id, changing, error, onSave }`
  and puts `id={id}` on its `<form>`. It holds no Save button and no `busy` prop.

From B4, `components/ui/Toast.tsx`:

- `ToastProvider`, `useToast(): { show: (message: string) => void }`, `TOAST_MS = 2000`
  and `SAVED_MESSAGE = 'Saved'`.
- `DailyEntryForm` shows the toast after a save and keeps the line "Saved on this
  device.". Its tests render inside `ToastProvider`.
- B4 added `tests/e2e/saved-toast.spec.ts`. It calls
  `recordDay(page, { gym: '1:00:00', … })`.

From D1 (wave 4, merged): `dailyEntrySchema` has `swim_seconds` with a default of
`null`. D1 does not touch `DailyEntryForm`.

## State before the step

- `RestTimeSheet` holds a text field. `readRestText` parses it. A bare "90" reads as
  90 minutes and the schema refuses it.
- `/log` sets gym time and walk time with `DurationField`, a text field with the full
  keyboard.
- `DurationField` is used only by `DailyEntryForm` and the `/styleguide` sample.
- `DurationPicker` exists, used only by `/styleguide`.

## Goal

Rest time, gym time and walk time are set with the picker. No duration on screen opens
a keyboard. `DurationField` is gone.

## Do

1. Run the `test-writer` agent with the acceptance list below. The tests come first.
2. Add 2 shared names to `components/ui/DurationPicker.tsx`, under `SESSION_PRESETS`.
   E5 uses both for swim time.

   ```ts
   export const CARDIO_PRESETS = [900, 1800, 2700, 3600] as const

   export const SESSION_STEP_SECONDS = 60
   ```

   The rest sheet keeps the 15 s step from the owner's decision. Gym, walk and swim
   time use 60 s, because 15 s steps over an hour need too many taps. Quote the
   owner's answer from "Stop and ask the owner" in the report, under "Things to
   consider".

3. `components/workout/RestTimeSheet.tsx`:
   - Delete `REST_HINT`, `restSecondsSchema`, `RestReading`, `readRestText`, and the
     imports of `parseInput`, `formatDuration`, `profileSchema` and `Field`.
   - Replace `RestTimeForm` with this. It keeps the shape B3 left: an `id` on the
     `<form>` and no Save button. The Save button stays in the sheet `footer`, as B3 put
     it.

     ```tsx
     function RestTimeForm({ id, changing, error, onSave }: RestTimeFormProps) {
       const [seconds, setSeconds] = useState(changing.seconds)

       return (
         <form
           id={id}
           noValidate
           className="flex flex-col gap-3"
           onSubmit={(event) => {
             event.preventDefault()
             onSave(seconds)
           }}
         >
           <p className="text-muted text-sm">
             The next rest after this exercise uses the new time.
           </p>
           <DurationPicker
             id="rest-seconds"
             label="Rest time"
             value={seconds}
             onChange={(next) => {
               if (next !== null) {
                 setSeconds(next)
               }
             }}
             presets={REST_PRESETS}
             max={MAX_REST_SECONDS}
           />
           {error === null ? null : (
             <p role="alert" className="text-danger text-sm">
               {error}
             </p>
           )}
         </form>
       )
     }
     ```

     Import `MAX_REST_SECONDS` from `lib/schema/profile`. The picker cannot go above it,
     so the schema message can no longer show.
4. `components/DailyEntryForm.tsx`:
   - The form values for `gym_seconds` and `walk_seconds` become `number | null`:

     ```ts
     const formSchema = z
       .object({
         entry_date: z.string(),
         walk_seconds: z.number().nullable(),
         gym_seconds: z.number().nullable(),
         avg_heart_rate: z.string(),
         max_heart_rate: z.string(),
         weight_kg: z.string(),
         calories_burnt: z.string(),
         steps: z.string(),
         note: z.string(),
       })
       .transform((raw): DailyEntryDraft => ({
         entry_date: raw.entry_date,
         walk_seconds: raw.walk_seconds,
         gym_seconds: raw.gym_seconds,
         avg_heart_rate: toNumber(raw.avg_heart_rate),
         max_heart_rate: toNumber(raw.max_heart_rate),
         weight_kg: toNumber(raw.weight_kg),
         calories_burnt: toNumber(raw.calories_burnt),
         steps: toNumber(raw.steps),
         note: raw.note.trim() === '' ? null : raw.note.trim(),
       }))
       .pipe(dailyEntrySchema)
     ```

     D1 does not add `swim_seconds` to this transform. `dailyEntrySchema` fills it
     with `null`. E5 adds it to the form.

   - Delete `toSeconds`, the `RefinementCtx` import and the `parseInput` import.
   - `EMPTY_VALUES` holds `walk_seconds: null` and `gym_seconds: null`. Type it as
     `Omit<DailyEntryFormValues, 'entry_date'>`, after the type.
   - `toFormValues` copies `entry.walk_seconds` and `entry.gym_seconds` as they are.
   - In `takeSessionTime`, set the number:
     `setValue('gym_seconds', offer.sessionSeconds, { shouldDirty: true })`. E3 deletes
     the offer. Until then it must still fill the picker.
   - Take `control` from `useForm`. Delete the `walkText` and `gymText` watches.
   - Replace the `grid grid-cols-2` block that holds the 2 `DurationField`s with 2
     grid children of the outer grid:

     ```tsx
     <Controller
       control={control}
       name="gym_seconds"
       render={({ field }) => (
         <DurationPicker
           id="gym_seconds"
           label="Gym time"
           value={field.value}
           onChange={field.onChange}
           presets={SESSION_PRESETS}
           step={SESSION_STEP_SECONDS}
           allowClear
         />
       )}
     />
     <Controller
       control={control}
       name="walk_seconds"
       render={({ field }) => (
         <DurationPicker
           id="walk_seconds"
           label="Walk time"
           value={field.value}
           onChange={field.onChange}
           presets={CARDIO_PRESETS}
           step={SESSION_STEP_SECONDS}
           allowClear
         />
       )}
     />
     ```

     A picker is too wide for half a phone column, so each one takes a full column on
     the phone. From 768 px the outer grid puts them side by side. The 768 px grid has
     1 empty cell until E5 adds the Swimming card. Keep `offerBlock` right after the
     gym picker.
5. Delete `components/ui/DurationField.tsx` and `components/ui/DurationField.test.tsx`.
   Then `grep -rn "DurationField\|DURATION_HINT\|durationPreview" app components lib tests`
   must return nothing.
6. `app/styleguide/page.tsx`:
   - Delete the `duration-sample` card, the `durationText` state, `parsedDuration`,
     `storedSeconds` and the `DurationField` and `parseInput` imports. Keep
     `formatDuration` if other samples use it.
   - The `duration-picker-sample` card from E1 keeps `data-ready`.
7. `.claude/skills/design-system/references/components.md`: delete section 8,
   `DurationField`. Rename section `8b. DurationPicker` to `8. DurationPicker`. Add 1
   line: "No duration in the app is typed. `lib/duration.ts` keeps `parseInput` for the
   CSV import."
8. `docs/design/prototype/index.html`, plate 02 "Daily log": replace the `grid-2` that
   holds `log-gym` and `log-walk` with 2 pickers. Gym time shows `1:05:00` with no chip
   pressed. Walk time shows `45:00` with the `45m` chip pressed. Use the `dp` classes
   from E1 and the chip lists `30m 45m 1h 1h 30m` and `15m 30m 45m 1h`.
9. End to end tests. Nothing types a duration any more.
   - `tests/e2e/support/signedIn.ts`:

     ```ts
     export async function recordDay(
       page: Page,
       values: { gym: string; steps: string },
     ): Promise<void> {
       await page
         .getByRole('group', { name: 'Gym time' })
         .getByRole('button', { name: values.gym, exact: true })
         .click()
       await page.getByLabel('Steps').fill(values.steps)
       await page.getByRole('button', { name: 'Save entry' }).click()
       await expect(page.getByText('Saved on this device.')).toBeVisible()
     }
     ```

     B4 kept the line "Saved on this device.", so this wait line works. If the file
     holds an extra toast wait from B4, keep it. `values.gym` is now the visible text of
     a preset chip.

   - In `openRoute`, for `/log`:
     `await expect(page.getByRole('group', { name: 'Gym time' }).getByRole('status')).not.toHaveText('Not set')`.
   - Change the callers. Each preset gives an exact number of seconds:

     | File                       | Before                                | After                             |
     | -------------------------- | ------------------------------------- | --------------------------------- |
     | `journey.spec.ts`          | `gym: '1:12:05'`, hero `1:12:05`      | `gym: '1h'`, hero `1:00:00`       |
     | `offline.spec.ts` line 55  | `gym: '0:48:30'`, hero `48:30`        | `gym: '45m'`, hero `45:00`        |
     | `offline.spec.ts` line 73  | `gym: '1:05:10'`, `gym_seconds: 3910` | `gym: '1h'`, `gym_seconds: 3600`  |
     | `offline.spec.ts` line 165 | `gym: '0:55:00'`, `gym_seconds: 3300` | `gym: '45m'`, `gym_seconds: 2700` |
     | `security.spec.ts`         | `gym: '0:42:00'`                      | `gym: '45m'`                      |
     | `saved-toast.spec.ts` (B4) | `gym: '1:00:00'`                      | `gym: '1h'`                       |

     Run `grep -rn "recordDay(" tests/e2e` first. Change every caller it lists. A caller
     that is not in this table gets the nearest preset chip. Name it in the report.

   - `tests/e2e/dashboard.spec.ts`, "shows on the dashboard the value saved on /log":
     replace the `fill('1:12:05')` line with a click on the `1h` chip in the Gym time
     group, and expect the hero `1:00:00`.
   - `tests/e2e/log.spec.ts`: replace "parses a duration in the browser" with:

     ```ts
     test('sets a duration with taps in the browser, with no network', async ({
       page,
       context,
     }) => {
       await page.goto('/styleguide')
       await context.setOffline(true)

       const sample = page.getByTestId('duration-picker-sample')
       await expect(sample).toHaveAttribute('data-ready', 'true')
       const gym = sample.getByRole('group', { name: 'Gym time' })
       await gym.getByRole('button', { name: '45m', exact: true }).click()
       await gym.getByRole('button', { name: 'Increase Gym time by 15 seconds' }).click()

       await expect(sample.getByText('Rest seconds: 90 · Gym seconds: 2715')).toBeVisible()
       await expect(gym.getByRole('status')).toHaveText('45:15')

       await context.setOffline(false)
     })
     ```

## Acceptance criteria

- [ ] The rest sheet opens with the current rest in the picker and its chip pressed.
- [ ] The rest sheet holds no text field.
- [ ] A tap on the `2m` chip and Save hands 120 to the owner.
- [ ] The + button in the rest sheet adds 15 s, and Save hands the new seconds.
- [ ] The rest picker cannot pass `MAX_REST_SECONDS`.
- [ ] The rest sheet still shows an error its owner reports, turns Save off while busy
      and closes through its owner.
- [ ] A rest change in a live session saves to the profile and syncs (the existing
      `changing the rest time` tests, now driven by the `2m` chip).
- [ ] `/log` shows Gym time and Walk time as picker groups, gym before walk, with no
      text field.
- [ ] `/log` fills both pickers from a stored entry.
- [ ] A save after the `1h` gym chip and the `45m` walk chip calls `upsertDay` with
      `gym_seconds: 3600` and `walk_seconds: 2700`.
- [ ] Clear on a stored gym time saves `gym_seconds: null`.
- [ ] The gym and walk −/+ buttons step 1 minute.
- [ ] The gym time offer "Use" still fills the gym picker.
- [ ] `DurationField` and its test are gone, and nothing imports them.
- [ ] The style guide picker sample is ready after hydration.
- [ ] The e2e suite records a day with a preset chip on all 3 projects.
- [ ] Every `recordDay` caller passes a preset chip label, also B4's
      `tests/e2e/saved-toast.spec.ts`. Check: `grep -rn "recordDay(" tests/e2e` shows
      no clock text such as `1:00:00`.
- [ ] `SESSION_STEP_SECONDS` holds the step the owner chose in "Stop and ask the
      owner", and the report quotes the answer.
- [ ] The Save button of the rest sheet stays in the sheet footer, as B3 left it. Test:
      B3's footer test in `RestTimeSheet.test.tsx` and `tests/e2e/sheet.spec.ts` stay
      green.
- [ ] `/log` still shows the Saved toast and "Saved on this device." after a save, as
      B4 left it. Tests: B4's toast tests in `DailyEntryForm.test.tsx` and
      `tests/e2e/saved-toast.spec.ts` stay green.
- [ ] Manual: at 390, 768 and 1440 px no tap on `/log` or in the rest sheet opens a
      keyboard, the chips wrap, and nothing scrolls sideways (**Verification** 3).
- [ ] The `ui-reviewer` agent reports no drift on `components/DailyEntryForm.tsx` and
      `components/workout/RestTimeSheet.tsx`.

## Tests

`components/workout/RestTimeSheet.test.tsx`. Delete the `readRestText` block, the hint
check and the 2 text field tests. Add one `it` per criterion 1 to 6:

```tsx
function picker() {
  return screen.getByRole('group', { name: 'Rest time' })
}

it('opens with the exercise in the title and its rest in the picker', () => {
  renderSheet()

  expect(screen.getByRole('dialog', { name: restSheetTitle('Bench Press') })).toBeInTheDocument()
  expect(within(picker()).getByRole('status')).toHaveTextContent('1:30')
  expect(within(picker()).getByRole('button', { name: '1:30' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

it('holds no text field, so no keyboard opens', () => {
  renderSheet()

  expect(within(screen.getByRole('dialog')).queryByRole('textbox')).not.toBeInTheDocument()
})

it('hands a preset rest to its owner in seconds', async () => {
  const { onSave } = renderSheet()

  await userEvent.click(within(picker()).getByRole('button', { name: '2m' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save rest time' }))

  expect(onSave).toHaveBeenCalledWith(120)
})

it('adds 15 seconds from the plus button', async () => {
  const { onSave } = renderSheet()

  await userEvent.click(screen.getByRole('button', { name: 'Increase Rest time by 15 seconds' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save rest time' }))

  expect(onSave).toHaveBeenCalledWith(105)
})

it('stops at the profile limit for a rest', () => {
  renderSheet({ changing: { ...BENCH, seconds: MAX_REST_SECONDS } })

  expect(screen.getByRole('button', { name: 'Increase Rest time by 15 seconds' })).toBeDisabled()
})
```

Keep the tests "renders nothing while closed", "shows an error its owner reports",
"turns the save off while busy" and "closes through its owner".

`components/workout/LiveSession.test.tsx`, `describe('changing the rest time')`. The
helper taps a chip. Every caller passes `'2m'` in place of `'2:00'`:

```tsx
async function changeRestTo(preset: string) {
  await userEvent.click(
    within(restCard()).getByRole('button', { name: 'Change the rest time for Bench Press' }),
  )
  const dialog = await screen.findByRole('dialog', { name: 'Rest for Bench Press' })
  await userEvent.click(
    within(within(dialog).getByRole('group', { name: 'Rest time' })).getByRole('button', {
      name: preset,
    }),
  )
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save rest time' }))
  return dialog
}
```

`components/DailyEntryForm.test.tsx`:

- "ties every input to a label": drop `Gym time` and `Walk time` from the input list.
  Add a check that both are groups.
- Delete "blocks the save and names the problem when a duration cannot be read" and
  "shows the parsed duration under the field as the user types".
- Add a helper and the new tests:

  ```tsx
  function pickerOf(name: 'Gym time' | 'Walk time') {
    return within(screen.getByRole('group', { name }))
  }

  it('sets gym and walk time with no text field', async () => {
    await renderForm()
    expect(pickerOf('Gym time').queryByRole('textbox')).not.toBeInTheDocument()
    expect(pickerOf('Walk time').queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('lays the gym time out before the walk time, as step 1.9 names them', async () => {
    await renderForm()
    const gym = screen.getByRole('group', { name: 'Gym time' })
    const walk = screen.getByRole('group', { name: 'Walk time' })
    expect(gym.compareDocumentPosition(walk) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('steps gym and walk time by 1 minute', async () => {
    await renderForm()
    expect(
      screen.getByRole('button', { name: 'Increase Gym time by 1 minute' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Increase Walk time by 1 minute' }),
    ).toBeInTheDocument()
  })

  it('saves no gym time after Clear on a stored value', async () => {
    vi.mocked(getDay).mockResolvedValue(STORED)
    await renderForm()
    await waitFor(() => {
      expect(pickerOf('Gym time').getByRole('status')).toHaveTextContent('1:12:05')
    })

    await userEvent.click(screen.getByRole('button', { name: 'Clear Gym time' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

    await waitFor(() => {
      expect(upsertDay).toHaveBeenCalledWith(expect.objectContaining({ gym_seconds: null }))
    })
  })
  ```

- "calls upsertDay once, with parsed seconds and never the raw text": rename it to
  "calls upsertDay once, with the picked seconds". Replace the 2 duration `type` lines
  with a click on `1h` in the Gym time group and on `45m` in the Walk time group.
  Expect `gym_seconds: 3600` and `walk_seconds: 2700`.
- "fills the form from an entry that already exists for the date": expect
  `pickerOf('Gym time').getByRole('status')` to have `1:12:05` and the walk one
  `42:18`.
- "writes the session length on Use, fills the field and hides the offer": expect the
  Gym time status to have `1:12:05`, in place of the field value.
- "leaves an empty string where the entry holds nothing" in `toFormValues`: expect
  `walk_seconds: null` and `gym_seconds: null`.

`app/styleguide/page.test.tsx`: delete "shows the duration field already formatted
from stored seconds" and "stores the seconds the duration field reports". Change
"marks the duration sample ready once the page has hydrated" to read
`duration-picker-sample`. Change "changes the rest time in the rest sheet sample" to
tap the `2m` chip in place of the 2 field lines.

## Verification

1. `pnpm test:cov`. `components/**` stays at its floors.
2. `grep -rn "DurationField\|readRestText\|REST_HINT" app components lib tests` returns
   nothing.
3. Open `/log` and the rest sheet at 390, 768 and 1440 px. No keyboard opens on a tap.
   The chips wrap. Nothing scrolls sideways.
4. Run the `ui-reviewer` agent on `components/DailyEntryForm.tsx` and
   `components/workout/RestTimeSheet.tsx`.
5. `pnpm verify:parallel`. The e2e suite runs the new `recordDay` on all 3 projects.

## Files touched

- `components/ui/DurationPicker.tsx` (2 new names)
- `components/workout/RestTimeSheet.tsx` and its test
- `components/workout/LiveSession.test.tsx`
- `components/DailyEntryForm.tsx` and its test
- `components/ui/DurationField.tsx` and its test (deleted)
- `app/styleguide/page.tsx` and its test
- `.claude/skills/design-system/references/components.md`
- `docs/design/prototype/index.html`
- `tests/e2e/support/signedIn.ts`, `tests/e2e/log.spec.ts`, `tests/e2e/dashboard.spec.ts`,
  `tests/e2e/journey.spec.ts`, `tests/e2e/offline.spec.ts`, `tests/e2e/security.spec.ts`,
  `tests/e2e/saved-toast.spec.ts`

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer
   when another step runs its e2e suite. Never skip a check, and never add a
   design-check or test exemption to pass.
2. Run the `commit-report` skill. The report needs screenshots of every changed page at 390, 768 and 1440 px, next to the matching prototype plate: `/log` next to plate 02, and the rest sheet next to the Duration picker plate.
3. Commit on `fix/e2-picker-in-use`:
   ```bash
   git add components/ui/DurationPicker.tsx \
     components/workout/RestTimeSheet.tsx \
     components/workout/RestTimeSheet.test.tsx \
     components/workout/LiveSession.test.tsx \
     components/DailyEntryForm.tsx \
     components/DailyEntryForm.test.tsx \
     components/ui/DurationField.tsx \
     components/ui/DurationField.test.tsx \
     app/styleguide/page.tsx \
     app/styleguide/page.test.tsx \
     .claude/skills/design-system/references/components.md \
     docs/design/prototype/index.html \
     tests/e2e/support/signedIn.ts \
     tests/e2e/log.spec.ts \
     tests/e2e/dashboard.spec.ts \
     tests/e2e/journey.spec.ts \
     tests/e2e/offline.spec.ts \
     tests/e2e/security.spec.ts \
     tests/e2e/saved-toast.spec.ts
   git commit -m "feat(ui): set rest, gym and walk time with the duration picker"
   ```
   `git add` stages the 2 deleted `DurationField` files as deletions. Also add any other e2e file the `recordDay` grep made you change.
   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.
4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked,
   and anything the owner must check on the iPhone. Quote the owner's answer on the step size. On the iPhone the owner checks that no tap on `/log` or in the rest sheet opens the keyboard.
