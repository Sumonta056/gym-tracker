# Step D1 — The migration, Dexie v5, schemas, mappings

**Branch:** `fix/d1-schema`, in worktree `../gym-tracker-d1`, cut from `fix/feedback-fixes` ·
**Wave:** 4 · **Size:** M · **Depends on:** W0, A3 · **Unlocks:** E5, G1, H1, I1 ·
**Agent to use:** `test-writer`, then `sync-auditor`
**Items:** none, it enables 1, 10, 11, 14 · **Skills to load:** `db-migration`

## Before you start

### The worktree

```bash
cd /Users/cefalo_1/Documents/Projects/gym-tracker
git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-d1 -b fix/d1-schema fix/feedback-fixes
cd ../gym-tracker-d1
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
{ grep -q "DATABASE_VERSION = 4" lib/db/dexie.ts && grep -q "errorLog" lib/db/dexie.ts && test -f lib/schema/errorRecord.ts; } || echo "FAIL: A3 is not merged (Dexie is not at version 4 with errorLog)"
echo "Dependency checks finished."
```

If any check fails, the step it names is not merged into `fix/feedback-fixes`. Stop. Report which check
failed. Do not do that step's work here.

### Already done check

```bash
ls supabase/migrations | grep -q "_feedback_goals_and_swim\.sql$" && echo "DONE: D1 is already on this branch"
```

If it passes, stop and report.

### The live database

The live Supabase project can hold this migration even when the local file is missing,
if an earlier run stopped half way. Run the Supabase MCP `list_migrations` now. If it
lists `feedback_goals_and_swim`, never apply it again. In **Do** step 3, skip
`apply_migration`, write the local file under the version that `list_migrations` shows,
and go on with step 4.

## Context to read first

1. `.claude/rules/architecture.md` — the owner column, "The last push wins", the soft
   delete rule.
2. `.claude/skills/db-migration/SKILL.md`. Follow it. This step is its pair.
3. `docs/specs/2026-10-05-feedback-fixes-design.md`, section 3.1.
4. The field list in **Names this step uses from earlier steps** below.
5. `supabase/migrations/20260921162445_phase1_profiles_and_daily_entries.sql` and
   `supabase/migrations/20260927142258_phase2_workouts.sql` — the RLS policies and the
   last `add column` on `profiles`.
6. `lib/db/dexie.ts` as A3 left it: `DATABASE_VERSION = 4`, with the local `errorLog`
   table.
7. `lib/schema/profile.ts`, `lib/schema/dailyEntry.ts`, `lib/sync/mappings.ts`,
   `lib/db/repository.ts` (`PROFILE_FIELDS`, `getProfile`).
8. `lib/csv/export.ts`, `lib/csv/import.ts`, `components/csv/reviewState.ts`.
9. `lib/sync/worker.test.ts`, the tests `leaves out the rest settings a device row
never had` and `the rest settings round trip`. The new fields follow that pattern.
10. The Supabase rule of this project. There is no direct Postgres route. A migration
    reaches the live project only through the Supabase MCP `apply_migration`. Then
    rename the local file to the version that `list_migrations` shows. Never apply an
    old migration again. The 5 files in `supabase/migrations/` before this step are
    already applied.

## Names this step uses from earlier steps

From A3, `lib/db/dexie.ts`:

- `DATABASE_VERSION = 4`.
- The store maps `STORES_V1`, `STORES_V2`, `STORES_V3` (A3 renamed the version 3 map to
  it) and `STORES`, the version 4 map. `STORES` adds `errorLog: '&id, at'`.
- `createDatabase` declares `instance.version(1).stores(STORES_V1)` up to
  `instance.version(DATABASE_VERSION).stores(STORES)`.
- `errorLog` is local only: no outbox, no sync, cleared by `clearAll`.

From A2: a tab that gets `versionchange` shows the `VersionBanner` and asks for a
reload. This step relies on it and changes nothing in it.

The new fields. G1, H1, I1 and E5 use these exact names:

- `profiles`: `calorie_goal`, `gym_goal_seconds`, `walk_goal_seconds`,
  `sessions_per_week_goal`, `birth_year`, `max_heart_rate`, `stats_layout`.
- `daily_entries`: `swim_seconds`.
- The new profile fields are optional in the local `Profile` type. Every read uses
  `?? null`.
- Dexie v5 re-declares every table. No new index.

## State before the step

- `profiles` has no goal other than `step_goal`, no birth year, no maximum heart rate
  and no card layout.
