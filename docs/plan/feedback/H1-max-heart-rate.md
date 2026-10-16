# Step H1 — Zones from a true maximum heart rate

**Branch:** `fix/h1-max-heart-rate`, in worktree `../gym-tracker-h1`, cut from `fix/feedback-fixes` ·
**Wave:** 10 · **Size:** M · **Depends on:** W0, C2, C3, D1, G1, G2, G3a · **Unlocks:** H2,
G3b · **Skills to load:** `design-system` · **Agent to use:** `test-writer` for the tests,
then `ui-reviewer`

Item 10: "Heart rate in today showing zone 0". An average of 150 and a peak of 160 put
100 % of the session in Peak, because the zones use the session peak as the maximum
heart rate.

## Before you start

1. Make the worktree:

   ```bash
   cd /Users/cefalo_1/Documents/Projects/gym-tracker
   git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-h1 -b fix/h1-max-heart-rate fix/feedback-fixes
   cd ../gym-tracker-h1
   cp ../gym-tracker/.env.local ../gym-tracker/.env.test.local .
   export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"
   pnpm install
   ```

   If you are already in that worktree on that branch, skip this block.

2. Dependency checks. Run them from the worktree root. Each line prints `FAIL` and the
   step name when that step is not in `fix/feedback-fixes`:

   ```bash
   test -f scripts/e2e-lock.mjs || echo "FAIL W0: scripts/e2e-lock.mjs is missing"
   grep -qs "export function effectiveGymSeconds" lib/metrics/gymTime.ts || echo "FAIL C2: effectiveGymSeconds is missing in lib/metrics/gymTime.ts"
   grep -qs "export function sessionsByDate" lib/metrics/sessionDays.ts || echo "FAIL C3: sessionsByDate is missing in lib/metrics/sessionDays.ts"
   grep -qs "birth_year:" lib/schema/profile.ts || echo "FAIL D1: birth_year is missing in lib/schema/profile.ts"
   grep -qs "STORES_V4" lib/db/dexie.ts || echo "FAIL D1: Dexie v5 is missing in lib/db/dexie.ts"
   grep -qs "export const WEEK_START" components/profile/UnitsCard.tsx || echo "FAIL G1: WEEK_START is missing in components/profile/UnitsCard.tsx"
   grep -qs "export const NO_GOALS" components/charts/rangeData.ts || echo "FAIL G2: NO_GOALS is missing in components/charts/rangeData.ts"
   grep -qs "export const NO_LIFTS" components/dashboard/summary.ts || echo "FAIL G3a: NO_LIFTS is missing in components/dashboard/summary.ts"
   ```

   If any check fails, the step it names is not merged into `fix/feedback-fixes`. Stop. Report which
   check failed. Do not do that step's work here.

3. Already done check:

   ```bash
   grep -qs "export function resolveMaxHeartRate" lib/metrics/heartRateZones.ts && echo "H1 is already done"
   ```

   If it prints, stop and report.

## Names this step uses from earlier steps

- C2, `lib/metrics/gymTime.ts`:

  ```ts
  export type GymTimeSource = 'typed' | 'sessions' | 'none'
  export function effectiveGymSeconds(
    entry: Pick<DailyEntry, 'gym_seconds'> | undefined,
    sessions: Pick<WorkoutSession, 'entry_date' | 'started_at' | 'ended_at' | 'deleted_at'>[],
  ): { seconds: number; source: GymTimeSource }
  ```

  `sessions` holds the sessions of 1 `entry_date` only.

- C3, `lib/metrics/sessionDays.ts`: `sessionsByDate(sessions)` returns a `Map` from
  `entry_date` to that day's sessions. C3 gave `analyse` the parameter
  `sessions: readonly WorkoutSession[] = []` and built `const byDate = sessionsByDate(sessions)`
  inside it.
- G2, `components/charts/rangeData.ts`: `analyse` then got `goals: ChartGoals = NO_GOALS` as
  its last parameter. After C3 and G2 the signature is:

  ```ts
  export function analyse(
    entries: readonly DailyEntry[],
    history: readonly DailyEntry[],
    tab: RangeTab,
    today: string,
    now: Date,
    stepGoal: number,
    unitSystem: UnitSystem = 'metric',
    sessions: readonly WorkoutSession[] = [],
    goals: ChartGoals = NO_GOALS,
  ): AnalyticsData
  ```

  Read the file first. If the order differs, add `maxHeartRate` after the last parameter
  that is there.

