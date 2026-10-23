# Owner feedback fixes — design

A fix track between Phase 2 and Phase 3. The owner used the app on an iPhone and a
laptop and wrote 17 items. Phase 3 waits until this track closes. Read
`docs/features/product.md` first.

## 1. The 17 items and where they land

| #   | The owner wrote                               | What the code does today                                                                                              | The design                                                                    | Step   |
| --- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------ |
| 1   | Swimming option                               | No swim field. Cardio is only a muscle group label.                                                                   | A separate Swimming card in `/log`: the swim time of the day.                 | F13    |
| 2   | Save modal                                    | `SheetModal` has no portal. iOS scrolls the page behind it. The keyboard hides Save. A save gives almost no feedback. | A portal, an iOS scroll lock, a keyboard-aware panel, a Saved toast.          | F3     |
| 3   | Picker for timer                              | Rest time is free text with the full keyboard. "90" means 90 minutes.                                                 | A `DurationPicker`: preset chips and −15 s / +15 s buttons.                   | F9     |
| 4   | Workout does not show stats                   | The finish summary shows only inside the gym time offer. `/workouts` is a placeholder.                                | Finish always shows a summary. `/workouts` lists past sessions.               | F11    |
| 5   | Page breaks bottom bar in workout             | On an iPhone, `/workout` breaks as soon as it opens. Cause not yet found.                                             | Reproduce first, then fix. An e2e test guards it.                             | F2     |
| 6   | Cannot see old days logs                      | `/log` reads no date. No screen lists past days.                                                                      | `/log?date=`, previous and next day, a date picker, heat map links.           | F12    |
| 7   | Flickering day month week switch              | Each tab click sets `loading`, unmounts 13 cards and replays the line animation.                                      | Keep the old data on screen until the new data is ready.                      | F5     |
| 8   | More details in today section                 | Today shows no workout, no note, no goal progress.                                                                    | Today shows every tracked value of the day.                                   | F14    |
| 9   | How log and workout data merge?               | 2 sources of gym time. They join only when the user taps "Use".                                                       | Gym time comes from the sessions. A typed value overrides it.                 | F10    |
| 10  | Heart rate in today showing zone 0            | The zones use the session peak as the maximum heart rate. Avg 150, peak 160 puts 100 % in Peak.                       | The zones use a maximum heart rate from the birth year or an override.        | F15    |
| 11  | Swap widget in stats                          | The card order is hard coded in 3 files.                                                                              | An Edit mode: move cards up and down, hide and show. It syncs.                | F16    |
| 12  | Days widget is broken                         | Session gaps see only the range. The heat map has no labels and an invisible future.                                  | Gaps from all history. One meaning of "session". A labelled heat map.         | F6     |
| 13  | Dont show scroll in any page hide it          | No scrollbar rule. The laptop shows every scrollbar.                                                                  | Hide all scrollbars. A fade edge on the chip row.                             | F4     |
| 14  | Goals can change able from profile setting    | Profile edits the step goal and target weight. Nothing reads the target weight. No other goal exists.                 | Goals for steps, calories, gym time, walk time, sessions per week and weight. | F8     |
| 15  | Heart rate zone what do in widgets            | The only help text is "Modelled from the session average and peak."                                                   | Each zone shows its bpm range. An info sheet explains the zones.              | F15    |
| 16  | Website crashed blank page sync can be reason | No error boundary. Unguarded `useLiveQuery` calls in the sync chip throw during render. No error log.                 | Error boundaries, guarded queries, a reload prompt, a local error log.        | F1     |
| 17  | Week start from Monday                        | The code already starts every week on Monday. The labels do not make it clear.                                        | Clear weekday labels and date ranges. Profile shows "Week starts on Monday".  | F6, F8 |

