# Phase 2 — step index

`docs/plan/02-phase-2.md` is the source of truth. This folder splits it into 21 step
files. One step is one session. Never do two steps in one session.

A step keeps the number of its section in the source. A large section splits into
lettered steps, for example 2.4a and 2.4b. Step 2.0 is new. The run order is in the
**Order** section, not in the numbers.

**Branch for all of Phase 2:** `feat/phase-2-workout-log`, cut from `main` after the
Phase 1 branch merges.

## How a session runs

1. Read `PROGRESS.md`. It names the next step.
2. Open that step file in this folder. Read only that file.
3. Do the step. Stop at the end of the step.
4. Run `pnpm verify`.
5. Run the `commit-report` skill. Then commit.
6. Update the **Next step** line in `PROGRESS.md`.

## The steps

| Step | File                           | Title                                    | Size | Depends on       | State |
| ---- | ------------------------------ | ---------------------------------------- | ---- | ---------------- | ----- |
| 2.0  | `S2.0-design-contract.md`      | The Phase 2 prototype plates             | M    | Phase 1          | —     |
| 2.1a | `S2.1a-migration-dexie.md`     | Migration, Dexie version 3               | M    | Phase 1          | —     |
| 2.1b | `S2.1b-exercise-seed.md`       | The global exercise seed                 | S    | 2.1a             | —     |
| 2.2a | `S2.2a-schemas-exercises.md`   | Zod schemas, the exercise repository     | M    | 2.1a             | —     |
| 2.2b | `S2.2b-session-repository.md`  | The session and set repository           | M    | 2.2a             | —     |
| 2.2c | `S2.2c-sync-workout-tables.md` | The sync worker for the 3 new tables     | L    | 2.1b, 2.2b       | —     |
| 2.7a | `S2.7a-lift-metrics.md`        | Volume load, Epley, personal records     | S    | 2.2a             | —     |
| 2.7b | `S2.7b-week-metrics.md`        | Muscle balance, gaps, calories a minute  | S    | 2.2a             | —     |
| 2.3a | `S2.3a-exercise-picker.md`     | The exercise picker sheet                | M    | 2.0, 2.2a        | —     |
| 2.3b | `S2.3b-manage-exercises.md`    | "Manage exercises" on `/profile`         | S    | 2.3a             | —     |
| 2.4a | `S2.4a-live-session.md`        | `/workout` — timer, set rows, PR badge   | M    | 2.2b, 2.3a, 2.7a | —     |
| 2.4b | `S2.4b-session-edit-resume.md` | `/workout` — edit, undo, resume, laptop  | M    | 2.4a             | —     |
| 2.5  | `S2.5-rest-timer.md`           | The rest timer                           | M    | 2.4a             | —     |
| 2.6  | `S2.6-link-to-day.md`          | Link a session to the day                | S    | 2.4a             | —     |
| 2.8a | `S2.8a-lift-charts.md`         | Volume, one-rep max, the record list     | M    | 2.7a, 2.4a       | —     |
| 2.8b | `S2.8b-week-charts.md`         | Balance, gap histogram, calories a min   | M    | 2.7b, 2.8a       | —     |
| 2.9a | `S2.9a-csv-parser.md`          | The CSV parser, tests first              | M    | 2.2a             | —     |
| 2.9b | `S2.9b-import-review.md`       | The import review screen                 | M    | 2.0, 2.9a        | —     |
| 2.9c | `S2.9c-import-apply.md`        | Apply the import: Skip, Overwrite, Merge | M    | 2.9b             | —     |
| 2.10 | `S2.10-csv-export.md`          | The CSV export and the round trip        | S    | 2.9a             | —     |
| 2.11 | `S2.11-verification.md`        | Phase 2 verification and device check    | S    | all              | —     |

## Order

```
2.1a ─ 2.1b ─────────────────┐
  │                          │
  └─ 2.2a ─┬─ 2.2b ──────────┴─ 2.2c
           │     │
           │     └──────────────────┐
           ├─ 2.7a ─────────────────┤
2.0 ───────┼─ 2.3a ─ 2.3b           │
           │    └───────────────────┴─ 2.4a ─┬─ 2.4b
           │                                 ├─ 2.5
           │                                 ├─ 2.6
           ├─ 2.7b ──────────────────────────┴─ 2.8a ─ 2.8b
           │
           └─ 2.9a ─┬─ 2.10
       2.0 ─────────┴─ 2.9b ─ 2.9c

all ─ 2.11
```

The run order for one person:

`2.0 · 2.1a · 2.1b · 2.2a · 2.2b · 2.2c · 2.7a · 2.7b · 2.3a · 2.3b · 2.4a · 2.4b ·
2.5 · 2.6 · 2.8a · 2.8b · 2.9a · 2.9b · 2.9c · 2.10 · 2.11`

2.2c is the highest risk step. A bug there loses a set the user logged in the gym.
2.7a comes before 2.4a, because `/workout` shows the volume and the PR badge.

## Checkpoints

Stop and report to the user at each checkpoint. Do not continue without approval.

### Checkpoint 0 — after 2.0

- [ ] The owner opened the prototype and accepted the 5 new plates.

### Checkpoint A — after 2.2c

- [ ] The migration applies on a fresh database, with the seed.
- [ ] Account A cannot read a session or a set of account B.
- [ ] A second active session is refused, on the device and on the server.
- [ ] An offline session and its sets sync in parent-first order after a reload.
- [ ] The sync worker never pushes a global seed exercise.
- [ ] `lib/sync/**` coverage is 95 percent or higher.

### Checkpoint B — after 2.5

- [ ] A full offline session of 3 exercises records at 390 px and syncs.
- [ ] The timer and the rest timer keep the correct time after a reload and a
      background.

### Checkpoint C — after 2.9c

- [ ] The 16 old rows are in the app. The review screen handled every unclear cell.
- [ ] The charts fill in with the imported rows.

### Checkpoint D — after 2.11

- [ ] Every item in the Phase 2 checklist of `docs/plan/02-phase-2.md` passes.

## What Phase 1 already built

Do not build these again. Read them first.

- `lib/db/dexie.ts` at version 2. Version 2 holds `deadLetters` from step 1.13b.
- `lib/db/repository.ts`: `getDay`, `listRange`, `upsertDay`, `softDeleteDay`,
  `getProfile`, `updateProfile`, `clearAll`, and the `SignedOutOnThisDevice` guard.
- `lib/sync/worker.ts`: push, pull, the drain lock, the dead letter rules, the owner
  column rule and the duplicate date rule. It maps 2 tables today.
- `lib/sync/outbox.ts`: `append`, the sequence, the back-off.
- `lib/duration.ts`: `parseInput`, `parseSheetValue`, `formatDuration`.
- `lib/metrics/`: `day`, `streak`, `movingAverage`, `weekTotals`, `heartRateZones`.
- `components/ui/`, including `SheetModal`, `NumberField`, `StatCard`, `HeroCard`,
  `SegmentedTabs`, `StatusChip`, `PrimaryButton`, `SecondaryButton`.
- `components/charts/` and `.claude/skills/design-system/references/charts.md`.
- `lib/nav.ts`: Today, Stats, Workouts, Profile, and the Log action.
- `app/(app)/workouts/page.tsx`: a placeholder. Step 2.4a gives it a start button.
  Phase 3 step 3.7 rebuilds it.

## Risks

| Risk                                                        | Impact | Mitigation                                                           |
| ----------------------------------------------------------- | ------ | -------------------------------------------------------------------- |
| A set logged offline is lost or pushed before its session   | High   | 2.2c writes the tests first. The `sync-auditor` reviews.             |
| The worker pushes a global seed row or gives it a `user_id` | High   | 2.2c has a test that no push touches a row with a null owner.        |
| A second device starts a session while one is active        | Medium | 2.2c handles the partial unique index refusal as a named case.       |
| The Dexie upgrade drops a Phase 1 row                       | High   | 2.1a tests the version 2 to version 3 upgrade with real rows.        |
| The timer drifts in the background on the iPhone            | Medium | 2.4a and 2.5 compute from a timestamp. Never from a tick count.      |
| The importer guesses a duration in place of asking          | Medium | 2.9a returns `review`. 2.9b makes the user pick. A test counts them. |
| A rest time for a seed exercise cannot be stored on its row | Low    | 2.1a stores it in `profiles.rest_seconds_by_exercise`.               |
| Swipe to delete has no keyboard path                        | Medium | 2.4b adds a real Delete button. Swipe is an extra, not the only way. |

## Open questions

- The real 16-row sheet is not in the repository. The owner supplies it as a CSV
  before 2.9a. It goes in `tests/fixtures/gym-sheet.csv`.
- The zip library for 2.10. The plan names `fflate`. The owner approves the new
  dependency at 2.10.
- `workout_sets` has no `user_id` in the specification. Its policy reads the parent
  session. The `db-migration` skill wants `user_id` on every table. 2.1a keeps the
  specification and records it as a named exception.

&nbsp;