- G3a, `components/dashboard/summary.ts`:

  ```ts
  export type TodayLifts = {
    sessions: WorkoutSession[]
    sets: WorkoutSet[]
    earlierSets: WorkoutSet[]
  }
  export const NO_LIFTS: TodayLifts
  export function summarise(
    entries: readonly DailyEntry[],
    profile: Profile,
    today: string,
    now: Date,
    lifts: TodayLifts = NO_LIFTS,
  ): DashboardSummary
  ```

  `lifts.sessions` holds this week's sessions. `summarise` already computes
  `gym: effectiveGymSeconds(entry, lifts.sessions.filter((session) => session.entry_date === today))`
  and returns it as `summary.gym`.

- D1, `lib/schema/profile.ts`: `birth_year` and `max_heart_rate`, both nullable whole
  numbers with `.default(null)`. In the local `Profile` they are **optional**, so read each
  with `?? null`. `ProfileInput` is the zod output type.
- G1, `components/profile/TargetsCard.tsx`: `SAVE_FAILED`, `SAVED`, the save on blur, and
  `toast.show(SAVED_MESSAGE)` from B4 after each save.

## Context to read first

1. `docs/specs/2026-10-05-feedback-fixes-design.md`, section 3.4.
2. "Names this step uses from earlier steps" above. It holds the gym time, `analyse` and
   `summarise` signatures you build on.
3. `.claude/rules/testing.md`. `lib/metrics/**` and `lib/duration.ts` are test first.
4. `lib/metrics/heartRateZones.ts` and its test. The model you change.
5. `lib/metrics/gymTime.ts` from C2. `effectiveGymSeconds` is the gym time input.
6. `components/dashboard/summary.ts` and `components/charts/rangeData.ts`, `analyse`.
   G3a gave `summarise` a last parameter `lifts` (this week's sessions and today's sets)
   and the field `gym`. C3 gave `analyse` the parameter `sessions` (all sessions), and G2
   the last parameter `goals`. Neither feeds the zones yet.
7. `components/dashboard/HeartRateZonesCard.tsx`, `components/charts/ZoneSplitChart.tsx`.
8. `components/profile/TargetsCard.tsx`, `targets.ts` and `ProfileView.tsx`. The
   pattern for the new card.
9. `lib/schema/profile.ts`. D1 added `birth_year` and `max_heart_rate`.
10. `lib/duration.ts`, `formatDuration`, style `short`.
11. Load the `design-system` skill. Open `docs/design/prototype/index.html`, plates `p1`,
    `p5` and `p6`.

## State before the step

- `heartRateZones(session)` takes 1 argument. The floors are 60, 70 and 85 % of
  `max(average, peak)`, the session peak.
- `shareBelow` has no upper clamp. With the session peak as the reference, a floor never
  passes the peak, so it never needed one. With a true maximum it does.
- The profile holds `birth_year` and `max_heart_rate` (D1). No screen edits them.
- `formatDuration(30, 'short')` returns `0m`. A zone of 30 s reads "Warm 0m".
- The card footer says "Modelled from the session average and peak." in every case.

## Goal

The zones use the maximum heart rate of the person. The override wins, then
`220 − age`, then the old model with a note that asks for the birth year. A sub-minute
zone reads `<1m`.

## Decision: a new "Heart rate" card in Profile, not a field in Targets

After G1, `TargetsCard` holds 6 goals plus height. A goal is a number the person aims at.
The birth year and the maximum heart rate are facts about the body that feed one model.
The new card also shows the maximum the app uses and where it comes from, which has no
place in a goals card. A separate card keeps `TargetsCard` short on the phone.

## Do

1. Run the `test-writer` agent with the acceptance list below. The tests come first.
2. `lib/duration.ts`: in the `short` style, a value from 1 to 59 seconds after rounding
   returns `<1m`. 0 stays `0m`. No other style changes.
   ```ts
   if (style === 'short') {
     if (safe > 0 && safe < SECONDS_PER_MINUTE) {
       return '<1m'
     }

     if (hours === 0) {
       return `${String(minutes)}m`
     }
   ```
