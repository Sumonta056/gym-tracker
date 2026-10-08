# Fix track — step index

`docs/plan/04-feedback-fixes.md` is the source of truth for the sub-plans and the
checklist. This folder holds 1 file per step. One step is one session. Never do two
steps in one session.

The design: `docs/specs/2026-10-05-feedback-fixes-design.md`. Read it once, before W0.

## From wave 4: one step at a time

The owner changed the process on 2026-10-07. Parallel waves used too much CPU on this Mac.
This section wins over the step files, "How a step runs", "Merge a wave" and the testing
rule's `pnpm verify` gate, for the rest of the track.

1. **Order.** Run the steps 1 at a time, in the order of the wave table: B4, D1, E2, G1,
   E3, G2, E4, F1, E5, F2, G3a, H1, G3b, H2, I1. The next step starts only after the
   step before it is committed.
2. **1 agent per step.** The coordinator starts it with "Do the step in
   `docs/plan/feedback/<file>.md`."
3. **No worktree, no step branch, no merge.** The agent works in the main folder on
   `fix/feedback-fixes`. It skips the worktree block of the step file. It still runs the
   dependency checks.
4. **Tests per step.** Test first, as the step file says. Before the commit, all 3 pass:
   - `pnpm static`
   - `pnpm test:cov`, all unit tests with the coverage floors
   - the e2e specs that the step adds or changes, on 1 project only:
     `pnpm exec playwright test <specs> --project=mobile-safari`
5. **Acceptance.** The agent checks each acceptance box: match or no match. A box that
   needs the full suite or the iPhone waits for the checkpoint.
6. **Commit.** The `commit-report` skill, then 1 commit on `fix/feedback-fixes`. A UI
   change still puts screenshots in the report. Then the agent sets the State column.
7. **Full verify at the checkpoints only.** The coordinator runs the full `pnpm verify`
   after D1, F2, H2 and I1, before each owner checkpoint. It waits for a 1-minute load
   under 20. A break found there is fixed in 1 commit with its own report.

## One branch

Every step of the track ends on 1 branch: `fix/feedback-fixes`. A step runs in a
temporary worktree on a temporary branch cut from `fix/feedback-fixes`. After its wave,
the step branch is merged back into `fix/feedback-fixes` and deleted. At the end, only
`fix/feedback-fixes` is left, and it merges into `main` 1 time.

### Start the track

Run this 1 time, in the main folder, before wave 0:

```bash
cd /Users/cefalo_1/Documents/Projects/gym-tracker
git switch main
git switch -c fix/feedback-fixes
```

The first commit on `fix/feedback-fixes` is the plan itself: the spec,
`04-feedback-fixes.md` and this folder. The main folder stays on `fix/feedback-fixes` for
the whole track. Never work on a step in the main folder.

## Waves — what can run at the same time

The owner starts every step of 1 wave at the same time, 1 agent per step. A wave starts
only after every branch of the wave before it is merged into `fix/feedback-fixes`. Two steps in one
wave never change the same source file. They may both add to
`app/styleguide/page.tsx` and `docs/design/prototype/index.html`; the merge keeps both
additions.

| Wave | Steps, in parallel | Why they are independent                                               |
| ---- | ------------------ | ---------------------------------------------------------------------- |
| 0    | W0                 | The e2e lock and the worktree gate. Every later step needs it.         |
| 1    | A1, B1, C1, C2, E1 | Errors, a layout probe, Stats loading, a pure metric, a new primitive. |
| 2    | A2, B2, C3         | Dexie and the worker; the workout layout; the session gaps.            |
| 3    | A3, B3, B5, C4     | The error log; the sheet; the scrollbars; the heat map and labels.     |
| 4    | B4, D1             | The toast and Finish; the schema.                                      |
| 5    | E2, G1             | The picker in the log and the rest sheet; the goals in Profile.        |
| 6    | E3, G2             | Gym time from sessions in `/log`; the goal lines on the charts.        |
| 7    | E4, F1             | Old days; the finish summary.                                          |
| 8    | E5, F2             | The Swimming card; the session history.                                |
| 9    | G3a                | Today data. It shares `summary.ts` with H1.                            |
| 10   | H1                 | The heart rate maximum. It shares `Dashboard.tsx` with G3b.            |
| 11   | G3b, H2            | The Today cards; the zone ranges and the info sheet.                   |
| 12   | I1                 | Reorder and hide. It lists every Stats card, so it goes last.          |

