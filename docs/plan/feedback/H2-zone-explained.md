# Step H2 — Zone bpm ranges and the info sheet

**Branch:** `fix/h2-zone-explained`, in worktree `../gym-tracker-h2`, cut from `fix/feedback-fixes` ·
**Wave:** 11 · **Size:** S · **Depends on:** W0, H1 (and B3 for the portal sheet) ·
**Unlocks:** the H checkpoint, then I1 · **Skills to load:** `design-system` ·
**Agent to use:** `test-writer` for the tests, then `ui-reviewer`

Item 15: "Heart rate zone what do in widgets". The only help text today is one line in
the card footer. Nothing says what a zone means or which beats fall in it.

## Before you start

1. Make the worktree:

   ```bash
   cd /Users/cefalo_1/Documents/Projects/gym-tracker
   git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-h2 -b fix/h2-zone-explained fix/feedback-fixes
   cd ../gym-tracker-h2
   cp ../gym-tracker/.env.local ../gym-tracker/.env.test.local .
   export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"
   pnpm install
   ```

   If you are already in that worktree on that branch, skip this block.

2. Dependency checks. Run them from the worktree root. Each line prints `FAIL` and the
   step name when that step is not in `fix/feedback-fixes`:

   ```bash
   test -f scripts/e2e-lock.mjs || echo "FAIL W0: scripts/e2e-lock.mjs is missing"
   grep -qs "createPortal" components/ui/SheetModal.tsx || echo "FAIL B3: SheetModal does not render through a portal"
   grep -qs "export function resolveMaxHeartRate" lib/metrics/heartRateZones.ts || echo "FAIL H1: resolveMaxHeartRate is missing in lib/metrics/heartRateZones.ts"
   grep -qs "export function zoneNote" components/dashboard/HeartRateZonesCard.tsx || echo "FAIL H1: zoneNote is missing in components/dashboard/HeartRateZonesCard.tsx"
   grep -qs "maxHeartRate" components/charts/ZoneSplitChart.tsx || echo "FAIL H1: ZoneSplitChart has no maxHeartRate prop"
   ```

   If any check fails, the step it names is not merged into `fix/feedback-fixes`. Stop. Report which
   check failed. Do not do that step's work here.

3. Already done check:

   ```bash
   grep -qs "export function zoneBands" lib/metrics/heartRateZones.ts && echo "H2 is already done"
   ```

   If it prints, stop and report.

## Names this step uses from earlier steps

- H1, `lib/metrics/heartRateZones.ts`:

  ```ts
  export type MaxHeartRate = { bpm: number; source: 'override' | 'age' }
  export const ZONE_FLOORS = { fatBurn: 0.6, cardio: 0.7, peak: 0.85 }
  export function resolveMaxHeartRate(
    profile: Pick<ProfileInput, 'max_heart_rate' | 'birth_year'>,
    today: string,
  ): MaxHeartRate | null
  export function heartRateZones(
    session: HeartRateSession,
    maxHeartRate: number | null,
  ): HeartRateZones
  ```

  The type names are `HeartRateSession` and `HeartRateZones`. Read `ZONE_FLOORS` in the
  file. The values above are the 60, 70 and 85 % floors.

- H1, `components/dashboard/HeartRateZonesCard.tsx`:
  `export const NO_MAX_NOTE = 'Add your birth year in Profile for real zones.'` and
  `export function zoneNote(maxHeartRate: MaxHeartRate | null): string`, which gives
  `Based on a max of 190 bpm, from your birth year.` or `... set in Profile.` The card and
  `components/charts/ZoneSplitChart.tsx` both take `maxHeartRate: MaxHeartRate | null`.
  `zoneList(zones)` builds the rows of the card and the chart legend.
- H1, `lib/duration.ts`: `formatDuration(seconds, 'short')` gives `<1m` for 1 to 59 s.
- B3, `components/ui/SheetModal.tsx`: it renders through `createPortal`. Its props are
  `open`, `title`, `onClose` and `children`. Its close button reads `Close <title>`, and
  closing it gives focus back to the element that opened it.

## Context to read first

1. `docs/specs/2026-10-05-feedback-fixes-design.md`, section 3.4 and item 15.
2. "Names this step uses from earlier steps" above.
3. H1 added `resolveMaxHeartRate`, `MaxHeartRate`, `zoneNote` and the `maxHeartRate`
   prop on both zone views. Read them in the code.