3. `lib/metrics/heartRateZones.ts`. Keep the type names `HeartRateSession` and
   `HeartRateZones`. Add:
   ```ts
   import type { ProfileInput } from '../schema/profile'

   export type MaxHeartRate = { bpm: number; source: 'override' | 'age' }

   export const AGE_FORMULA_BASE = 220

   export function resolveMaxHeartRate(
     profile: Pick<ProfileInput, 'max_heart_rate' | 'birth_year'>,
     today: string,
   ): MaxHeartRate | null {
     if (profile.max_heart_rate !== null) {
       return { bpm: profile.max_heart_rate, source: 'override' }
     }

     if (profile.birth_year !== null) {
       const age = Number(today.slice(0, 4)) - profile.birth_year

       return { bpm: AGE_FORMULA_BASE - age, source: 'age' }
     }

     return null
   }
   ```
   Change `shareBelow` to clamp at 1, and give `heartRateZones` a required second
   argument:
   ```ts
   function shareBelow(beat: number, low: number, high: number): number {
     if (high <= low) {
       return beat > high ? 1 : 0
     }

     return Math.min(1, Math.max(0, (beat - low) / (high - low)))
   }

   export function heartRateZones(
     session: HeartRateSession,
     maxHeartRate: number | null,
   ): HeartRateZones {
     const seconds = Math.max(0, Math.trunc(session.gym_seconds ?? 0))
     const average = session.avg_heart_rate
     const peak = session.max_heart_rate

     if (seconds === 0 || average === null || peak === null || peak <= 0) {
       return { ...NO_ZONES }
     }

     const high = Math.max(average, peak)
     const low = Math.max(0, 2 * average - high)
     const reference = maxHeartRate ?? high

     const belowFatBurn = Math.round(
       seconds * shareBelow(ZONE_FLOORS.fatBurn * reference, low, high),
     )
     const belowCardio = Math.round(seconds * shareBelow(ZONE_FLOORS.cardio * reference, low, high))
     const belowPeak = Math.round(seconds * shareBelow(ZONE_FLOORS.peak * reference, low, high))

     return {
       warmSeconds: belowFatBurn,
       fatBurnSeconds: belowCardio - belowFatBurn,
       cardioSeconds: belowPeak - belowCardio,
       peakSeconds: seconds - belowPeak,
     }
   }
   ```
   With `high <= low` the session is flat at 1 beat. A floor above that beat holds the
   whole session below it, so the share is 1. A floor at or below it holds none, so the
   share is 0. With no max every floor sits below `high`, so a flat session stays wholly
   in Peak, as the existing test "puts a flat session at the peak heart rate wholly in
   the peak zone" asserts.
   The spread model stays. Only the floors move.
4. `components/dashboard/summary.ts`:
   - Add `maxHeartRate: MaxHeartRate | null` to `DashboardSummary`. Set it with
     the `maxHeartRate` constant below. The local `Profile` holds both fields as optional,
     so build the `Pick` with `?? null`.
   - The zones input is the entry of today with `gym_seconds` replaced by the effective
     value. G3a already computes it. Reuse that value, and do not call
     `effectiveGymSeconds` a second time:
     ```ts
     const gym = effectiveGymSeconds(
       entry,
       lifts.sessions.filter((session) => session.entry_date === today),
     )
     const maxHeartRate = resolveMaxHeartRate(
       { max_heart_rate: profile.max_heart_rate ?? null, birth_year: profile.birth_year ?? null },
       today,
     )
     ```
     Move the `gym` line above the `return` if G3a wrote it inline, and return `gym` and
     `maxHeartRate` from those 2 constants.
     and `zones: heartRateZones({ gym_seconds: gym.seconds, avg_heart_rate:
entry?.avg_heart_rate ?? null, max_heart_rate: entry?.max_heart_rate ?? null },
maxHeartRate?.bpm ?? null)`.
5. `components/charts/rangeData.ts`:
   - Add `maxHeartRate: MaxHeartRate | null` to `AnalyticsData`.
   - `analyse` gets a last parameter, after the `goals` of G2:
     `maxHeartRate: MaxHeartRate | null = null`. It stores it and passes
     `maxHeartRate?.bpm ?? null` to `heartRateZones`. The zones input uses
     `effectiveGymSeconds(todayEntry, byDate.get(today) ?? [])`, with the `byDate` map C3
     already builds.
   - `components/charts/useAnalytics.ts` passes
     `resolveMaxHeartRate({ max_heart_rate: profile.max_heart_rate ?? null, birth_year: profile.birth_year ?? null }, today)`
     as the last argument, inside the `useMemo` that C1 added. The profile is already in
     `loaded.source`.