- `daily_entries` has no swim time.
- Dexie is at version 4.

## Goal

1 migration adds 7 nullable columns to `profiles` and 1 to `daily_entries`, each with
a check. The zod schemas, the generated types, the sync mappings, the repository and
the CSV files carry every new field. Dexie moves to version 5. Nothing on screen
changes, except a `Swim time` label in the CSV review.

## The design decisions

- **The birth year check.** A Postgres `CHECK` must be immutable, so it cannot call
  `now()`. The database holds a fixed range, `1900` to `2100`. The zod schema holds
  the real rule, `1900` to the current year − 10. Zod is always the stricter one, so a
  value zod accepts never fails the server check and never lands in the dead letters.
- **The swim check.** `walk_seconds` has no database check today. Only zod refuses a
  negative. Swim gets a database check of `0` to `86 400`, and zod gets the same range
  from `MAX_DURATION_SECONDS`.
- **The local types stay lenient.** A row written before v5 has no new field. The
  `Profile` interface already makes the rest settings optional for that reason. The
  new profile fields join that list, and `DailyEntry.swim_seconds` becomes optional the
  same way. `getProfile` fills a missing field from the schema defaults.
- **A missing field is not sent.** The mappings copy the local value as it is. A field
  that is `undefined` drops out of the JSON body, so the upsert leaves the server value
  alone. This is what the rest settings already do. Never write `?? null` in
  `toServerProfile` or `toServerEntry`: that would wipe a goal set on another device.
- **Dexie v5 changes no store and needs no upgrade.** It re-declares the v4 stores. The
  bump makes an open v4 tab receive `versionchange`, so the A2 banner asks it to reload
  into code that knows the new fields.

## Do

1. Run the `test-writer` agent with the acceptance list. The tests in **Tests** come
   first. `lib/sync/**` is test first by rule.
2. Write `supabase/migrations/<timestamp>_feedback_goals_and_swim.sql`:

   ```sql
   alter table public.profiles
     add column if not exists calorie_goal integer
       constraint profiles_calorie_goal_range check (calorie_goal between 1 and 10000),
     add column if not exists gym_goal_seconds integer
       constraint profiles_gym_goal_seconds_range check (gym_goal_seconds between 60 and 86400),
     add column if not exists walk_goal_seconds integer
       constraint profiles_walk_goal_seconds_range check (walk_goal_seconds between 60 and 86400),
     add column if not exists sessions_per_week_goal integer
       constraint profiles_sessions_per_week_goal_range
         check (sessions_per_week_goal between 1 and 14),
     add column if not exists birth_year integer
       constraint profiles_birth_year_range check (birth_year between 1900 and 2100),
     add column if not exists max_heart_rate integer
       constraint profiles_max_heart_rate_range check (max_heart_rate between 30 and 230),
     add column if not exists stats_layout jsonb
       constraint profiles_stats_layout_array check (jsonb_typeof(stats_layout) = 'array');

   alter table public.daily_entries
     add column if not exists swim_seconds integer
       constraint daily_entries_swim_seconds_range check (swim_seconds between 0 and 86400);
   ```

   Every column is nullable with no default, so no existing row changes. A null passes
   every check. `10000` is `MAX_CALORIES_BURNT`. `30` and `230` are `MIN_HEART_RATE`
   and `MAX_HEART_RATE`. The RLS policies already cover every column of both tables.
   Add no policy.

3. Apply it with the Supabase MCP `apply_migration`, name `feedback_goals_and_swim`.
   Run `list_migrations`. Rename the local file to the version it shows.
4. Verify the live project with the Supabase MCP:
   - `execute_sql`:
     ```sql
     select conname, pg_get_constraintdef(oid)
     from pg_constraint
     where conrelid in ('public.profiles'::regclass, 'public.daily_entries'::regclass)
       and contype = 'c'
     order by conname;
     ```
     The 8 new checks are in the list.
   - `execute_sql`:
     ```sql
     select tablename, policyname, cmd, qual, with_check
     from pg_policies
     where schemaname = 'public' and tablename in ('profiles', 'daily_entries')
     order by tablename, policyname;
     ```
     4 policies per table, each on `auth.uid()`, the same as before the step.
   - `get_advisors` with type `security`. No new finding.
     Paste both results into the report's evidence section.
5. Regenerate `lib/supabase/database.types.ts` with the Supabase MCP
   `generate_typescript_types`. Write the output over the file, then run Prettier on it.