4. `lib/metrics/heartRateZones.ts` and its test, as H1 left them.
5. `components/dashboard/HeartRateZonesCard.tsx`, `components/charts/ZoneSplitChart.tsx`,
   `components/charts/ChartCard.tsx`.
6. `components/ui/SheetModal.tsx` and its test. B3 renders it through a portal. Its
   props did not change.
7. `.claude/rules/accessibility.md`. Rule 4: never colour alone.
8. Load the `design-system` skill. Read `references/charts.md`. Open
   `docs/design/prototype/index.html`, plates `p1`, `p5` and `p8` (the sheet markup).

## State before the step

- The zones use the true max (H1). The card and the chart show the time per zone and a
  note about the max. They show no bpm.
- No help explains the zones.
- `ChartCard` has no slot for a button in its header.

## Goal

Each zone shows its bpm range when the max is known. An info button on the zones card
and on the zone split chart opens a sheet that explains the 4 zones in plain words and
says how the max is found.

## Do

1. Run the `test-writer` agent with the acceptance list below. The tests come first.
2. `lib/metrics/heartRateZones.ts`, add:
   ```ts
   export type ZoneName = 'warm' | 'fatBurn' | 'cardio' | 'peak'

   export type ZoneBand = { zone: ZoneName; fromBpm: number; toBpm: number | null }

   export function zoneBands(maxHeartRate: number): ZoneBand[] {
     const fatBurn = Math.round(ZONE_FLOORS.fatBurn * maxHeartRate)
     const cardio = Math.round(ZONE_FLOORS.cardio * maxHeartRate)
     const peak = Math.round(ZONE_FLOORS.peak * maxHeartRate)

     return [
       { zone: 'warm', fromBpm: 0, toBpm: fatBurn - 1 },
       { zone: 'fatBurn', fromBpm: fatBurn, toBpm: cardio - 1 },
       { zone: 'cardio', fromBpm: cardio, toBpm: peak - 1 },
       { zone: 'peak', fromBpm: peak, toBpm: null },
     ]
   }
   ```
   Warm starts at 0, because the model counts every beat below the fat burn floor as
   Warm. Peak has no top. The bands round the floors to whole beats. The zone seconds
   still use the exact floors. The difference is under 1 beat.
3. `components/dashboard/HeartRateZonesCard.tsx`:
   - `Zone` gets `zone: ZoneName` and `band: string | null`.
   - `zoneList(zones: HeartRateZones, maxHeartRate: MaxHeartRate | null = null)` fills
     `band` from `zoneBands(maxHeartRate.bpm)` through `bandText`, or `null` when the
     max is null.
   - New export:
     ```ts
     export function bandText(band: ZoneBand): string {
       if (band.toBpm === null) {
         return `${String(band.fromBpm)}+ bpm`
       }

       if (band.fromBpm === 0) {
         return `under ${String(band.toBpm + 1)} bpm`
       }

       return `${String(band.fromBpm)}–${String(band.toBpm)} bpm`
     }
     ```
   - The list becomes 1 column. Each `li` is `flex items-center justify-between gap-3`:
     the dot and 1 `<span>` with `${zone.name} ${time}` on the left, then a `<span>`
     with `band` on the right in `text-muted` when it is not null. Keep the name and the
     time in 1 element, so the existing `getByText('Warm 8m')` tests still find it. The name stays in text, so no zone is told apart by colour
     alone.
   - The header row becomes `flex min-h-11 items-center justify-between gap-3`. On the
     right: the cardio time, then `<ZoneInfoButton maxHeartRate={maxHeartRate} />`. The
     button shows in the empty state too.