6. `components/dashboard/HeartRateZonesCard.tsx`:
   - New prop `maxHeartRate: MaxHeartRate | null`.
   - New export:
     ```ts
     export const NO_MAX_NOTE = 'Add your birth year in Profile for real zones.'

     export function zoneNote(maxHeartRate: MaxHeartRate | null): string {
       if (maxHeartRate === null) {
         return NO_MAX_NOTE
       }

       const from = maxHeartRate.source === 'age' ? 'from your birth year' : 'set in Profile'

       return `Based on a max of ${String(maxHeartRate.bpm)} bpm, ${from}.`
     }
     ```
   - The footer line `Modelled from the session average and peak.` becomes
     `{zoneNote(maxHeartRate)}`, same classes.
   - `components/dashboard/Dashboard.tsx` passes it as
     `<HeartRateZonesCard zones={summary.zones} maxHeartRate={summary.maxHeartRate} />`.
     G3b greps for that exact prop.
7. `components/charts/ZoneSplitChart.tsx`: new prop `maxHeartRate: MaxHeartRate | null`.
   The footer uses `zoneNote`. `AnalyticsView` passes `data.maxHeartRate`.
8. `components/profile/heartRate.ts`, the parse helpers for the new card:
   ```ts
   import { profileSchema } from '../../lib/schema/profile'

   import type { Profile } from '../../lib/db/dexie'
   import type { MaxHeartRate } from '../../lib/metrics/heartRateZones'

   export type HeartRateField = 'birth_year' | 'max_heart_rate'

   export const HEART_RATE_FIELDS: readonly HeartRateField[] = ['birth_year', 'max_heart_rate']

   export const HEART_RATE_LABELS: Record<HeartRateField, string> = {
     birth_year: 'Birth year',
     max_heart_rate: 'Max heart rate (bpm)',
   }

   export const MAX_HINT = 'Leave empty to use 220 minus your age.'

   export type HeartRateParse =
     { ok: true; patch: Partial<Profile> } | { ok: false; message: string }

   export function heartRateText(profile: Profile, field: HeartRateField): string {
     const value = profile[field]

     return value === null ? '' : String(value)
   }

   export function parseHeartRate(field: HeartRateField, text: string): HeartRateParse {
     const trimmed = text.trim()
     const result = profileSchema.shape[field].safeParse(trimmed === '' ? null : Number(trimmed))

     if (!result.success) {
       return { ok: false, message: result.error.issues[0]?.message ?? 'Check this value.' }
     }

     return { ok: true, patch: { [field]: result.data } }
   }

   export function maxSourceText(maxHeartRate: MaxHeartRate | null): string {
     if (maxHeartRate === null) {
       return 'Add your birth year to see your max.'
     }

     const from = maxHeartRate.source === 'age' ? 'from your age' : 'your own value'

     return `The zones use ${String(maxHeartRate.bpm)} bpm, ${from}.`
   }
   ```
9. `components/profile/HeartRateCard.tsx`. Copy the draft, blur and save logic of
   `TargetsCard`, with the B4 toast: `const toast = useToast()` and
   `toast.show(SAVED_MESSAGE)` after a save. Reuse `SAVE_FAILED` and `SAVED` from
   `TargetsCard.tsx`.
   - Props: `profile: Profile`, `onSave: (patch: Partial<Profile>) => Promise<void>`,
     `today?: string` (default `localDate(new Date())`), `className?: string`.
   - `MicroLabel as="p"` "Heart rate".
   - 2 `NumberField`s with `inputMode="numeric"`. The max field carries `hint={MAX_HINT}`.
   - Under the fields, `<p className="text-muted mt-2.5 text-xs">` with
     `maxSourceText(resolveMaxHeartRate(profile, today))`.
   - The `role="status"` line for `SAVED`, as in `TargetsCard`.
