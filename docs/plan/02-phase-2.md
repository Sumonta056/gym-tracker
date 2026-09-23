# Phase 2 — The live workout log and the import

Goal: record a gym session set by set, with no network, and import the old 16 rows.

Do not start Phase 2 before every Phase 1 checklist item passes.

Exit condition: a full session is recorded offline, the old sheet is in the app, and
the personal record chart is correct.

---

## 2.1 Migration 0002 and the exercise seed

**Do**

1. `supabase/migrations/0002_phase2.sql`:
   - `exercises`, `workout_sessions` and `workout_sets` exactly as the specification
     states.
   - `exercises.user_id` may be null. A null row is a global seed row.
   - Row Level Security. `exercises`: read where `user_id = auth.uid()` **or**
     `user_id is null`. Write only where `user_id = auth.uid()`.
   - `workout_sets` checks ownership through its parent session. Write the policy as
     an `exists` clause on `workout_sessions`.
   - A partial unique index on `(user_id, status)` where `status = 'active'`, so only
     one session can run at a time.
   - Indexes on `workout_sets(session_id)` and `workout_sessions(user_id, entry_date)`.
2. Seed about 40 global exercises across chest, back, legs, shoulders, arms, core and
   cardio. Keep the names plain: `Bench Press`, `Lat Pulldown`, `Leg Press`.

**Test by hand** Account A cannot read a set of account B. A second active session is
rejected.

---

## 2.2 Dexie version 2 and the repository extension

**Do**

1. Bump Dexie to version 2 and add `exercises`, `workoutSessions` and `workoutSets`.
   Write the upgrade function. Never drop the version 1 tables.
2. Extend the repository:
   ```ts
   listExercises(filter?: { muscleGroup?: string; query?: string }): Promise<Exercise[]>
   createExercise(input: ExerciseInput): Promise<Exercise>
   archiveExercise(id: string): Promise<void>
   getActiveSession(): Promise<WorkoutSession | undefined>
   startSession(date: string): Promise<WorkoutSession>
   finishSession(id: string): Promise<WorkoutSession>
   addSet(input: WorkoutSetInput): Promise<WorkoutSet>
   updateSet(id: string, patch: Partial<WorkoutSetInput>): Promise<WorkoutSet>
   deleteSet(id: string): Promise<void>
   listSets(sessionId: string): Promise<WorkoutSet[]>
   ```
3. Every write still lands in the outbox in the same transaction.
4. Teach the sync worker the three new tables. Push a session before its sets, so a
   foreign key never fails.

**Tests**

- The version 1 to version 2 upgrade keeps every existing daily entry.
- `startSession` fails when a session is already active.
- `addSet` on an offline session queues the session and the set, in that order.
- `deleteSet` soft deletes and queues.
- The sync worker pushes the parent session first.

---

## 2.3 The exercise library and the picker sheet

Load the `design-system` skill first.

**Do**

1. `components/workout/ExercisePicker.tsx`. It uses `SheetModal`, so it is a bottom
   sheet on the phone and a centred dialog on the laptop.
2. Build from the mockup: the grab handle, the title, the close button, the search
   field, the muscle group chips, the Recent list, the full list, and the
   "Create a new exercise" button.
3. Recent shows the last used load and reps, plus how long ago.
4. Search matches on the name, case insensitive, with no accent sensitivity.
5. A custom exercise asks for a name and a muscle group only.
6. `/profile` gains a "Manage exercises" screen: rename, archive, restore.

**Tests**

- Component: the search narrows the list and an empty result shows the create option.
- Component: a chip filters by muscle group and the All chip clears it.
- Component: picking an exercise calls the handler once and closes the sheet.
- Component: the sheet traps focus and closes on Escape.

---

## 2.4 `/workout` — the live session

**Do**

1. Build from the mockup: the running timer, the Finish button, the set and volume
   readout, the active exercise card with its set rows, and the collapsed cards for
   the other exercises.
2. The timer counts from `started_at`, not from a counter in memory. A reload or a
   background must not lose time.
3. "Add set" carries the reps and the load over from the previous set of the same
   exercise. The usual case is one tap.
4. Tap a set row to edit it. Swipe or long press to delete it, with an undo.
5. A new personal record on a set shows the `PR` badge at once.
6. The running volume is the sum of reps times weight, updated on every set.
7. Recover an active session when the app reopens. Offer to resume or discard.
8. At 1024 px and up, show the exercise list on the left and the active exercise on
   the right, in two columns.

**Tests**

- Component: "Add set" copies the previous reps and load.
- Component: editing a set changes the volume total.
- Component: deleting a set can be undone.
- Integration: the timer survives a remount and reads from `started_at`.
- Integration: a reload with an active session offers to resume it.
- E2E mobile offline: start a session, add three sets, finish, and every set is there
  after a reload.

---

## 2.5 The rest timer

**Do**

1. Start it when a set is saved. Default 90 seconds. Make it editable per exercise.
2. Show it as the cyan card in the mockup. Skip and add 30 seconds are available.
3. Alert on zero with a vibration, when the browser allows it, and with a sound that
   can be muted. Store the mute setting in the profile.
4. Keep the correct time when the tab is in the background. Compute from a timestamp,
   never from a tick count.

**Tests**