To start a wave, tell each agent: "Do the step in
`docs/plan/feedback/<file>.md`." The step file holds everything the agent needs.

## How a step runs

Every step file has the same 4 parts. The agent follows them in order.

1. **Before you start.** Make the worktree `../gym-tracker-<step>` on branch
   `fix/<step>-<slug>`, cut from `fix/feedback-fixes`. Copy `.env.local` and `.env.test.local`. Then run
   the dependency checks. If a check fails, the step before it is not merged. Stop and
   report. Do not do the other step's work.
2. **Do.** Write the failing tests first. Then the code.
3. **Acceptance criteria.** Every box is true, and each one has its test.
4. **When the step is done.** `pnpm verify:parallel`, the `commit-report` skill, then a
   commit on the step branch. No push, no merge. No edit to `PROGRESS.md` or this index.

The best way to run a step: open a new Claude Code session in the step's worktree
folder, and give it the step file. A subagent in a worktree also works after W0, because
W0 makes the commit gate read the worktree it runs in.

## Merge a wave

The owner, or one coordinator session in the main folder on `fix/feedback-fixes`, does
this after every agent of the wave reports a commit.

1. Stop every `next dev`. Run `git worktree list` and check each step branch has 1 commit.
2. Check the main folder is on `fix/feedback-fixes`: `git branch --show-current`. Merge
   the step branches into it in the order of the wave row:
   `git merge --no-ff fix/<step>-<slug>`.
3. A conflict in `app/styleguide/page.tsx` or `docs/design/prototype/index.html` keeps
   both additions. A conflict in any other file means the wave table is wrong. Stop and
   report it.
4. Run `pnpm verify` on `fix/feedback-fixes`. Fix any break in 1 commit on that branch,
   with its own commit report.
5. Set the **State** column of each merged step to `done`, with the commit hash.
6. Remove the worktrees and the step branches:
   `git worktree remove ../gym-tracker-<step>` and `git branch -d fix/<step>-<slug>`.
7. After waves 4, 8, 11 and 12, stop for the owner checkpoint. The checkpoint table in
   `docs/plan/04-feedback-fixes.md` names the sub-plans to check on the iPhone.
8. The owner pushes `fix/feedback-fixes`.

## End the track

After wave 12 and the last checkpoint:

1. `git branch --list 'fix/*'` shows only `fix/feedback-fixes`.
2. `pnpm verify` is green on `fix/feedback-fixes`.
3. The owner merges `fix/feedback-fixes` into `main` and pushes `main`.
4. `PROGRESS.md` returns to Phase 3, step 3.1.

## Global constraints

Every step follows these. They are not repeated in each step file.

- The repository rule: no file under `app/` or `components/` imports `@supabase/*` or `lib/sync/**`.
- The UUID rule, the soft delete rule and the seconds rule in `.claude/rules/architecture.md`.
- One zod schema per entity in `lib/schema/`. Never re-declare a shape.
- No raw hex, no `rgb()`, a `type` on every `<button>`, 44 px targets, a label on every control.
- `lib/metrics/**` is test first at 100 % lines. `lib/sync/**` is test first at 95 %.
- No comments in code.
- No new dependency unless the step names it.
- Load the `design-system` skill before any step that touches `app/` or `components/`.
- A new screen or a new card gets its plate in `docs/design/prototype/index.html` in the same step.
- Offline: a route must work with no network. Use a query string, not a new dynamic segment, for a detail view.

## The steps