10. `components/profile/ProfileView.tsx`: render `<HeartRateCard profile={profile}
onSave={onSaveTarget} />` right after `TargetsCard`. No new prop on `ProfileView`.
11. `app/styleguide/page.tsx`: pass `maxHeartRate` to the zones card samples. Add one
    sample with `null`, so the note shows. Add a `HeartRateCard` sample to the Profile
    section.
12. `docs/design/prototype/index.html`:
    - Plate `p1` and `p5`: the zones footer reads "Based on a max of 190 bpm, from your
      birth year."
    - Plate `p6`: a "Heart rate" card after Targets, with "Birth year 1996", an empty
      "Max heart rate (bpm)" with its hint, and "The zones use 190 bpm, from your age."
      Copy the markup of the Targets card on that plate.

## Acceptance criteria

- [ ] `formatDuration(30, 'short')` is `<1m`. 1 s and 59 s are `<1m`. 0 s is `0m`. 60 s is `1m`.
- [ ] `resolveMaxHeartRate` returns the override with source `override` when both fields are set.
- [ ] `resolveMaxHeartRate` returns `220 − age` with source `age` when only the birth year is set.
- [ ] `resolveMaxHeartRate` counts the age from the year of `today`.
- [ ] `resolveMaxHeartRate` returns null when neither field is set.
- [ ] With a max of 190, an hour at average 150 and peak 160 is all Cardio, not Peak.
- [ ] With a max of 190, an hour at 120 and 180 splits 1620, 570, 855 and 555 seconds.
- [ ] A peak above the max still fills the Peak zone.
- [ ] With a null max, every old result stays the same.
- [ ] The 4 zones add up to the session length for any max.
- [ ] `summarise` returns the max from the profile and models the zones with it.
- [ ] `summarise` models the zones from the session time when no gym time is typed.
- [ ] `analyse` passes the max to the zones and returns it.
- [ ] The zones card shows "Add your birth year in Profile for real zones." when the max is null.
- [ ] The zones card names the max and its source when the max is known.
- [ ] A 30 s zone reads "Warm <1m" in the card.
- [ ] The Heart rate card saves a birth year on blur, and refuses a year outside the schema range.
- [ ] The Heart rate card clears the override when the field is emptied.
- [ ] The Heart rate card shows the max the zones use.
      Test: `it('shows the max the zones use')` in `HeartRateCard.test.tsx`.
- [ ] A profile with no `birth_year` and no `max_heart_rate` field at all (a row from
      before Dexie v5) gives a null max and the old model. Test: the "returns null when
      the profile holds neither field" case, and `summarise([], PROFILE, TODAY, NOW)`
      returning `maxHeartRate: null` in `summary.test.tsx`.
- [ ] The G3a fields stay: `summary.gym`, `summary.workouts` and the goals pass their
      G3a tests unchanged in `summary.test.tsx`.
- [ ] The G2 goal lines stay: `analyse` still returns `goals`. Test: the G2 cases in
      `rangeData.test.tsx` pass unchanged.
- [ ] `ProfileView` renders the Heart rate card after the Goals card. Test:
      `ProfileView.test.tsx`.
- [ ] A Heart rate save shows the `Saved` toast inside a `ToastProvider`. Test:
      `it('shows the Saved toast after a birth year saves')` in `HeartRateCard.test.tsx`.
- [ ] Every new field is 44 px or taller and has a label. Test:
      `tests/e2e/responsive.spec.ts` on `/profile`, and axe in `tests/e2e/a11y.spec.ts`.
- [ ] Plates `p1`, `p5` and `p6` show the new note and the Heart rate card. Manual check:
      the `ui-reviewer` agent reports no drift.

## Tests

`lib/duration.test.ts`, add to `shortCases`:

```ts
    { seconds: 1, text: '<1m' },
    { seconds: 30, text: '<1m' },
    { seconds: 59, text: '<1m' },
    { seconds: 0.4, text: '0m' },
    { seconds: 59.6, text: '1m' },
    { seconds: 60, text: '1m' },
```