- Unit: the remaining time is computed from a start timestamp and stays correct after
  a simulated 60 second gap.
- Component: Skip clears the timer. Add 30 raises it by 30.
- Component: with the mute setting on, no sound plays.

---

## 2.6 Link a session to the day

**Do**

1. On Finish, compute the session length and offer to write it into the Gym Time of
   that day's `daily_entries` row.
2. If no row exists for that date, create one with only `gym_seconds` set.
3. If a row exists with a different `gym_seconds`, ask before overwriting.
4. `/log` shows the same offer, as in the mockup.

**Tests**

- Integration: finishing with no daily row creates one with the right seconds.
- Integration: finishing with an existing row does not overwrite without consent.

---

## 2.7 `lib/metrics` for Phase 2 — write the tests first

| File                   | Function                                                    |
| ---------------------- | ----------------------------------------------------------- |
| `volumeLoad.ts`        | The sum of reps times weight, per session and per exercise  |
| `epley.ts`             | `weight * (1 + reps / 30)`, the estimated one-rep maximum   |
| `personalRecords.ts`   | The best load and the best volume per exercise, with a date |
| `muscleBalance.ts`     | The share of weekly volume by muscle group                  |
| `sessionGaps.ts`       | The day gaps between sessions, as a histogram               |
| `caloriesPerMinute.ts` | Calories divided by gym minutes                             |

**Tests**

- `volumeLoad`: an empty session is 0. A body-weight set with a null load is 0, not
  a crash.
- `epley`: one rep returns the load itself. Ten reps at 40 kg returns 53.33.
- `epley`: zero reps returns null. It never divides by a bad value.
- `personalRecords`: a tie breaks on the earlier date. A soft-deleted set is skipped.
- `muscleBalance`: the shares add up to 100. An empty week returns an empty result.
- `sessionGaps`: your real dates, 2 September to 13 September, give the gaps
  1, 3, 3, 3, 1.
- `caloriesPerMinute`: zero gym minutes returns null, never infinity.

**Done when** coverage on `lib/metrics/**` is still 100 percent for lines.

---

## 2.8 The Phase 2 charts

**Do**

Add to `/analytics`, using the same rules as Phase 1, written in
`.claude/skills/design-system/references/charts.md`:

1. Volume load per session, bars, with the change against the previous week.
2. Estimated one-rep maximum per exercise, a line per selected exercise.
3. The personal record list, as in the mockup, with the estimated one-rep maximum.
4. Muscle group balance, a stacked bar with a legend, and a warning when one group
   falls below 15 percent of the weekly volume.
5. The session gap histogram.
6. Calories per gym minute, a line.

**Tests**

- Component: each chart renders its empty state before any session exists.
- Component: each chart renders with one session, with no lone dot.
- Component: the muscle balance warning appears below the threshold and not above it.

---

## 2.9 The CSV import and the review screen

**Do**

1. `lib/csv/import.ts`:
   - Parse the file with a header row. Map the eight sheet columns to the entity.
   - Use `parseSheetValue` from `lib/duration.ts` for both time columns.
   - Parse `August 12` style dates. Ask for the year once, up front.
   - Return a row list, each row carrying a per-cell status: `ok`, `review` or
     `error`, and the reason.
   - Never write anything. The parser is pure.
2. The review screen on `/profile`:
   - A table of every row. Mark each `review` cell in the warning color.
   - For a `review` duration, show both readings and let the user pick one. For
     `15.54` show `15m 54s` and `15.93 min` side by side.
   - Show the true count of rows needing review. Do not guess a number.
   - "Apply to all similar" sets the same reading for every row with the same shape.
   - An existing date shows Skip, Overwrite or Merge.
3. Commit only after the user confirms. Write through the repository, so the import
   syncs like any other write.

**Tests**

- Unit: the real 16-row sheet parses to 16 rows, with the exact set of `review` cells
  the rules of 1.4 predict.
- Unit: a missing column, an extra column and a blank row are reported, not thrown.
- Unit: the parser writes nothing. Assert the repository is never called.
- Component: "Apply to all similar" changes every matching row and only those.
- Integration: applying the import creates 16 entries and 16 outbox entries.
- E2E: import the real file, review it, apply it, and the charts fill in.

---

## 2.10 The CSV export

**Do**

1. Export every table as a separate CSV inside one zip file.
2. Durations export in `h:mm:ss`, so the file round trips through the importer.
3. The export runs fully offline, from Dexie.

**Tests** Unit: export then import returns the same data. Assert a full round trip.

---

## 2.11 Phase 2 verification

- [ ] `pnpm verify` passes.
- [ ] `pnpm e2e` passes on all three projects.
- [ ] `lib/metrics/**` coverage is 100 percent for lines.
- [ ] `lib/csv/**` coverage is 95 percent or higher.
- [ ] A full offline session of three exercises records and syncs.
- [ ] The old 16 rows are in the app and the review screen handled every unclear cell.
- [ ] The personal record chart matches a hand calculation for one exercise.
- [ ] Zero serious axe issues on `/workout` and the picker sheet.
- [ ] No horizontal scroll from 320 px to 2560 px on the new screens.
- [ ] `/styleguide` still matches the prototype.

**Commit** `feat(ui): phase 2 live workout log and CSV import`