6. `lib/schema/profile.ts`. Add the constants and the 7 fields. `lib/duration.ts`
   imports nothing, so the import makes no cycle.

   ```ts
   import { MAX_DURATION_SECONDS } from '../duration'

   import {
     MAX_CALORIES_BURNT,
     MAX_HEART_RATE,
     MAX_STEPS,
     MAX_WEIGHT_KG,
     MIN_HEART_RATE,
     MIN_WEIGHT_KG,
   } from './dailyEntry'

   export const MIN_GOAL_SECONDS = 60
   export const MAX_SESSIONS_PER_WEEK = 14
   export const MIN_BIRTH_YEAR = 1900
   export const MIN_AGE_YEARS = 10
   export const MAX_STATS_CARDS = 40
   export const MAX_STATS_CARD_ID_LENGTH = 40

   export function maxBirthYear(now: Date = new Date()): number {
     return now.getFullYear() - MIN_AGE_YEARS
   }

   const goalSeconds = z
     .int({ error: 'Enter a whole number of seconds.' })
     .min(MIN_GOAL_SECONDS, { error: 'A time goal must be at least 1 minute.' })
     .max(MAX_DURATION_SECONDS, { error: 'A time goal cannot be longer than 24 hours.' })
     .nullable()
     .default(null)

   export const statsLayoutItemSchema = z.object({
     id: z.string().min(1).max(MAX_STATS_CARD_ID_LENGTH),
     hidden: z.boolean(),
   })
   ```

   Inside `profileSchema`, after `rest_seconds_by_exercise`:

   ```ts
     calorie_goal: z
       .int({ error: 'Enter a whole number of calories.' })
       .min(1, { error: 'A calorie goal must be at least 1.' })
       .max(MAX_CALORIES_BURNT, {
         error: `A calorie goal cannot be above ${String(MAX_CALORIES_BURNT)}.`,
       })
       .nullable()
       .default(null),
     gym_goal_seconds: goalSeconds,
     walk_goal_seconds: goalSeconds,
     sessions_per_week_goal: z
       .int({ error: 'Enter a whole number of sessions.' })
       .min(1, { error: 'A session goal must be at least 1 a week.' })
       .max(MAX_SESSIONS_PER_WEEK, {
         error: `A session goal cannot be above ${String(MAX_SESSIONS_PER_WEEK)} a week.`,
       })
       .nullable()
       .default(null),
     birth_year: z
       .int({ error: 'Enter a year such as 1990.' })
       .min(MIN_BIRTH_YEAR, { error: `A birth year cannot be before ${String(MIN_BIRTH_YEAR)}.` })
       .refine((year) => year <= maxBirthYear(), {
         error: `A birth year must be at least ${String(MIN_AGE_YEARS)} years ago.`,
       })
       .nullable()
       .default(null),
     max_heart_rate: z
       .int({ error: 'Enter a whole heart rate.' })
       .min(MIN_HEART_RATE, {
         error: `A heart rate cannot be below ${String(MIN_HEART_RATE)} bpm.`,
       })
       .max(MAX_HEART_RATE, {
         error: `A heart rate cannot be above ${String(MAX_HEART_RATE)} bpm.`,
       })
       .nullable()
       .default(null),
     stats_layout: z
       .array(statsLayoutItemSchema, { error: 'Enter the card layout as a list.' })
       .max(MAX_STATS_CARDS, {
         error: `A layout holds at most ${String(MAX_STATS_CARDS)} cards.`,
       })
       .nullable()
       .default(null),
   ```

   Also export `export type StatsLayoutStored = z.infer<typeof statsLayoutItemSchema>`.
   I1 owns the card ids and `resolveLayout`. It drops an unknown id, so the schema
   accepts any short string id here.

7. `lib/schema/dailyEntry.ts`. Import `MAX_DURATION_SECONDS` from `../duration` and add
   after `gym_seconds`:

   ```ts
     swim_seconds: z
       .int({ error: 'Enter a whole number of seconds.' })
       .min(0, { error: 'A duration cannot be negative.' })
       .max(MAX_DURATION_SECONDS, { error: 'A swim cannot be longer than 24 hours.' })
       .nullable()
       .default(null),
   ```