| Step | File                       | Title                                         | Items  | Size | Depends on          | State          |
| ---- | -------------------------- | --------------------------------------------- | ------ | ---- | ------------------- | -------------- |
| W0   | `W0-parallel-setup.md`     | The e2e lock and the worktree commit gate     | —      | S    | —                   | done `cb7e9bb` |
| A1   | `A1-error-boundaries.md`   | Error boundaries and guarded live queries     | 16     | M    | W0                  | done `6e47e39` |
| A2   | `A2-version-and-chunks.md` | Version change, stale chunk, sync catch       | 16     | S    | A1                  | done `d17754b` |
| A3   | `A3-error-log.md`          | The local error log, Dexie v4, Profile card   | 16     | M    | A2                  | done `9b662e0` |
| B1   | `B1-reproduce-workout.md`  | Reproduce the `/workout` break on the iPhone  | 5      | S    | W0                  | done `5eabf7f` |
| B2   | `B2-fix-workout-layout.md` | Fix the `/workout` layout                     | 5      | M    | B1                  | done `3c1a28b` |
| B3   | `B3-sheet-portal.md`       | The sheet: portal, iOS scroll lock, keyboard  | 2      | M    | B2                  | done `d24bbd1` |
| B4   | `B4-saved-toast.md`        | The Saved toast, Finish with no reload        | 2      | S    | B3                  | done `aa81ac6` |
| B5   | `B5-hidden-scrollbars.md`  | Hidden scrollbars and the chip fade           | 13     | S    | B2                  | done `e16f3bc` |
| C1   | `C1-stats-no-flicker.md`   | Keep the Stats data during a tab switch       | 7      | M    | W0                  | done `ace246f` |
| C2   | `C2-gym-time-metric.md`    | `effectiveGymSeconds`, one source of gym time | 9      | S    | W0                  | done `7cd2874` |
| C3   | `C3-session-gaps.md`       | Session gaps from all history, one meaning    | 12     | S    | C1, C2              | done `692da98` |
| C4   | `C4-day-labels.md`         | Heat map and week labels                      | 12, 17 | M    | C3                  | done `bacce1a` |
| D1   | `D1-schema.md`             | The migration, Dexie v5, schemas, mappings    | —      | M    | A3                  | done `25454f6` |
| E1   | `E1-duration-picker.md`    | The `DurationPicker` primitive                | 3      | M    | W0                  | done `93c6267` |
| E2   | `E2-picker-in-use.md`      | The picker for rest, gym and walk time        | 3      | S    | E1, B3, B4          | done `85bf1fa` |
| E3   | `E3-gym-time-in-log.md`    | Gym time from sessions in `/log`, no offer    | 9      | M    | C2, E2, B4          | done `e1753e6` |
| E4   | `E4-old-days.md`           | `/log?date=`, previous, next, date picker     | 6      | M    | E3, C4              | —              |
| E5   | `E5-swim-card.md`          | The Swimming card                             | 1      | M    | D1, E2, E4          | —              |
| F1   | `F1-finish-summary.md`     | The finish summary                            | 4      | M    | B4, E3              | —              |
| F2   | `F2-session-history.md`    | `/workouts` history and session detail        | 4      | M    | F1, E4, A1          | —              |
| G1   | `G1-goals-in-profile.md`   | 6 goals in Profile, the week start fact       | 14, 17 | M    | D1, E1, B4          | done `c5c496e` |
| G2   | `G2-goal-lines.md`         | A goal line on each chart, the Walk chart     | 14     | M    | G1, C1, C4          | done           |
| G3a  | `G3a-today-data.md`        | Today: the data in `summary.ts`               | 8      | M    | C3, G2, E5, F1      | —              |
| G3b  | `G3b-today-cards.md`       | Today: the cards                              | 8      | M    | G3a, F2, H1         | —              |
| H1   | `H1-max-heart-rate.md`     | Zones from a true maximum heart rate          | 10     | M    | C3, D1, G1, G2, G3a | —              |
| H2   | `H2-zone-explained.md`     | Zone bpm ranges and the info sheet            | 15     | S    | H1, B3              | —              |
| I1   | `I1-stats-layout.md`       | Reorder and hide the Stats cards              | 11     | M    | C3, D1, G2, H2      | —              |

28 steps: W0 and 27 fix steps. G3 is split in 2 because it does not fit 1 session.
The "Depends on" column lists only what a step needs. The waves above also keep apart
steps that change the same file, so a wave can hold fewer steps than the dependencies allow.

## Shared names

A step file names only its own work. These names are fixed here so the steps agree.

### Errors (A1–A3)

```ts
// lib/errors/report.ts
export function reportError(error: unknown, context: { route: string; source: ErrorSource }): void
export type ErrorSource = 'boundary' | 'window' | 'rejection' | 'live-query' | 'sync'

// lib/schema/errorRecord.ts
export const errorRecordSchema: z.ZodType<ErrorRecord>
export type ErrorRecord = {
  id: string
  at: string
  source: ErrorSource
  message: string
  stack: string | null
  route: string
}
export const MAX_ERROR_RECORDS = 50
export const MAX_STACK_LENGTH = 2000

// lib/db/repository.ts
export async function recordError(input: Omit<ErrorRecord, 'id' | 'at'>): Promise<void>
export async function listErrors(): Promise<ErrorRecord[]>
export async function clearErrors(): Promise<void>

// lib/db/safeQuery.ts
export function safeQuery<T>(query: () => Promise<T>, source: string): () => Promise<T | null>
```