The plan splits these design steps into 26 smaller steps. The map: F1 → A1–A3,
F2 → B1–B2, F3 → B3–B4, F4 → B5, F5 → C1, F6 → C3–C4, F7 → D1, F8 → G1–G2,
F9 → E1–E2, F10 → C2 and E3, F11 → F1–F2, F12 → E4, F13 → E5, F14 → G3,
F15 → H1–H2, F16 → I1.

## 2. Decisions the owner made on 2026-10-05

| Item | Question                         | Answer                                                                           |
| ---- | -------------------------------- | -------------------------------------------------------------------------------- |
| 16   | Where to record client errors    | A local log in Dexie. The last 50 errors. Profile shows them with a Copy button. |
| 9    | How gym time relates to sessions | Gym time is the sum of the finished sessions of the day. A typed value wins.     |
| 10   | What the zones are based on      | The maximum heart rate from the birth year, with an optional override.           |
| 3    | Which duration input             | Preset chips and −15 s / +15 s buttons. No keyboard.                             |
| 2    | Which save problem               | Both: the broken sheet on the iPhone and the missing confirmation.               |
| 8    | Which details on Today           | Workout, note, calories against goal, weight against target, every other field.  |
| 14   | Which goals                      | Steps, calories, gym time, walk time, sessions per week, target weight.          |
| 11   | What "swap" means                | Reorder and hide, in an Edit mode. Saved in the profile.                         |
| 1    | Swim shape                       | One swim time per day, in its own card in `/log`. No distance.                   |
| 13   | How far to hide scrollbars       | Hide all. A fade edge on the horizontal chip row.                                |
| 5    | When the bar breaks              | On the iPhone, as soon as `/workout` opens.                                      |
| 17   | Week start                       | Keep Monday. Show it in Profile as a fixed fact. Not a setting.                  |

## 3. The cross-cutting design

### 3.1 One schema step

F7 holds the only migration of the track. It also bumps Dexie from version 4 to 5. It
comes before every step that needs a new field. Dexie version 4 comes earlier, in the
error log step, because that table is local only and needs no migration.

`profiles`, new columns, all nullable or with a default:

| Column                   | Type    | Default | Check                                |
| ------------------------ | ------- | ------- | ------------------------------------ |
| `calorie_goal`           | `int`   | null    | 1 to `MAX_CALORIES_BURNT`            |
| `gym_goal_seconds`       | `int`   | null    | 60 to 86 400                         |
| `walk_goal_seconds`      | `int`   | null    | 60 to 86 400                         |
| `sessions_per_week_goal` | `int`   | null    | 1 to 14                              |
| `birth_year`             | `int`   | null    | 1900 to the current year − 10        |
| `max_heart_rate`         | `int`   | null    | `MIN_HEART_RATE` to `MAX_HEART_RATE` |
| `stats_layout`           | `jsonb` | null    | an array of `{ id, hidden }`         |

`daily_entries`, new column: `swim_seconds int null`, the same check as `walk_seconds`.

Dexie, new table in version 4: `errorLog`, keyed by `id`. It is local only. It never enters the
outbox, and the sync worker never reads it. `clearAll` clears it at sign-out.

Each new field goes into the one zod schema of its entity in `lib/schema/`, into
`lib/sync/mappings.ts`, and into the generated types. `swim_seconds` also goes into the
CSV export and an optional CSV import column, because the importer uses the same schema.

### 3.2 One source of gym time

A new pure function, `lib/metrics/gymTime.ts`:

```ts
effectiveGymSeconds(entry: DailyEntry | undefined, sessions: WorkoutSession[]):
  { seconds: number; source: 'typed' | 'sessions' | 'none' }
```

- A typed `gym_seconds` that is not null wins.
- Otherwise the result is the sum of `ended_at − started_at` of every finished,
  not-deleted session on that `entry_date`.
- Every reader uses it: Today, the week totals, the heart rate zones, the charts.
- The stored row never changes. The value is derived on read. Nothing new syncs.
- The "Use" offer and `acceptGymTimeOffer` go away.

### 3.3 The session meaning