8. `lib/db/dexie.ts`:

   ```ts
   export interface DailyEntry
     extends Omit<DailyEntryInput, 'swim_seconds'>, Partial<Pick<DailyEntryInput, 'swim_seconds'>> {
     id: string
     created_at: string
     updated_at: string
     deleted_at: string | null
   }

   type RestSettings = 'rest_sound_muted' | 'rest_seconds_by_exercise'

   type GoalSettings =
     | 'calorie_goal'
     | 'gym_goal_seconds'
     | 'walk_goal_seconds'
     | 'sessions_per_week_goal'
     | 'birth_year'
     | 'max_heart_rate'
     | 'stats_layout'

   type LaterProfileFields = RestSettings | GoalSettings

   export interface Profile
     extends
       Omit<ProfileInput, LaterProfileFields>,
       Partial<Pick<ProfileInput, LaterProfileFields>> {
     id: string
     updated_at: string
   }
   ```

   Then the version. Rename the map A3 named `STORES` (the one with `errorLog`) to
   `STORES_V4`, keep its version line as `instance.version(4).stores(STORES_V4)`, and
   add:

   ```ts
   export const DATABASE_VERSION = 5

   export const STORES = { ...STORES_V4 } as const
   ```

   ```ts
   instance.version(DATABASE_VERSION).stores(STORES)
   ```

   No `.upgrade()`. No new index.

9. `lib/db/repository.ts`. Add the 7 profile fields to `PROFILE_FIELDS`, after
   `rest_seconds_by_exercise`. `getProfile` already spreads `defaultProfile()` under the
   stored row, so a v4 row reads every new field as `null`.

   In `dayFields`, add `swim_seconds: row.swim_seconds ?? null,` after `gym_seconds`.
   `dayFields` builds the `DailyEntryInput` that the CSV import merge starts from. A row
   saved before v5 has no `swim_seconds`, and the merge must see `null` there, so a
   sheet can fill it. `pnpm typecheck` fails without this line. This is local code, not
   a sync mapping, so the "no `?? null`" rule of the mappings does not apply here.

10. `lib/sync/mappings.ts`:
    - `toServerEntry`: `swim_seconds: payload.swim_seconds,`
    - `toLocalEntry`: `swim_seconds: row.swim_seconds,`
    - `toServerProfile`: each new field copied as it is, for example
      `calorie_goal: payload.calorie_goal,`. No `?? null`.
    - `toLocalProfile`: the 6 numbers copied from the row. The layout goes through the
      schema, like the rest settings:
      ```ts
      stats_layout: profileSchema.shape.stats_layout.safeParse(row.stats_layout).data ?? null,
      ```
11. `lib/csv/export.ts`. Add `'Swim Time'` to `DAILY_HEADER` after `'Gym Time'`, and
    `duration(row.swim_seconds ?? null)` at the same place in each row.
12. `lib/csv/import.ts`:
    - Add `'swim_seconds'` to `SheetField`.
    - Give each column an `optional` flag:
      `const COLUMNS: { name: string; field: SheetField; kind: Kind; optional?: boolean }[]`.
    - Add `{ name: 'Swim Time', field: 'swim_seconds', kind: 'duration', optional: true }`
      after `Gym Time`.
    - `columnIssues`: report a missing column only when it is not optional:
      `COLUMNS.filter(({ name, optional }) => optional !== true && !names.includes(name))`.
    - A sheet with no `Swim Time` column reads the cell as `''`, which is an `ok` cell
      with a null value. The owner's old sheet imports as before.
13. `components/csv/reviewState.ts`. Add `swim_seconds: 'Swim time'` to `FIELD_LABEL`,
    `'swim_seconds'` to `SHEET_FIELDS` after `'gym_seconds'`, and to `DURATION_FIELDS`.
14. Fix every literal that builds a `Tables<'profiles'>` or a `Tables<'daily_entries'>`
    in the tests, for example in `lib/sync/mappings.test.ts`. `pnpm typecheck` lists
    them.
15. Ask the `sync-auditor` agent to review the change to `lib/sync/mappings.ts`,
    `lib/db/dexie.ts` and `lib/db/repository.ts`. Fix what it finds before the report.

## Acceptance criteria

Schemas:

- [ ] `profileSchema.parse({})` gives `null` for all 7 new fields.
- [ ] `calorie_goal` accepts 1 and 10 000, and refuses 0 and 10 001.
- [ ] `gym_goal_seconds` and `walk_goal_seconds` accept 60 and 86 400, and refuse 59
      and 86 401.
- [ ] `sessions_per_week_goal` accepts 1 and 14, and refuses 0 and 15.
- [ ] `birth_year` accepts 1900 and the current year − 10, and refuses 1899 and the
      current year − 9.
