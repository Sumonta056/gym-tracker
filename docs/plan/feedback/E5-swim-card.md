# Step E5 — The Swimming card

**Branch:** `fix/e5-swim-card`, in worktree `../gym-tracker-e5`, cut from `fix/feedback-fixes` ·
**Wave:** 8 · **Size:** M · **Depends on:** W0, D1, E4 (and E2 through E4) ·
**Unlocks:** G3a · **Agent to use:** `test-writer` for the tests, then `ui-reviewer`
**Items:** 1 · **Skills to load:** `design-system`

## Before you start

### The worktree

```bash
cd /Users/cefalo_1/Documents/Projects/gym-tracker
git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-e5 -b fix/e5-swim-card fix/feedback-fixes
cd ../gym-tracker-e5
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
{ grep -q "DATABASE_VERSION = 5" lib/db/dexie.ts && ls supabase/migrations | grep -q "_feedback_goals_and_swim\.sql$"; } || echo "FAIL: D1 is not merged (Dexie is not at version 5, or no feedback_goals_and_swim migration file)"
{ grep -q "swim_seconds" lib/schema/dailyEntry.ts && grep -q "swim_seconds" lib/sync/mappings.ts && grep -q "Swim Time" lib/csv/export.ts && grep -q "swim_seconds" lib/csv/import.ts && grep -q "swim_seconds" lib/db/repository.ts; } || echo "FAIL: D1 is not complete (swim_seconds missing from the schema, the mappings, the CSV files or dayFields)"
grep -q "export const CARDIO_PRESETS" components/ui/DurationPicker.tsx || echo "FAIL: E2 is not merged (no CARDIO_PRESETS)"
{ test -f lib/format/logDate.ts && test -f components/LogDay.tsx && grep -q "onDateChange" components/DailyEntryForm.tsx; } || echo "FAIL: E4 is not merged (no logDate.ts, LogDay.tsx or onDateChange)"
echo "Dependency checks finished."
```

If any check fails, the step it names is not merged into `fix/feedback-fixes`. Stop. Report which check
failed. Do not do that step's work here.

### Already done check

```bash
grep -q "Swimming" components/DailyEntryForm.tsx && echo "DONE: E5 is already on this branch"
```

If it passes, stop and report.

## Context to read first

1. **Names this step uses from earlier steps** below.
2. `docs/specs/2026-10-05-feedback-fixes-design.md`, section 3.1 and item 1. The owner
   chose 1 swim time per day, in its own card, with no distance.
3. Load the `design-system` skill. Read `references/components.md`, sections 2 (`Card`)
   and 8 (`DurationPicker`).
4. `components/DailyEntryForm.tsx` and its test, as E4 left them.
5. `components/ui/DurationPicker.tsx` — `CARDIO_PRESETS` and `SESSION_STEP_SECONDS`
   from E2.
6. `lib/schema/dailyEntry.ts`, `lib/db/dexie.ts`, `lib/sync/mappings.ts`,
   `lib/csv/export.ts` and `lib/csv/import.ts`, as D1 left them.

## Names this step uses from earlier steps

From D1:

- `dailyEntrySchema.swim_seconds`: an integer from 0 to 86 400, nullable, default
  `null`. The local `DailyEntry.swim_seconds` is optional, so a row saved before Dexie
  v5 has no field.
- `lib/sync/mappings.ts` pushes and pulls `swim_seconds`. The CSV export writes a
  `Swim Time` column, and the import reads it as an optional column.
- `dayFields` in `lib/db/repository.ts` carries `swim_seconds`, so an import merge
  keeps it.

From E2, `components/ui/DurationPicker.tsx`:

- `CARDIO_PRESETS = [900, 1800, 2700, 3600]`. The chips read `15m`, `30m`, `45m`, `1h`.
- `SESSION_STEP_SECONDS`: 60, or the step the owner chose in E2. Read the merged file.
  The step buttons are named `Increase <label> by <stepWords(step)>`, for example
  `Increase Swim time by 1 minute`. If the step is not 60, change "by 1 minute" in the
  tests below to match.
- With `allowClear` and a value, the picker shows a `Clear <label>` button.

From E4, `components/DailyEntryForm.tsx`:

- The props are `{ date: string; onDateChange: (date: string) => void }`. The test
  helper `renderForm` passes `onDateChange={vi.fn()}`.