`lib/metrics/heartRateZones.test.ts`. Every old call becomes `heartRateZones(x, null)`,
with no other change. Then add:

```ts
describe('resolveMaxHeartRate', () => {
  it('uses the override when the profile holds both fields', () => {
    expect(resolveMaxHeartRate({ max_heart_rate: 175, birth_year: 1996 }, '2026-09-23')).toEqual({
      bpm: 175,
      source: 'override',
    })
  })

  it('takes 220 minus the age when only the birth year is set', () => {
    expect(resolveMaxHeartRate({ max_heart_rate: null, birth_year: 1996 }, '2026-09-23')).toEqual({
      bpm: 190,
      source: 'age',
    })
  })

  it('counts the age from the year of today', () => {
    expect(resolveMaxHeartRate({ max_heart_rate: null, birth_year: 1996 }, '2027-01-01')).toEqual({
      bpm: 189,
      source: 'age',
    })
  })

  it('returns null when the profile holds neither field', () => {
    expect(resolveMaxHeartRate({ max_heart_rate: null, birth_year: null }, '2026-09-23')).toBeNull()
  })
})

describe('heartRateZones with a maximum heart rate', () => {
  it('keeps an hour at 150 average and 160 peak out of the peak zone with a max of 190', () => {
    expect(heartRateZones(session({ avg_heart_rate: 150, max_heart_rate: 160 }), 190)).toEqual({
      warmSeconds: 0,
      fatBurnSeconds: 0,
      cardioSeconds: 3600,
      peakSeconds: 0,
    })
  })

  it('puts the same hour wholly in the peak zone with no max, as before', () => {
    expect(
      heartRateZones(session({ avg_heart_rate: 150, max_heart_rate: 160 }), null).peakSeconds,
    ).toBe(3600)
  })

  it('splits an hour at 120 average and 180 peak against a max of 190', () => {
    expect(heartRateZones(session(), 190)).toEqual({
      warmSeconds: 1620,
      fatBurnSeconds: 570,
      cardioSeconds: 855,
      peakSeconds: 555,
    })
  })

  it('fills the peak zone when the session peak passes the max', () => {
    expect(heartRateZones(session({ avg_heart_rate: 170, max_heart_rate: 200 }), 175)).toEqual({
      warmSeconds: 0,
      fatBurnSeconds: 0,
      cardioSeconds: 525,
      peakSeconds: 3075,
    })
  })

  it('puts a flat session below the cardio floor in the fat burn zone', () => {
    expect(
      heartRateZones(session({ gym_seconds: 600, avg_heart_rate: 125, max_heart_rate: 125 }), 190),
    ).toEqual({ warmSeconds: 0, fatBurnSeconds: 600, cardioSeconds: 0, peakSeconds: 0 })
  })

  it('adds up to the session length for any max', () => {
    for (const max of [100, 150, 190, 230]) {
      expect(total(heartRateZones(session(), max))).toBe(3600)
    }
  })
})
```

The flat case by hand: `high = low = 125`. The fat burn floor, 114, is below the beat,
so the share below it is 0. The cardio floor, 133, is above it, so the share below it is

1. The 600 seconds land in Fat burn.

`components/dashboard/HeartRateZonesCard.test.tsx`: every render passes
`maxHeartRate={null}` unless the test says otherwise. Add:

```ts
  it('asks for the birth year when the max is not known', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={null} />)
    expect(screen.getByText('Add your birth year in Profile for real zones.')).toBeInTheDocument()
  })

  it('names the max and its source when the max is known', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={{ bpm: 190, source: 'age' }} />)
    expect(screen.getByText('Based on a max of 190 bpm, from your birth year.')).toBeInTheDocument()
  })

  it('names an override as set in Profile', () => {
    render(<HeartRateZonesCard zones={ZONES} maxHeartRate={{ bpm: 175, source: 'override' }} />)
    expect(screen.getByText('Based on a max of 175 bpm, set in Profile.')).toBeInTheDocument()
  })

  it('shows a zone under a minute as less than a minute', () => {
    render(<HeartRateZonesCard zones={{ ...ZONES, warmSeconds: 30 }} maxHeartRate={null} />)
    expect(screen.getByText('Warm <1m')).toBeInTheDocument()
  })
```