A day "has a session" when `effectiveGymSeconds(...).seconds > 0`. The session gap
chart, the heat map and the Totals card all use this one rule.

### 3.4 Maximum heart rate

`lib/metrics/heartRateZones.ts` gets a `maxHeartRate` input.

1. `profile.max_heart_rate` when set.
2. Else `220 − (current year − birth_year)` when `birth_year` is set.
3. Else the current model, with the session peak, and a note that asks for the birth
   year.

The zone floors stay at 60, 70 and 85 percent. The model of the spread between the
average and the peak stays. With a true maximum, the floors fall at realistic bpm.

### 3.5 Error safety

- `app/(app)/error.tsx` and `app/global-error.tsx` catch a render error. They show a
  message, a Reload button and a Copy error button. They write the error to `errorLog`.
- Every `useLiveQuery` in the sync status hooks and in `ImportReview` catches inside its
  query function. A failed read returns `null`. The UI shows an unknown state.
- `lib/db/dexie.ts` handles `versionchange` and `blocked`. The old tab closes the
  database and shows a banner: "A new version is ready. Reload."
- A `ChunkLoadError` reloads the page 1 time. A `sessionStorage` flag stops a loop.
- `window.onerror` and `unhandledrejection` also write to `errorLog`.
- `errorLog` keeps the last 50 rows. A row holds the time, the message, the stack (cut at
  2000 characters) and the route. It holds no entry data.

### 3.6 The sheet

`SheetModal` renders through `createPortal` into `document.body`, outside the page
transition transform. The scroll lock fixes the body at its scroll offset and restores
it on close, which iOS respects. The panel follows `window.visualViewport`, so the
footer and the Save button stay above the keyboard.

A new `Toast` primitive in `components/ui/` shows "Saved" for 2 s, with
`role="status"`. The undo toast keeps its own place.

### 3.7 The duration picker

A new primitive, `components/ui/DurationPicker.tsx`:

- Props: `value` in seconds, `onChange`, `presets`, `step` (default 15), `min`, `max`,
  `label`.
- Preset chips are real buttons with `aria-pressed`. The −/+ buttons have an
  `aria-label`. All targets are 44 px or taller.
- The value shows through `formatDuration`. No component parses text.
- The rest time, the gym time, the walk time and the swim time use it.
- `lib/duration.ts` stays the owner of every parse and format. The bare-number trap
  goes away from the UI because nothing types a number.

### 3.8 The stats layout

The card list becomes data: one array of card ids in the default order. The analytics
screen renders from `profile.stats_layout`, or the default when it is null. An unknown id
is dropped. A new card that the stored layout lacks goes at its default place.

Edit mode shows an Up button, a Down button and a Show or Hide switch on each card. No
drag, so the keyboard works the same as the touch.

## 4. What does not change

- The repository rule, the UUID rule, the soft delete rule and the seconds rule.
- The week starts on Monday. It is not a setting.
- No new external service. No new dependency, unless a step names one and the owner
  approves it.
- Phase 3 keeps its plan. Its step 3.7 already plans `/workouts`. F11 builds the
  history list there, and 3.7 adds the plan picker above it.

## 5. Risks

| Risk                                                         | Impact | Mitigation                                                                |
| ------------------------------------------------------------ | ------ | ------------------------------------------------------------------------- |
| The F2 cause is not where the investigation looked           | High   | F2 reproduces on a real iPhone viewport before any fix.                   |
| Derived gym time changes old numbers on charts               | Medium | A typed value still wins, so old typed days keep their numbers.           |
| A hidden scrollbar hides content                             | Medium | The fade edge on the chip row. The sheets keep a visible footer.          |
| The migration adds a column that an old device does not know | Medium | Every new column is nullable. The pull ignores an unknown field until v5. |
| The error log stores private data                            | Low    | Message, stack and route only. No row content. Local only.                |
| The F3 portal breaks the focus trap of the sheet             | Medium | An e2e test tabs through every sheet.                                     |