4. `components/dashboard/ZoneInfo.tsx`, new:
   ```ts
   export const ZONE_INFO_LABEL = 'What the zones mean'

   export const ZONE_SHEET_TITLE = 'Heart rate zones'

   export const ZONE_MEANING: Record<ZoneName, string> = {
     warm: 'Easy movement below 60 % of your max, such as a warm-up or the rest between sets.',
     fatBurn: 'A steady effort from 60 to 70 % of your max that you could keep up for a long time.',
     cardio: 'Hard work from 70 to 85 % of your max that builds your heart and lung fitness.',
     peak: 'An all-out effort above 85 % of your max that you can hold only for short bursts.',
   }

   export const SPREAD_EXPLAINED =
     'The app spreads your gym time between your average and your peak heart rate, so the split is a model, not a measurement.'

   export const MAX_EXPLAINED =
     'Your max heart rate is the value you set in Profile. Without one, it is 220 minus your age, from your birth year.'
   ```
   - `export function ZoneInfoButton({ maxHeartRate }: { maxHeartRate: MaxHeartRate | null })`.
     It owns an `open` state. It renders:
     ```tsx
     <button
       type="button"
       aria-label={ZONE_INFO_LABEL}
       onClick={() => {
         setOpen(true)
       }}
       className="text-muted bg-surface-2 border-border inline-flex size-11 shrink-0 items-center justify-center rounded-full border text-sm font-bold"
     >
       <span aria-hidden="true">i</span>
     </button>
     ```
     and a `SheetModal` with `title={ZONE_SHEET_TITLE}`. The classes copy the close
     button of `SheetModal`.
   - The sheet body: a `<dl>` with 1 row per zone, in the order Warm, Fat burn, Cardio,
     Peak. The `dt` is the zone name, plus `, ` and `bandText` of its band when the max
     is known, `text-text text-[15px] font-bold`. The `dd` is `ZONE_MEANING`,
     `text-muted text-sm`. After the list, 2 `<p className="text-muted text-sm">`:
     `SPREAD_EXPLAINED`, then `MAX_EXPLAINED`. Then 1 `<p className="text-text text-sm">`
     with `zoneNote(maxHeartRate)` from H1, so the sheet names the max in use or asks
     for the birth year.
   - The zone names come from `zoneList`, so the card, the chart and the sheet use one
     spelling.
5. `components/charts/ChartCard.tsx`: new optional prop `action?: ReactNode`. The header
   renders the summary and the action side by side in a
   `flex shrink-0 items-center gap-2` group. The action shows in the empty state too.
6. `components/charts/ZoneSplitChart.tsx`:
   - `const list = zoneList(zones, maxHeartRate)`.
   - Legend name: `${zone.name} ${formatDuration(zone.seconds, 'short')}`, plus
     ` · ${zone.band}` when `band` is not null. For example `Cardio 21m · 133–161 bpm`.
   - `action={<ZoneInfoButton maxHeartRate={maxHeartRate} />}`.
7. `app/styleguide/page.tsx`: the zones card and the zone split chart samples show a
   known max of 190 and a null max. Add the open sheet as a sample with a heading "The
   zone info sheet": render `ZoneInfoButton` and let the reviewer open it.
8. `docs/design/prototype/index.html`:
   - Plates `p1` and `p5`: the zone rows show their bpm range, and the header carries
     the round `i` button.
   - A new plate after `p5`, `<span class="n">H2</span>`, name "Heart rate zones
     explained", route `/ · sheet`, `id="p-zone-info"`. Copy the sheet markup of `p8`.
     Show the 4 rows with max 190: "Warm, under 114 bpm", "Fat burn, 114–132 bpm",
     "Cardio, 133–161 bpm", "Peak, 162+ bpm", each with its sentence, then the 2
     paragraphs and "Based on a max of 190 bpm, from your birth year."

## Acceptance criteria

- [ ] `zoneBands(190)` returns Warm 0–113, Fat burn 114–132, Cardio 133–161, Peak 162 and up.
- [ ] `zoneBands(175)` rounds 122.5 up to 123 and 148.75 up to 149.
- [ ] The 4 bands touch with no gap and no overlap, for every max from 100 to 230.
- [ ] `bandText` writes "under 114 bpm", "133–161 bpm" and "162+ bpm".
- [ ] The zones card shows each zone's bpm range next to its name when the max is known.
- [ ] The zones card shows no bpm range when the max is null.
- [ ] The zone split chart legend reads "Cardio 21m · 133–161 bpm" when the max is 190.
- [ ] The info button has the label "What the zones mean" and opens the sheet "Heart rate zones".
- [ ] The info button shows on the card and on the chart in the empty state too.
- [ ] The sheet explains all 4 zones, each in one sentence, and says how the max is found.
- [ ] The sheet names the max in use, or asks for the birth year when there is none.
- [ ] The sheet opens with the keyboard and closing it returns focus to the info button.
- [ ] `ChartCard` renders its `action` in the header.
      Test: the `action` cases in `ChartCard.test.tsx`.
- [ ] The info button is 44 px tall at every width. Test: `tests/e2e/responsive.spec.ts`
      on `/` and `/analytics`.
