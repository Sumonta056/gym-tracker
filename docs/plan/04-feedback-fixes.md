# Fix track — the owner feedback

Goal: fix the 17 items the owner found on the iPhone and the laptop, one small step at
a time, before Phase 3 starts.

Exit condition: every item in the checklist below passes on the owner's iPhone and
laptop, `pnpm verify` is green on `fix/feedback-fixes`, and that 1 branch is merged into
`main`.

The design: `docs/specs/2026-10-05-feedback-fixes-design.md`. The step index and the
shared names: `docs/plan/feedback/index.md`. One step file per step in
`docs/plan/feedback/`.

Phase 3 waits. `PROGRESS.md` returns to step 3.1 when this track closes.

---

## The 9 sub-plans

A sub-plan groups the steps of a few items. It is not a branch. All the work lands on
1 branch, `fix/feedback-fixes`. Every step runs in a temporary worktree and branch,
`fix/<step>-<slug>`, cut from `fix/feedback-fixes`, with 1 commit. Steps run in waves: the steps of
1 wave run at the same time, and the wave is merged into `fix/feedback-fixes` before the next wave
starts. The waves and the merge procedure: `docs/plan/feedback/index.md`.

| Sub-plan | Name          | Items        | Steps  | What the owner sees at the checkpoint                       |
| -------- | ------------- | ------------ | ------ | ----------------------------------------------------------- |
| A        | crash safety  | 16           | A1–A3  | No blank page. A Reload screen. An error list in Profile.   |
| B        | mobile layout | 2, 5, 13     | B1–B5  | `/workout` is whole. Sheets behave. A Saved toast. No bars. |
| C        | stats fixes   | 7, 9, 12, 17 | C1–C4  | No flicker. The day widgets are correct and labelled.       |
| D        | schema        | —            | D1     | Nothing visible. The new fields sync.                       |
| E        | log inputs    | 1, 3, 6, 9   | E1–E5  | The picker. Gym time from sessions. Old days. Swimming.     |
| F        | workout stats | 4            | F1–F2  | A finish summary. A session history.                        |
| G        | goals today   | 8, 14, 17    | G1–G3b | Goals in Profile. Goal lines. A full Today.                 |
| H        | heart rate    | 10, 15       | H1–H2  | Realistic zones with bpm ranges and an info sheet.          |
| I        | stats layout  | 11           | I1     | Reorder and hide the Stats cards.                           |

Step W0 runs first, alone. It adds the e2e lock and the worktree commit gate.

### Checkpoints

| After wave | The owner checks on the iPhone and the laptop |
| ---------- | --------------------------------------------- |
| 4          | Sub-plans A, B, C and D                       |
| 8          | Sub-plans E and F                             |
| 11         | Sub-plans G and H                             |
| 12         | Sub-plan I, then the whole checklist          |

---

## Checklist

### A — Crash safety

- [ ] A forced render error on any `(app)` route shows the Reload screen, never a blank page.
- [ ] A failed Dexie read in the sync chip shows an unknown state and does not throw.
- [ ] A schema change in another tab shows "A new version is ready. Reload."
- [ ] A stale chunk reloads 1 time, with no reload loop.
- [ ] Profile lists the last 50 errors, with a Copy button and a Clear button.

### B — Mobile layout

- [ ] `/workout` at 320, 375, 390 and 430 px has no sideways overflow, and the bottom bar stays fixed.
- [ ] Every sheet renders in a portal. The page behind it does not scroll on iOS.
- [ ] The Save button of a sheet stays above the iOS keyboard.
- [ ] Every save shows a "Saved" toast. Finish still opens `/workouts` offline.
- [ ] No scrollbar shows at any width from 320 to 2560 px. The chip row has a fade edge.

### C — Stats fixes

- [ ] A Day, Week or Month switch keeps the cards on screen. No height jump. No replayed animation.
- [ ] `effectiveGymSeconds` is the one source of gym time for every reader.
- [ ] Session gaps use all history. Totals and the gap chart agree on what a session is.
- [ ] The heat map has weekday labels, square cells and a visible future style.
- [ ] The week ticks read "Mon Tue Wed". "This week" shows its date range.

### D — Schema

- [ ] The migration applies, and every new column has its check and keeps the RLS policy.
- [ ] Dexie v5 opens over a v4 database with no data loss.
- [ ] A round trip through the sync worker keeps every new field.

### E — Log inputs

- [ ] Rest, gym, walk and swim time are set with the picker and no keyboard.
- [ ] A day with no typed gym time shows the sum of its sessions, and `/log` says so.
- [ ] `/log?date=YYYY-MM-DD` opens that day. Previous, next and a date picker work.
- [ ] The "Open a day" row under the heat map opens each of the last 7 days.
- [ ] A swim time saves, syncs, exports to CSV and imports from CSV.

### F — Workout stats

- [ ] Finish always shows the summary: duration, sets, volume, exercises, new records.
- [ ] `/workouts` lists past sessions, newest first. A session opens to its detail offline.

### G — Goals and Today

- [ ] Profile edits 6 goals and shows "Week starts on Monday".
- [ ] Each goal draws a goal line on its chart.
- [ ] Today shows the workout, the note, calories against the goal, weight against the target and swim time. An empty field is hidden.

### H — Heart rate

- [ ] With a birth year, avg 150 and peak 160 do not put 100 % in Peak.
- [ ] Each zone shows its bpm range. The info sheet explains the 4 zones.

### I — Stats layout

- [ ] Edit mode moves a card up and down, and hides and shows it, by touch and by keyboard.
- [ ] The layout syncs to the laptop. Reset restores the default.