- [ ] `max_heart_rate` accepts 30 and 230, and refuses 29 and 231.
- [ ] `stats_layout` accepts a list of `{ id, hidden }`, and refuses an object, an item
      with no `hidden` and an empty id.
- [ ] `dailyEntrySchema` gives `swim_seconds` a default of `null`, accepts 0 and
      86 400, and refuses −1, 86 401 and 1.5.
- [ ] The generated types hold every new key, so the `Assignable` checks in
      `profile.test.ts` and `dailyEntry.test.ts` compile.

Sync and storage:

- [ ] A mapping round trip keeps every new profile field and `swim_seconds`.
- [ ] `toServerProfile` leaves out a goal the local row never had.
- [ ] `toServerEntry` leaves out `swim_seconds` when the local row never had it.
- [ ] `toLocalProfile` reads a `stats_layout` that is not a list as `null`.
- [ ] A push and a pull through the worker keep every new profile field.
- [ ] A push and a pull through the worker keep `swim_seconds`.
- [ ] Dexie opens version 5 over a version 4 database and keeps every row.
- [ ] `getProfile` reads a profile saved before v5 with every new field `null`.
- [ ] `updateProfile` saves `calorie_goal` and queues it in the outbox in one write.
- [ ] An import merge keeps a stored `swim_seconds`. Test in
      `lib/db/repository.test.ts`, beside the `importDays` merge tests: a day stored
      with `swim_seconds: 1500` keeps it after an import fills its `steps`.
- [ ] `dayFields` carries `swim_seconds`. Check: `grep -n "swim_seconds" lib/db/repository.ts`
      finds the line. E5 checks for it.

CSV:

- [ ] The export writes a `Swim Time` column, in `h:mm:ss`.
- [ ] The export round trip imports `swim_seconds` back unchanged.
- [ ] A sheet with no `Swim Time` column imports with no `missing_column` issue and
      `swim_seconds` null.

Database, checked by hand and pasted in the report:

- [ ] The 8 checks exist on the live project.
- [ ] Both tables keep their 4 policies on `auth.uid()`.
- [ ] `get_advisors` with type `security` shows no new finding.
- [ ] `list_migrations` lists `feedback_goals_and_swim` once, and the local file name
      starts with that version.

Review and screen:

- [ ] The `sync-auditor` agent reports no lost write and no duplicate row.
- [ ] Nothing on screen changes except the `Swim time` label in the CSV review.
      Manual: screenshots in the report.

## Tests

`lib/schema/profile.test.ts`. Add `afterEach(() => { vi.useRealTimers() })` if the file
has none, and:

```ts
describe('the goal fields', () => {
  it('defaults every new field to null', () => {
    expect(profileSchema.parse({})).toMatchObject({
      calorie_goal: null,
      gym_goal_seconds: null,
      walk_goal_seconds: null,
      sessions_per_week_goal: null,
      birth_year: null,
      max_heart_rate: null,
      stats_layout: null,
    })
  })

  it.each([
    ['calorie_goal', 1, 10000, 0, 10001],
    ['gym_goal_seconds', 60, 86400, 59, 86401],
    ['walk_goal_seconds', 60, 86400, 59, 86401],
    ['sessions_per_week_goal', 1, 14, 0, 15],
    ['max_heart_rate', 30, 230, 29, 231],
  ])('keeps %s inside its range', (field, low, high, below, above) => {
    expect(parse({ [field]: low }).success).toBe(true)
    expect(parse({ [field]: high }).success).toBe(true)
    expect(parse({ [field]: below }).success).toBe(false)
    expect(parse({ [field]: above }).success).toBe(false)
  })

  it('accepts a birth year from 1900 to 10 years ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 5))
    expect(parse({ birth_year: 1900 }).success).toBe(true)
    expect(parse({ birth_year: 2016 }).success).toBe(true)
  })

  it('refuses a birth year before 1900 or less than 10 years ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 5))
    expect(parse({ birth_year: 1899 }).success).toBe(false)
    expect(firstIssue(parse({ birth_year: 2017 })).message).toBe(
      'A birth year must be at least 10 years ago.',
    )
  })

  it('accepts a card layout as a list of ids and hidden flags', () => {
    expect(parse({ stats_layout: [{ id: 'weight', hidden: true }] }).success).toBe(true)
  })

  it('refuses a card layout that is not a list, or an item with no hidden flag or id', () => {
    expect(parse({ stats_layout: { weight: true } }).success).toBe(false)
    expect(parse({ stats_layout: [{ id: 'weight' }] }).success).toBe(false)
    expect(parse({ stats_layout: [{ id: '', hidden: false }] }).success).toBe(false)
  })
})

describe('maxBirthYear', () => {
  it('is the year of the date minus 10', () => {
    expect(maxBirthYear(new Date(2026, 0, 1))).toBe(2016)
  })
})
```