- [ ] axe reports no serious or critical issue on `/` and `/analytics`, with the sheet
      closed. Test: `tests/e2e/a11y.spec.ts`.
- [ ] The H1 behaviour stays: the card footer still shows `zoneNote`, and a 30 s zone
      still reads `Warm <1m`. Tests: the H1 cases in `HeartRateZonesCard.test.tsx`.
- [ ] `/styleguide` shows the zones card and the chart with a max of 190 and with a null
      max, and the info button. Test: `app/styleguide/page.test.tsx`.
- [ ] Plate `p-zone-info` exists after `p5`, and `p1` and `p5` show the bpm ranges and the
      `i` button. Manual check: the `ui-reviewer` agent reports no drift.

## Tests

`lib/metrics/heartRateZones.test.ts`:

```ts
describe('zoneBands', () => {
  it('splits a max of 190 at 114, 133 and 162 beats', () => {
    expect(zoneBands(190)).toEqual([
      { zone: 'warm', fromBpm: 0, toBpm: 113 },
      { zone: 'fatBurn', fromBpm: 114, toBpm: 132 },
      { zone: 'cardio', fromBpm: 133, toBpm: 161 },
      { zone: 'peak', fromBpm: 162, toBpm: null },
    ])
  })

  it('rounds a half beat up', () => {
    expect(zoneBands(175).map((band) => band.fromBpm)).toEqual([0, 105, 123, 149])
  })

  it('leaves no gap and no overlap between the bands', () => {
    for (let max = 100; max <= 230; max += 1) {
      const bands = zoneBands(max)

      for (let index = 1; index < bands.length; index += 1) {
        expect(bands[index]?.fromBpm).toBe((bands[index - 1]?.toBpm ?? 0) + 1)
      }
    }
  })
})
```

`components/dashboard/HeartRateZonesCard.test.tsx`:

```ts
const MAX = { bpm: 190, source: 'age' } as const

describe('bandText', () => {
  it('writes the warm band as under its top', () => {
    expect(bandText({ zone: 'warm', fromBpm: 0, toBpm: 113 })).toBe('under 114 bpm')
  })

  it('writes a middle band as a range', () => {
    expect(bandText({ zone: 'cardio', fromBpm: 133, toBpm: 161 })).toBe('133–161 bpm')
  })

  it('writes the peak band with no top', () => {
    expect(bandText({ zone: 'peak', fromBpm: 162, toBpm: null })).toBe('162+ bpm')
  })
})

describe('HeartRateZonesCard bands', () => {
  it('shows the bpm range of each zone when the max is known', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={MAX} />)
    for (const text of ['under 114 bpm', '114–132 bpm', '133–161 bpm', '162+ bpm']) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
  })

  it('keeps the zone name in text beside its range', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={MAX} />)
    expect(screen.getByText('133–161 bpm').closest('li')).toHaveTextContent('Cardio 21m')
  })

  it('shows no bpm range when the max is not known', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={null} />)
    expect(screen.queryByText(/bpm$/)).not.toBeInTheDocument()
  })

  it('shows the info button in the empty state', () => {
    render(<HeartRateZonesCard zones={NONE} maxHeartRate={null} />)
    expect(screen.getByRole('button', { name: 'What the zones mean' })).toBeInTheDocument()
  })
})
```

`components/dashboard/ZoneInfo.test.tsx`:

```ts
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { MAX_EXPLAINED, ZONE_MEANING, ZoneInfoButton } from './ZoneInfo'

describe('ZoneInfoButton', () => {
  it('opens the zone sheet when pressed', async () => {
    render(<ZoneInfoButton maxHeartRate={null} />)
    await userEvent.click(screen.getByRole('button', { name: 'What the zones mean' }))
    expect(screen.getByRole('dialog', { name: 'Heart rate zones' })).toBeInTheDocument()
  })

  it('explains each of the 4 zones in one sentence', async () => {
    render(<ZoneInfoButton maxHeartRate={null} />)
    await userEvent.click(screen.getByRole('button', { name: 'What the zones mean' }))
    for (const sentence of Object.values(ZONE_MEANING)) {
      expect(screen.getByText(sentence)).toBeInTheDocument()
    }
  })

  it('says how the max heart rate is found', async () => {
    render(<ZoneInfoButton maxHeartRate={null} />)
    await userEvent.click(screen.getByRole('button', { name: 'What the zones mean' }))
    expect(screen.getByText(MAX_EXPLAINED)).toBeInTheDocument()
  })

  it('names the bpm range of each zone when the max is known', async () => {
    render(<ZoneInfoButton maxHeartRate={{ bpm: 190, source: 'age' }} />)
    await userEvent.click(screen.getByRole('button', { name: 'What the zones mean' }))
    expect(screen.getByText('Cardio, 133–161 bpm')).toBeInTheDocument()
    expect(screen.getByText('Based on a max of 190 bpm, from your birth year.')).toBeInTheDocument()
  })

  it('asks for the birth year when the max is not known', async () => {
    render(<ZoneInfoButton maxHeartRate={null} />)
    await userEvent.click(screen.getByRole('button', { name: 'What the zones mean' }))
    expect(screen.getByText('Add your birth year in Profile for real zones.')).toBeInTheDocument()
  })

  it('opens with the keyboard and gives focus back to the button on close', async () => {
    const user = userEvent.setup()
    render(<ZoneInfoButton maxHeartRate={null} />)
    await user.tab()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('dialog', { name: 'Heart rate zones' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'What the zones mean' })).toHaveFocus()
  })
})
```

`components/charts/ZoneSplitChart.test.tsx`: add that with
`maxHeartRate={{ bpm: 190, source: 'age' }}` the legend holds
`Cardio 13m · 133–161 bpm` for the `full` sample of that file, and that the empty sample
still shows the button "What the zones mean". Compute the cardio minutes from the
`full` sample after H1 passes the max to `analyse`. If the sample is built with a null
max, the time stays `13m`.

`components/charts/ChartCard.test.tsx`: add that an `action` renders in the header, and
that it renders when `empty` is true.

## Verification

1. `pnpm test:cov`. `lib/metrics/**` stays at 100 lines, 95 branches and 100 functions.
2. `pnpm design:check`.
3. `pnpm verify:parallel`. `tests/e2e/responsive.spec.ts` proves the info button is 44 px tall.
   axe reports no serious issue on `/` and `/analytics`.
4. In the browser, at 390, 768 and 1440 px: open the sheet from Today and from Stats,
   with and without a birth year. Tab to the button, press Enter, press Escape.

## Things to consider

- This step ends sub-plan H. Say so in the report, so the owner runs the H checkpoint
  in `docs/plan/04-feedback-fixes.md`. Do not run it yourself.
- G3b runs in the same wave and changes `Dashboard.tsx`. Do not edit `Dashboard.tsx`
  here. The info button lives inside `HeartRateZonesCard`, so `Dashboard.tsx` needs no
  change.

## Files touched

- `lib/metrics/heartRateZones.ts` and its test
- `components/dashboard/HeartRateZonesCard.tsx` and its test
- `components/dashboard/ZoneInfo.tsx` and its test
- `components/charts/ChartCard.tsx`, `ZoneSplitChart.tsx` and their tests
- `app/styleguide/page.tsx` and its test
- `docs/design/prototype/index.html`

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer when
   another step runs its e2e suite. Never skip a check, and never add a design-check or
   test exemption to pass.
2. Stage the files of step 3 with the same `git add` line first. The skill describes the
   staged diff, and it refuses to run when nothing is staged. Then run the `commit-report`
   skill.
   The report needs screenshots of every changed page at 390, 768 and 1440 px, next
   to the matching prototype plate. Show `/` and `/analytics` with the sheet closed and
   open, next to plates `p1`, `p5` and `p-zone-info`.
3. Commit on `fix/h2-zone-explained`:

   ```bash
   git add lib/metrics/heartRateZones.ts \
     lib/metrics/heartRateZones.test.ts \
     components/dashboard/HeartRateZonesCard.tsx \
     components/dashboard/HeartRateZonesCard.test.tsx \
     components/dashboard/ZoneInfo.tsx \
     components/dashboard/ZoneInfo.test.tsx \
     components/charts/ChartCard.tsx \
     components/charts/ChartCard.test.tsx \
     components/charts/ZoneSplitChart.tsx \
     components/charts/ZoneSplitChart.test.tsx \
     app/styleguide/page.tsx \
     app/styleguide/page.test.tsx \
     docs/design/prototype/index.html
   git commit -m "feat(charts): show the zone bpm ranges and explain the zones"
   ```

   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.

4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked,
   and anything the owner must check on the iPhone.