Dexie v4 adds `errorLog: 'id, at'`. It is local only: no outbox, no sync, cleared by `clearAll`.

### Sheet and toast (B3–B4)

```ts
// components/ui/SheetModal.tsx keeps its props. It renders through createPortal.
// components/ui/Toast.tsx
export function ToastProvider({ children }: { children: React.ReactNode }): JSX.Element
export function useToast(): { show: (message: string) => void }
export const TOAST_MS = 2000
```

### Gym time (C2, used by C3, E3, G3, H1)

```ts
// lib/metrics/gymTime.ts
export type GymTimeSource = 'typed' | 'sessions' | 'none'
export function effectiveGymSeconds(
  entry: Pick<DailyEntry, 'gym_seconds'> | undefined,
  sessions: Pick<WorkoutSession, 'entry_date' | 'started_at' | 'ended_at' | 'deleted_at'>[],
): { seconds: number; source: GymTimeSource }
export function hasSession(
  entry: Pick<DailyEntry, 'gym_seconds'> | undefined,
  sessions: Pick<WorkoutSession, 'entry_date' | 'started_at' | 'ended_at' | 'deleted_at'>[],
): boolean
```

`sessions` holds the sessions of one `entry_date` only. The caller groups them.

### Schema (D1)

`profiles`: `calorie_goal`, `gym_goal_seconds`, `walk_goal_seconds`,
`sessions_per_week_goal`, `birth_year`, `max_heart_rate`, `stats_layout`.
`daily_entries`: `swim_seconds`. Ranges and checks: the spec, section 3.1.
Dexie v5 re-declares every table. No new index.

### Duration picker (E1)

```ts
// components/ui/DurationPicker.tsx
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
}
export const REST_PRESETS = [60, 90, 120, 180] as const
export const SESSION_PRESETS = [1800, 2700, 3600, 5400] as const
```

### Routes

- `/log?date=YYYY-MM-DD` (E4). A missing, malformed or future date opens today.
- `/workouts?session=<uuid>` (F2). An unknown id shows the list with a note.

### Session stats (F1, F2, G3)

```ts
// lib/metrics/sessionStats.ts
export type SessionStats = {
  durationSeconds: number
  setCount: number
  exerciseCount: number
  volumeKg: number
  newRecords: { exerciseId: string; weightKg: number; reps: number }[]
}
export function sessionStats(
  session: WorkoutSession,
  sets: WorkoutSet[],
  earlierSets: WorkoutSet[],
): SessionStats
```

### Heart rate (H1, H2)

```ts
// lib/metrics/heartRateZones.ts
export function resolveMaxHeartRate(
  profile: Pick<Profile, 'max_heart_rate' | 'birth_year'>,
  today: string,
): { bpm: number; source: 'override' | 'age' } | null
export function heartRateZones(entry: ZoneInput, maxHeartRate: number | null): Zones
export function zoneBands(
  maxHeartRate: number,
): { zone: ZoneName; fromBpm: number; toBpm: number | null }[]
```

### Stats layout (I1)

```ts
// components/charts/statsCards.ts
export const STATS_CARD_IDS: readonly StatsCardId[]
export type StatsLayoutItem = { id: StatsCardId; hidden: boolean }
export function resolveLayout(stored: StatsLayoutItem[] | null): StatsLayoutItem[]
export function moveCard(layout: StatsLayoutItem[], id: StatsCardId, by: -1 | 1): StatsLayoutItem[]
```

### Corrections from the code (2026-10-05)

The step files hold the full names. These lines correct the blocks above where the code
differs. The step file wins over this index.

- **Dexie.** The key is `&id`: `errorLog: '&id, at'`. A3 renames the version 3 map to
  `STORES_V3`. D1 renames the version 4 map to `STORES_V4`.
- **Sync status.** `SyncStatus` gains `'unknown'` (A1). `useDeadLetters` falls back to `[]`.
- **Errors.** A1 adds `components/errors/ErrorScreen.tsx`, `lib/errors/browser.ts` and a
  test-only `/crash-test` route behind `crashTestEnabled()` in `lib/flags.ts`. A2 adds
  `lib/errors/chunk.ts`, `VersionBanner` and `AppGuards`. A3 adds `lib/errors/listeners.ts`.