`components/dashboard/summary.test.tsx`: the existing zone test becomes
`heartRateZones(entry, null)`. Add:

```ts
it('returns the max from the birth year of the profile', () => {
  const profile = { ...PROFILE, birth_year: 1996, max_heart_rate: null }
  expect(summarise([], profile, TODAY, NOW).maxHeartRate).toEqual({ bpm: 190, source: 'age' })
})

it('models the zones of today against the max of the profile', () => {
  const entry = entryOn(TODAY, { avg_heart_rate: 150, max_heart_rate: 160, gym_seconds: 3600 })
  const profile = { ...PROFILE, birth_year: 1996, max_heart_rate: null }
  expect(summarise([entry], profile, TODAY, NOW).zones.peakSeconds).toBe(0)
})
```

```ts
it('models the zones from the session time when no gym time is typed', () => {
  const entry = entryOn(TODAY, { gym_seconds: null, avg_heart_rate: 150, max_heart_rate: 160 })
  const zones = summarise([entry], PROFILE, TODAY, NOW, {
    ...NO_LIFTS,
    sessions: [sessionOn(TODAY)],
  }).zones
  expect(zones.warmSeconds + zones.fatBurnSeconds + zones.cardioSeconds + zones.peakSeconds).toBe(
    3600,
  )
})
```

`sessionOn` comes from `tests/fixtures/lifts.ts`. It makes a finished 1 hour session.
`NO_LIFTS` comes from `./summary` (G3a).

`components/charts/rangeData.test.tsx`:

```ts
it('returns no max when none is passed', () => {
  expect(analyse([], [], 'day', TODAY, NOW, 12000).maxHeartRate).toBeNull()
})

it('models the zones of today against the max it is given', () => {
  const entry = entryOn(TODAY, { gym_seconds: 3600, avg_heart_rate: 150, max_heart_rate: 160 })
  const data = analyse([entry], [entry], 'day', TODAY, NOW, 12000, 'metric', [], NO_GOALS, {
    bpm: 190,
    source: 'age',
  })
  expect(data.maxHeartRate).toEqual({ bpm: 190, source: 'age' })
  expect(data.zones.peakSeconds).toBe(0)
  expect(data.zones.cardioSeconds).toBe(3600)
})

it('models the zones of today from its session when no gym time is typed', () => {
  const entry = entryOn(TODAY, { gym_seconds: null, avg_heart_rate: 150, max_heart_rate: 160 })
  const data = analyse([entry], [entry], 'day', TODAY, NOW, 12000, 'metric', [sessionOn(TODAY)])
  expect(data.zones.peakSeconds).toBe(3600)
})
```

`components/profile/heartRate.test.ts`: `parseHeartRate('birth_year', '1996')` gives
`{ ok: true, patch: { birth_year: 1996 } }`. `parseHeartRate('max_heart_rate', '')` gives
`{ ok: true, patch: { max_heart_rate: null } }`. `parseHeartRate('birth_year', '1850')`
gives `ok: false` with the schema message. `maxSourceText` returns each of its 3 texts.

`components/profile/HeartRateCard.test.tsx`. Copy the setup of `TargetsCard.test.tsx`:

```ts
const SET = { ...PROFILE, birth_year: 1996, max_heart_rate: null }

function renderCard(onSave = vi.fn(() => Promise.resolve()), profile = SET) {
  render(<HeartRateCard profile={profile} onSave={onSave} today="2026-09-23" />)
  return onSave
}

describe('HeartRateCard', () => {
  it('labels both fields', () => {
    renderCard()
    expect(screen.getByLabelText('Birth year')).toHaveValue('1996')
    expect(screen.getByLabelText('Max heart rate (bpm)')).toHaveValue('')
  })

  it('shows the max the zones use', () => {
    renderCard()
    expect(screen.getByText('The zones use 190 bpm, from your age.')).toBeInTheDocument()
  })

  it('saves a changed birth year when the field loses focus', async () => {
    const onSave = renderCard()
    const field = screen.getByLabelText('Birth year')
    await userEvent.clear(field)
    await userEvent.type(field, '1990')
    await userEvent.tab()
    expect(onSave).toHaveBeenCalledWith({ birth_year: 1990 })
  })

  it('clears the override when the field is emptied', async () => {
    const onSave = renderCard(undefined, { ...SET, max_heart_rate: 180 })
    await userEvent.clear(screen.getByLabelText('Max heart rate (bpm)'))
    await userEvent.tab()
    expect(onSave).toHaveBeenCalledWith({ max_heart_rate: null })
  })

  it('refuses a birth year outside the range and ties the message to the field', async () => {
    const onSave = renderCard()
    const field = screen.getByLabelText('Birth year')
    await userEvent.clear(field)
    await userEvent.type(field, '1850')
    await userEvent.tab()
    expect(onSave).not.toHaveBeenCalled()
    expect(field).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows the Saved toast after a birth year saves', async () => {
    render(
      <ToastProvider>
        <HeartRateCard profile={SET} onSave={vi.fn(() => Promise.resolve())} today="2026-09-23" />
      </ToastProvider>,
    )
    const field = screen.getByLabelText('Birth year')
    await userEvent.clear(field)
    await userEvent.type(field, '1990')
    await userEvent.tab()
    expect(await screen.findByTestId('toast-region')).toHaveTextContent(SAVED_MESSAGE)
  })
})
```

Import `{ SAVED_MESSAGE, ToastProvider }` from `'../ui/Toast'`.

`components/dashboard/summary.test.tsx`, add:

```ts
it('returns no max for a profile with no heart rate field', () => {
  expect(summarise([], PROFILE, TODAY, NOW).maxHeartRate).toBeNull()
})
```

`ZoneSplitChart.test.tsx` and `ProfileView.test.tsx`: pass the new prop, and assert the
Heart rate card renders in `ProfileView`.

## Verification

1. `pnpm test:cov`. `lib/duration.ts` stays at 100. `lib/metrics/**` stays at 100 lines,
   95 branches and 100 functions.
2. `pnpm design:check`.
3. `pnpm verify:parallel`.
4. In the browser, at 390, 768 and 1440 px: set the birth year to 1996 in Profile. Log
   today with gym time 60 min, average 150 and peak 160. Today and Stats show Cardio, not
   Peak. Clear the birth year. The note asks for it.

## Files touched

- `lib/duration.ts` and its test
- `lib/metrics/heartRateZones.ts` and its test
- `components/dashboard/summary.ts`, `HeartRateZonesCard.tsx`, `Dashboard.tsx` and their tests
- `components/charts/rangeData.ts`, `useAnalytics.ts`, `ZoneSplitChart.tsx`, `Analytics.tsx` and their tests
- `components/profile/heartRate.ts`, `HeartRateCard.tsx`, `ProfileView.tsx` and their tests
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
   to the matching prototype plate.
3. Commit on `fix/h1-max-heart-rate`:

   ```bash
   git add lib/duration.ts \
     lib/duration.test.ts \
     lib/metrics/heartRateZones.ts \
     lib/metrics/heartRateZones.test.ts \
     components/dashboard/summary.ts \
     components/dashboard/summary.test.tsx \
     components/dashboard/HeartRateZonesCard.tsx \
     components/dashboard/HeartRateZonesCard.test.tsx \
     components/dashboard/Dashboard.tsx \
     components/dashboard/Dashboard.test.tsx \
     components/charts/rangeData.ts \
     components/charts/rangeData.test.tsx \
     components/charts/useAnalytics.ts \
     components/charts/useAnalytics.test.tsx \
     components/charts/ZoneSplitChart.tsx \
     components/charts/ZoneSplitChart.test.tsx \
     components/charts/Analytics.tsx \
     components/charts/Analytics.test.tsx \
     components/profile/heartRate.ts \
     components/profile/heartRate.test.ts \
     components/profile/HeartRateCard.tsx \
     components/profile/HeartRateCard.test.tsx \
     components/profile/ProfileView.tsx \
     components/profile/ProfileView.test.tsx \
     app/styleguide/page.tsx \
     app/styleguide/page.test.tsx \
     docs/design/prototype/index.html
   git commit -m "fix(charts): base the heart rate zones on a true maximum heart rate"
   ```

   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.

4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked,
   and anything the owner must check on the iPhone.