- The form holds `gym_seconds` (with E3's derived block) and `walk_seconds` as
  `number | null` values, each in a `Controller`.

From B4: a save shows the Saved toast and the line "Saved on this device.".

## State before the step

- D1 added `swim_seconds` everywhere below the screen. The dependency checks above
  prove it. These greps show where:
  - `grep -n "swim_seconds" lib/schema/dailyEntry.ts` finds the field, with the same
    rule as `walk_seconds`.
  - `grep -n "swim_seconds" lib/sync/mappings.ts` finds it in the push and the pull.
  - `grep -n "swim_seconds" lib/csv/export.ts lib/csv/import.ts` finds the export column
    and the optional import column.
  - `grep -n "swim_seconds" lib/db/repository.ts` finds it in `dayFields`, so an import
    merge keeps it.
- `/log` has no control for swim time. A saved row holds `swim_seconds: null`, or the
  value a CSV import gave it.
- The 768 px grid of `/log` has 1 empty cell after Walk time (E2).

## Goal

`/log` has a Swimming card. The user sets the swim time of the day with the picker and
no keyboard. It saves through `upsertDay`, syncs, and reads back.

## Out of scope, said once

- **Today.** G3 shows swim time on Today with every other tracked value.
- **Week totals and a swim chart.** The spec names neither. No step in this track adds
  them. Week totals live in `lib/metrics/weekTotals.ts`, a test-first file that C2 and
  C3 change, and a chart needs a new card in the Stats layout that I1 owns. Both are
  more than 1 session with this card. Say this in the report so the owner can ask for a
  later step.

## Do

1. Run the `test-writer` agent with the acceptance list below. The tests come first.
2. `components/DailyEntryForm.tsx`:
   - Add `swim_seconds: z.number().nullable()` to `formSchema`, after `walk_seconds`.
     The transform copies `raw.swim_seconds` as it is. If D1 already added a string
     form of it, replace that.
   - `EMPTY_VALUES` holds `swim_seconds: null`. `toFormValues` copies
     `entry.swim_seconds`.
   - `FIELD_COUNT` becomes `9`.
   - Add the card right after the Walk time picker. It fills the empty cell of the
     768 px grid, so the grid reads gym, walk / swim, heart rate / weight, calories and
     steps / note.

     ```tsx
     <Card className="flex flex-col gap-3">
       <h2>
         <MicroLabel>Swimming</MicroLabel>
       </h2>
       <Controller
         control={control}
         name="swim_seconds"
         render={({ field }) => (
           <DurationPicker
             id="swim_seconds"
             label="Swim time"
             value={field.value}
             onChange={field.onChange}
             presets={CARDIO_PRESETS}
             step={SESSION_STEP_SECONDS}
             allowClear
           />
         )}
       />
       <p className="text-muted text-xs">The time in the pool today. No distance.</p>
     </Card>
     ```

     Import `Card` from `./ui/Card` and `MicroLabel` from `./ui/MicroLabel` if E3 did
     not.
3. `docs/design/prototype/index.html`, plate 02 "Daily log":
   - Change the sub line to `Sat 20 Sep · 9 fields`.
   - Add the Swimming card after the walk picker: a `card` with the micro label
     "Swimming", a picker with the label "Swim time", the value `30:00`, the chips
     `15m 30m 45m 1h` with `30m` pressed, and the muted line "The time in the pool
     today. No distance."

## Acceptance criteria

- [ ] `/log` shows a Swimming card with a Swim time picker after Walk time.
- [ ] The swim picker holds no text field. Its −/+ buttons step 1 minute. Its chips are
      15m, 30m, 45m and 1h.
- [ ] A tap on `30m` and Save calls `upsertDay` with `swim_seconds: 1800`.
- [ ] Clear on a stored swim time and Save calls `upsertDay` with `swim_seconds: null`.
- [ ] A stored swim time of 2700 shows `45:00` in the picker.
- [ ] The header says "9 fields".
- [ ] `upsertDay` with a swim time writes it to Dexie and to the outbox payload, and
      `getDay` reads it back.
- [ ] On a real browser, a swim time saved on `/log` shows again after a reload and
      reaches Supabase.
- [ ] A past day keeps its own swim time. Test: 1 `it` in
      `components/DailyEntryForm.test.tsx` renders the form with a `date` other than
      `DATE`, taps `30m`, saves, and expects `upsertDay` with that `entry_date` and
      `swim_seconds: 1800`.
- [ ] Manual: at 768 px the `/log` grid has no empty cell, and at 320 px the swim
      chips wrap with no sideways scroll (**Verification** 2).
- [ ] axe and the responsive checks stay green on `/log`. Tests:
      `tests/e2e/a11y.spec.ts` and `tests/e2e/responsive.spec.ts`.
- [ ] The prototype plate 02 shows the Swimming card and `9 fields`. Manual: a
      screenshot side by side in the report.
- [ ] The `ui-reviewer` agent reports no drift on `components/DailyEntryForm.tsx`.

## Tests

`components/DailyEntryForm.test.tsx`, criteria 1 to 6. Add `swim_seconds: 2700` to
`STORED` (D1 may have set it to `null`; this step needs a value). Add `swim_seconds:
null` to every exact `toHaveBeenCalledWith` object and to the `toFormValues` empty
case.

```tsx
function swim() {
  return within(screen.getByRole('group', { name: 'Swim time' }))
}

describe('the Swimming card', () => {
  it('sits after walk time, under its own heading', async () => {
    await renderForm()
    const walk = screen.getByRole('group', { name: 'Walk time' })
    const picker = screen.getByRole('group', { name: 'Swim time' })
    expect(walk.compareDocumentPosition(picker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Swimming' })).toBeVisible()
  })

  it('sets swim time with taps only, in 1 minute steps and 4 presets', async () => {
    await renderForm()
    expect(swim().queryByRole('textbox')).not.toBeInTheDocument()
    expect(swim().getByRole('button', { name: 'Increase Swim time by 1 minute' })).toBeVisible()
    expect(
      swim()
        .getAllByRole('button', { pressed: false })
        .map((button) => button.textContent),
    ).toEqual(['15m', '30m', '45m', '1h'])
  })

  it('saves the picked swim time in seconds', async () => {
    await renderForm()
    await userEvent.click(swim().getByRole('button', { name: '30m' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

    await waitFor(() => {
      expect(upsertDay).toHaveBeenCalledWith(expect.objectContaining({ swim_seconds: 1800 }))
    })
  })

  it('saves no swim time after Clear', async () => {
    vi.mocked(getDay).mockResolvedValue(STORED)
    await renderForm()
    await waitFor(() => {
      expect(swim().getByRole('status')).toHaveTextContent('45:00')
    })

    await userEvent.click(screen.getByRole('button', { name: 'Clear Swim time' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

    await waitFor(() => {
      expect(upsertDay).toHaveBeenCalledWith(expect.objectContaining({ swim_seconds: null }))
    })
  })

  it('fills the swim time from the stored entry', async () => {
    vi.mocked(getDay).mockResolvedValue(STORED)
    await renderForm()
    await waitFor(() => {
      expect(swim().getByRole('status')).toHaveTextContent('45:00')
    })
    expect(swim().getByRole('button', { name: '45m' })).toHaveAttribute('aria-pressed', 'true')
  })
})
```

Change "names the day and the field count, as the mockup does" to expect
`Sat 19 Sep · 9 fields`.

`lib/db/repository.test.ts`, criterion 7. If D1 already has a test that saves and reads
`swim_seconds` through `upsertDay`, skip this one and name D1's test in the report.

```ts
it('keeps the swim time through a save, the outbox and a read', async () => {
  await upsertDay(dailyEntrySchema.parse({ entry_date: '2026-09-01', swim_seconds: 1800 }))

  expect(await getDay('2026-09-01')).toMatchObject({ swim_seconds: 1800 })
  const [queued] = await dailyQueued()
  expect(queued?.payload).toMatchObject({ swim_seconds: 1800 })
})
```

`tests/e2e/swim.spec.ts`, criterion 8:

```ts
import { expect, test } from './support/signedIn'

test('saves a swim time on the log, reads it after a reload and syncs it', async ({
  page,
  account,
  day,
}) => {
  await page.goto('/log')
  const swim = page.getByRole('group', { name: 'Swim time' })
  await swim.getByRole('button', { name: '30m', exact: true }).click()
  await page.getByRole('button', { name: 'Save entry' }).click()
  await expect(page.getByText('Saved on this device.')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('group', { name: 'Swim time' }).getByRole('status')).toHaveText(
    '30:00',
  )
  await expect
    .poll(() => account.rowsOn(day.date), { message: 'the swim time reaches Supabase' })
    .toEqual([expect.objectContaining({ entry_date: day.date, swim_seconds: 1800 })])
})
```

B4 kept the line "Saved on this device.", so the wait line above works as it is.

## Verification

1. `pnpm test:cov`. `components/**` and `lib/**` stay at their floors.
2. Open `/log` at 390, 768 and 1440 px. At 768 px the grid has no empty cell. At 320 px
   the swim chips wrap and nothing scrolls sideways.
3. Run the `ui-reviewer` agent on `components/DailyEntryForm.tsx`.
4. `pnpm verify:parallel`. `responsive.spec.ts` and `a11y.spec.ts` cover `/log` with the card.

## Files touched

- `components/DailyEntryForm.tsx` and its test
- `lib/db/repository.test.ts`
- `tests/e2e/swim.spec.ts` (new)
- `docs/design/prototype/index.html`

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer
   when another step runs its e2e suite. Never skip a check, and never add a
   design-check or test exemption to pass.
2. Run the `commit-report` skill. The report needs screenshots of every changed page at 390, 768 and 1440 px, next to the matching prototype plate: `/log` with a swim time, next to prototype plate 02.
3. Commit on `fix/e5-swim-card`:
   ```bash
   git add components/DailyEntryForm.tsx \
     components/DailyEntryForm.test.tsx \
     lib/db/repository.test.ts \
     tests/e2e/swim.spec.ts \
     docs/design/prototype/index.html
   git commit -m "feat(ui): add the swimming card to the log"
   ```
   If you skipped the repository test because D1 already has one, leave `lib/db/repository.test.ts` out.
   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.
4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked,
   and anything the owner must check on the iPhone. Say that this step closes sub-plan E: the owner checks the E lines of `docs/plan/04-feedback-fixes.md` on the iPhone before F1 starts. Name the out of scope items: Today, week totals and a swim chart. On the iPhone the owner sets a swim time with taps only, and sees it again after a reload.