- **Toast.** B4 also exports `SAVED_MESSAGE = 'Saved'`. The toast sits at the top, the
  undo toast at the bottom.
- **Gym time.** "Finished" means `ended_at !== null && deleted_at === null`. A typed `0`
  wins with source `'typed'`. C3 adds `lib/metrics/sessionDays.ts`.
- **Duration picker.** E1 adds a `className?` prop and `DEFAULT_STEP_SECONDS = 15`. E2 adds
  `CARDIO_PRESETS = [900, 1800, 2700, 3600]` for walk and swim, and
  `SESSION_STEP_SECONDS = 60` for gym, walk and swim time. Rest time keeps 15 s steps.
- **Log date.** E4 adds `lib/format/logDate.ts`: `parseLogDate(value, today)`,
  `shiftLogDate`, `logPath`. `DailyEntryForm` takes `{ date, onDateChange }`.
- **Routes offline.** A query string alone misses the precache. E4 adds
  `ignoreURLParametersMatching: [/^date$/]` to `app/sw.ts`, and F2 adds `/^session$/`.
  The address changes with `history.replaceState` or `pushState`, never a server round trip.
- **Heat map links.** A cell is about 20 px and sits inside `role="img"`, so it cannot be a
  link. E4 adds an "Open a day" row of 7 real links, 44 px tall, under the heat map.
- **Session stats.** `newRecords` holds `SessionRecord` items. A record is the heaviest set
  of an exercise in this session that is strictly heavier than every earlier session.
  Reps do not count. A first-time exercise gives no record.
- **History.** F2 adds `listFinishedSessions(limit)` returning `{ sessions, hasMore }`, with
  `HISTORY_PAGE = 30`, plus `getSession(id)` and `listSetsForSessions(ids)`.
- **Goals.** The new profile fields are optional in the local `Profile` type. Every read
  uses `?? null`. The Profile card label becomes `Goals`.
- **Heart rate.** The real type names are `HeartRateSession` and `HeartRateZones`.
  `resolveMaxHeartRate` takes `Pick<ProfileInput, 'max_heart_rate' | 'birth_year'>` and
  returns `MaxHeartRate | null`. H1 wires `effectiveGymSeconds` into the zones. H1 adds a
  new Profile card, `HeartRateCard`. `formatDuration` short style shows `<1m` for 1 to 59 s.
- **Stats layout.** `resolveLayout(stored: StoredLayoutItem[] | null)`, because a stored id
  can be unknown to this build. The ids include `walk` from G2.
- **Playwright.** The projects are named `mobile-safari`, `mobile-chrome` and `desktop`.

## Owner decisions still open

The step that meets each one stops and asks.

1. **Finish and Start load `/workouts` and `/workout` as a document today, on purpose,**
   so they open offline from the cache. B4 changes Finish to `router.push`. B2 changed
   Start to `router.push` on 2026-10-06, with the owner's yes (F5). The offline e2e test guards it.
2. ~~**B2 fix F2b** makes the page transition opacity only.~~ Answered 2026-10-06: no. The page keeps the 8 px rise.
3. **E2 step size:** 60 s for gym, walk and swim time instead of 15 s.
4. ~~**C3:** the Streak heat map keeps counting logged days, not session days.~~ Answered 2026-10-06: keep logged days.
5. **Phase 3 conflict:** S3.9 still uses the gym time offer that E3 removes. S3.9 must use
   `sessionStats` and `SessionSummary` from F1. S3.7 puts the plan picker above the F2
   history.

## Review focus

The inputs most likely to break for the owner. Each has a test in the named step.

1. A Dexie read that fails while the PWA wakes from the background → no blank page. A1.
2. A day with 2 sessions and no typed gym time → the sum, not the newest. C2.
3. A session with no `ended_at` (still live) → it adds 0 to the day, not a negative. C2.
4. `/log?date=` with a future date, `2026-02-30` or garbage → today, with no crash. E4.
5. A stored `stats_layout` from an older build that lacks a new card → the card still shows. I1.

## Checkpoints

The waves mix sub-plans, so the checkpoints follow the waves, not the sub-plans. Stop
after the named wave is merged. Do not start the next wave without the owner's approval.

| After wave | The owner checks on the iPhone and the laptop |
| ---------- | --------------------------------------------- |
| 4          | Sub-plans A, B, C and D                       |
| 8          | Sub-plans E and F                             |
| 11         | Sub-plans G and H                             |
| 12         | Sub-plan I, then the whole checklist          |