`lib/schema/dailyEntry.test.ts`, using its own `parse` helper and a valid date:

```ts
describe('swim_seconds', () => {
  it('defaults to null', () => {
    expect(dailyEntrySchema.parse({ entry_date: '2026-09-01' }).swim_seconds).toBeNull()
  })

  it('accepts 0 and 24 hours', () => {
    expect(dailyEntrySchema.safeParse({ entry_date: '2026-09-01', swim_seconds: 0 }).success).toBe(
      true,
    )
    expect(
      dailyEntrySchema.safeParse({ entry_date: '2026-09-01', swim_seconds: 86400 }).success,
    ).toBe(true)
  })

  it('refuses a negative, more than 24 hours and a part second', () => {
    for (const swim of [-1, 86401, 1.5]) {
      expect(
        dailyEntrySchema.safeParse({ entry_date: '2026-09-01', swim_seconds: swim }).success,
      ).toBe(false)
    }
  })
})
```

`lib/sync/mappings.test.ts`:

```ts
const GOALS = {
  calorie_goal: 2400,
  gym_goal_seconds: 3600,
  walk_goal_seconds: 1800,
  sessions_per_week_goal: 4,
  birth_year: 1990,
  max_heart_rate: 188,
  stats_layout: [{ id: 'weight', hidden: true }],
}

describe('the new profile fields', () => {
  it('round trips every goal through the server shape', () => {
    const local: Profile = {
      ...profileSchema.parse({}),
      ...GOALS,
      id: LOCAL_PROFILE_ID,
      updated_at: LOCAL_AT,
    }
    const sent = toServerProfile(local, USER_ID)
    const back = toLocalProfile({ ...SERVER_PROFILE, ...sent, id: USER_ID })

    expect(back).toMatchObject(GOALS)
  })

  it('leaves out a goal the device row never had', () => {
    const older: Profile = {
      id: LOCAL_PROFILE_ID,
      display_name: null,
      unit_system: 'metric',
      height_cm: null,
      target_weight_kg: null,
      step_goal: 12000,
      updated_at: LOCAL_AT,
    }

    expect(toServerProfile(older, USER_ID).calorie_goal).toBeUndefined()
  })

  it('reads a card layout that is not a list as null', () => {
    expect(
      toLocalProfile({ ...SERVER_PROFILE, stats_layout: { weight: true } }).stats_layout,
    ).toBeNull()
  })
})

describe('swim_seconds', () => {
  it('round trips the swim time through the server shape', () => {
    const entry: DailyEntry = {
      ...dailyEntrySchema.parse({ entry_date: '2026-09-01', swim_seconds: 1500 }),
      id: ROW_A,
      created_at: LOCAL_AT,
      updated_at: LOCAL_AT,
      deleted_at: null,
    }
    const sent = toServerEntry(entry, USER_ID)

    expect(toLocalEntry({ ...SERVER_ENTRY, ...sent, updated_at: SERVER_AT }).swim_seconds).toBe(
      1500,
    )
  })

  it('leaves out the swim time when the device row never had it', () => {
    const older: DailyEntry = {
      id: ROW_A,
      entry_date: '2026-09-01',
      walk_seconds: null,
      gym_seconds: null,
      avg_heart_rate: null,
      max_heart_rate: null,
      weight_kg: null,
      calories_burnt: null,
      steps: null,
      note: null,
      created_at: LOCAL_AT,
      updated_at: LOCAL_AT,
      deleted_at: null,
    }

    expect(toServerEntry(older, USER_ID).swim_seconds).toBeUndefined()
  })
})
```

Add 2 full row fixtures to the file, `SERVER_PROFILE: Tables<'profiles'>` and
`SERVER_ENTRY: Tables<'daily_entries'>`, with every column of the regenerated types,
the new ones `null`. Use them in the existing rest settings round trip too.

`lib/sync/worker.test.ts`, beside `the rest settings round trip`:

```ts
describe('the goal and swim round trip', () => {
  it('carries every new profile field through a push and a pull', async () => {
    await append('profiles', 'upsert', localProfile(GOALS))
    const pushing = fakeClient()
    await push(pushing.client, USER_ID, Date.now())
    await db.outbox.clear()
    await db.profiles.clear()
    const pulling = fakeClient({
      serverRows: {
        profiles: [{ ...firstUpsert(pushing).row, created_at: SERVER_STAMP, updated_at: LATER }],
      },
    })

    await pull(pulling.client)

    expect(await db.profiles.get(LOCAL_PROFILE_ID)).toMatchObject(GOALS)
  })

  it('carries swim_seconds through a push and a pull', async () => {
    await append('daily_entries', 'upsert', localEntry(ROW_A, { swim_seconds: 1500 }))
    const pushing = fakeClient()
    await push(pushing.client, USER_ID, Date.now())
    await db.outbox.clear()
    await db.dailyEntries.clear()
    const pulling = fakeClient({
      serverRows: { daily_entries: [{ ...firstUpsert(pushing).row, updated_at: LATER }] },
    })

    await pull(pulling.client)

    expect((await db.dailyEntries.get(ROW_A))?.swim_seconds).toBe(1500)
  })

  it('leaves out the goals a device row never had, so the server keeps its own', async () => {
    await append('profiles', 'upsert', {
      id: LOCAL_PROFILE_ID,
      display_name: null,
      unit_system: 'metric',
      height_cm: null,
      target_weight_kg: null,
      step_goal: 12000,
      updated_at: '2026-09-01T10:00:00.000Z',
    })
    const fake = fakeClient()

    await push(fake.client, USER_ID, Date.now())

    expect(firstUpsert(fake).row.calorie_goal).toBeUndefined()
    expect(firstUpsert(fake).row.stats_layout).toBeUndefined()
  })
})
```

Declare `GOALS` once in the file, as in the mappings test.

`lib/db/dexie.test.ts`. Rename the version test to `declares the nine tables of
version 5` and expect `verno` and `DATABASE_VERSION` to be `5`. Import `STORES_V4`
and add:

```ts
it('upgrades a version 4 database and keeps every row it held', async () => {
  const name = 'gym-tracker-upgrade-v4'
  const old = new Dexie(name)
  old.version(4).stores(STORES_V4)
  await old.open()
  const entry = {
    id: '11111111-1111-4111-8111-111111111111',
    entry_date: '2026-10-01',
    walk_seconds: 1800,
    gym_seconds: null,
    created_at: '2026-10-01T08:00:00.000Z',
    updated_at: '2026-10-01T08:00:00.000Z',
    deleted_at: null,
  }
  const profile = {
    id: '00000000-0000-4000-8000-000000000000',
    unit_system: 'metric',
    step_goal: 12000,
    updated_at: '2026-10-01T08:00:00.000Z',
  }
  await old.table('dailyEntries').put(entry)
  await old.table('profiles').put(profile)
  old.close()

  const instance = createDatabase(name)
  opened.push(instance)
  await instance.open()

  expect(instance.verno).toBe(5)
  expect(await instance.dailyEntries.toArray()).toEqual([entry])
  expect(await instance.profiles.toArray()).toEqual([profile])
})
```

If A3 put a row in `errorLog` in its own upgrade test, add one here too and expect it
kept.

`lib/db/repository.test.ts`:

```ts
it('reads a profile saved before version 5 with every new field null', async () => {
  await db.profiles.put({
    id: LOCAL_PROFILE_ID,
    display_name: null,
    unit_system: 'metric',
    height_cm: null,
    target_weight_kg: null,
    step_goal: 12000,
    updated_at: '2026-10-01T08:00:00.000Z',
  })

  expect(await getProfile()).toMatchObject({ calorie_goal: null, stats_layout: null })
})

it('saves a calorie goal and queues it in the outbox', async () => {
  await updateProfile({ calorie_goal: 2400 })

  expect((await getProfile()).calorie_goal).toBe(2400)
  expect((await db.outbox.toArray()).at(-1)?.payload).toMatchObject({ calorie_goal: 2400 })
})
```

`lib/csv/export.test.ts`. Add `'swim_seconds'` to `IMPORTED_FIELDS` after
`'gym_seconds'`, give 1 day of `FULL_DAYS` a `swim_seconds: 1500`, and add:

```ts
it('writes the swim time in its own column', () => {
  const [header, first] = dailyEntriesCsv([day('2026-09-01', { swim_seconds: 1500 })]).split('\n')
  expect(header).toBe(
    'Day,Walk Time,Gym Time,Swim Time,Avg Heart Rate,Highest Rate,Weight,Calories Burnt,Steps,Note',
  )
  expect(first?.split(',')[3]).toBe('0:25:00')
})
```

The existing test `imports back every field the importer reads, unchanged` now proves
the swim round trip.

`lib/csv/import.test.ts`:

```ts
it('reads a sheet with no Swim Time column with no missing column issue', () => {
  const parsed = parseSheet(`${HEADER}\nAugust 12,0:20:00,1:00:00,,,,,\n`, { year: 2026 })
  expect(parsed.issues.filter((issue) => issue.kind === 'missing_column')).toEqual([])
  expect(parsed.rows[0]?.cells.swim_seconds).toEqual({ status: 'ok', raw: '', value: null })
})

it('reads a Swim Time column as a duration', () => {
  const parsed = parseSheet(`Day,Swim Time\nAugust 12,0:25:00\n`, { year: 2026 })
  expect(parsed.rows[0]?.cells.swim_seconds).toEqual({ status: 'ok', raw: '0:25:00', value: 1500 })
})
```

`components/csv/reviewState.test.ts`. Add 1 test that `cellText('swim_seconds', …)`
writes a clock duration, like the gym time test.

## Verification

1. `pnpm test:cov`. `lib/sync/**` stays at 95 lines, 90 branches, 95 functions.
2. `pnpm typecheck`. The `Assignable` checks in the schema tests compile.
3. The `sync-auditor` agent reports no lost write and no duplicate row.
4. The MCP checks in **Do** step 4 match.
5. `pnpm verify:parallel`.

## Files touched

- `supabase/migrations/<version>_feedback_goals_and_swim.sql`
- `lib/supabase/database.types.ts`
- `lib/schema/profile.ts` and its test
- `lib/schema/dailyEntry.ts` and its test
- `lib/db/dexie.ts` and its test
- `lib/db/repository.ts` and its test
- `lib/sync/mappings.ts` and its test
- `lib/sync/worker.test.ts`
- `lib/csv/export.ts` and its test
- `lib/csv/import.ts` and its test
- `components/csv/reviewState.ts` and its test

## Things to consider

Name each of these in the report.

- The migration cannot be rolled back silently. It is forward only.
- An old build on another device drops the new fields on pull and leaves them out on
  push, so the server keeps them. The A2 banner moves an open tab to the new build.
- The birth year has a wide database range and a strict zod range. The server would
  accept a year that the form refuses, never the other way round.

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer
   when another step runs its e2e suite. Never skip a check, and never add a
   design-check or test exemption to pass.
2. Run the `commit-report` skill. `components/csv/reviewState.ts` is under `components/`, so the report needs screenshots of the CSV review in Profile at 390, 768 and 1440 px, with a sheet that holds a `Swim Time` column, next to the matching prototype plate. Paste the MCP results of **Do** step 4 into the evidence section.
3. Commit on `fix/d1-schema`:
   ```bash
   git add supabase/migrations/*_feedback_goals_and_swim.sql \
     lib/supabase/database.types.ts \
     lib/schema/profile.ts \
     lib/schema/profile.test.ts \
     lib/schema/dailyEntry.ts \
     lib/schema/dailyEntry.test.ts \
     lib/db/dexie.ts \
     lib/db/dexie.test.ts \
     lib/db/repository.ts \
     lib/db/repository.test.ts \
     lib/sync/mappings.ts \
     lib/sync/mappings.test.ts \
     lib/sync/worker.test.ts \
     lib/csv/export.ts \
     lib/csv/export.test.ts \
     lib/csv/import.ts \
     lib/csv/import.test.ts \
     components/csv/reviewState.ts \
     components/csv/reviewState.test.ts
   git commit -m "feat(db): add the goal, heart rate, layout and swim columns"
   ```
   Also add every other test file that `pnpm typecheck` made you fix in **Do** step 14.
   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.
4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked,
   and anything the owner must check on the iPhone. Give the migration version that `list_migrations` shows, so the owner adds it to the list of applied migrations in `PROGRESS.md`. Say that this step ends sub-plan D, so the owner runs the D checkpoint. Name the 3 points of "Things to consider". On the iPhone the owner checks that an open tab asks to reload, and that the app still opens and syncs.
