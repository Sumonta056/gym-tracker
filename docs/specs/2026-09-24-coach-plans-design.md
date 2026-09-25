# Coach plans — design

Phase 3 of the Gym Tracker. It builds on Phase 2. Read
`docs/specs/2026-09-20-gym-tracker-design.md` first.

## 1. The problem

The user is new to the gym. A coach gave a 4-day routine as one HTML file,
`docs/My Gym Plan.html`. The file has 3 problems:

1. It locks each workout to a weekday: Wednesday, Thursday, Saturday, Sunday.
2. It keeps the ticks in `localStorage` only. They do not sync, and no chart sees them.
3. It is separate from the app, so the user logs the sets in 2 places.

The images in the file are the useful part. The user does not know the exercises yet.
Each exercise has a start image and an end image.

## 2. The goal

The user opens Workouts, picks a coach plan for today, and goes through it one
exercise at a time. Each step shows the 2 images, the how-to text and the set rows.
Every set lands in the Phase 2 session, so the charts and the records see it. It works
with no network.

## 3. What the user asked for, and where it lands

| The user said                             | The design                                                     | Step     |
| ----------------------------------------- | -------------------------------------------------------------- | -------- |
| The date must not be fixed                | No weekday lock. The user picks a plan on any day.             | 3.7      |
| Choose a plan for the day                 | `/workouts` lists the 4 plans and suggests the least recent 1. | 3.5, 3.7 |
| Combine plans when a day is missed        | Select 2 plans. Their steps run one after the other.           | 3.7, 3.9 |
| Start step by step, one plan              | `/workout` in plan mode shows 1 exercise per screen.           | 3.8      |
| The images, as a card                     | The step card shows the start and end images side by side.     | 3.4, 3.8 |
| Fit into the app I have                   | The Phase 2 session, set rows, rest timer and day link.        | 3.6, 3.8 |
| It must work in the gym with no network   | The plans are code. The service worker precaches every image.  | 3.4      |
| It must also work on a laptop             | At 1024 px and up, the step list sits left of the step.        | 3.9      |
| Save the images locally, as WebP          | `public/exercises/*.webp`, paths stored on each step.          | 3.2, 3.4 |
| No upload and no image hosting            | The files ship with the app. No bucket, no upload screen.      | 3.4      |
| Later: a link and a step, and it is added | The `coach-plan` skill.                                        | 3.11     |

## 4. Decisions

These were agreed with the user on 2026-09-24. Do not reopen them.

1. **Phase 3 comes after Phase 2.** It reuses the Phase 2 tables. No second copy of the
   exercise list.
2. **A step logs sets.** It is not a tick only. The set rows are the Phase 2 rows.
3. **The user picks the plan on the day.** There is no calendar. The app suggests the
   plan done least recently.
4. **The 4 plans are fixed data in code.** There is no plan editor in Phase 3. When the
   coach changes the plan, a developer changes `lib/plans/coach.ts`.
5. **The target is 3 sets of 10 to 12 reps** for every step. The coach gave no target.
6. **The session hides the bottom bar under 1024 px.** A guided session is a focus
   screen. The header carries a leave control and a back control.

## 5. Why the plans are code, not tables

Data that only the developer changes belongs in code. Code gets type checks, tests and
review. Data that the user changes belongs in the database. The user chose fixed
plans, so the plans are code.

The screens read the plans through `lib/plans/`. If an editor comes later, the same
zod shape moves into a table and only `lib/plans/` changes.

A plan is not a row, so the UUID rule does not apply to it. A plan has a fixed slug id:
`chest-triceps`, `back-biceps`, `shoulders`, `legs`.

## 6. Data

### New code

```
lib/schema/plan.ts     the zod shape of a plan, a group and a step
lib/plans/coach.ts     the 4 coach plans, 26 steps
lib/plans/index.ts     listPlans, getPlan, combinePlans
```

A step:

```ts
{
  exerciseId: string          // the uuid of a global row in exercises
  slug: string                // 'flat-dumbbell-press'
  name: string                // 'Flat Dumbbell Press'
  how: string                 // the coach's one-line text
  images: {
    start: string             // '/exercises/flat-dumbbell-press-start.webp'
    end: string               // '/exercises/flat-dumbbell-press-end.webp'
  }
  target: { sets: 3, repsMin: 10, repsMax: 12 }
}
```

The step holds its own image paths. The screens read `step.images`, and never build
a path. A test checks that every path points at a file in `public/`.

A plan id never leaves the `PlanId` enum, because old sessions carry it in
`plan_ids`. To remove a plan, set `retired: true` on it. `listPlans` hides a retired
plan, and a finished session still shows its title.

A plan has an `id`, a `title` and 1 or 2 `groups`. Each group has a `name` and its
`steps`, in the coach's order.

### Changed tables

| Table              | Change                                                                  |
| ------------------ | ----------------------------------------------------------------------- |
| `exercises`        | The 26 coach exercises exist as global rows, with fixed UUIDs.          |
| `workout_sessions` | A new column `plan_ids text[] null`. Null means a free Phase 2 session. |

A coach exercise reuses a Phase 2 seed row when the name matches. Otherwise the
migration adds a new global row. `lib/plans/coach.ts` holds the same UUIDs, and a test
keeps the 2 in step.

### Local only

`planCursors` is a new Dexie table: `{ sessionId, stepIndex, skipped: string[] }`. It
holds where the user is in a guided session. It is device state, like `syncMeta`. It
is not an entity, it has no outbox entry, and it never syncs. A reload resumes at the
right step. Finish and sign-out clear it.

### Derived

| Function                       | File                            | Result                                      |
| ------------------------------ | ------------------------------- | ------------------------------------------- |
| `lastDoneByPlan(sessions)`     | `lib/metrics/planSuggestion.ts` | The last finished date for each plan id     |
| `suggestPlan(plans, sessions)` | `lib/metrics/planSuggestion.ts` | The plan id done least recently             |
| `stepStatuses(...)`            | `lib/metrics/planProgress.ts`   | `done`, `skipped`, `now` or `todo` per step |
| `sessionSummary(...)`          | `lib/metrics/planProgress.ts`   | Steps done, steps skipped, sets, volume     |

A step is `done` when it has 1 or more sets in the session. Nothing stores a tick.

## 7. Images

- 52 images: a start and an end for each of the 26 exercises. They come from
  `docs/My Gym Plan.html`, where they are base64 inside the file.
- They go to `public/exercises/<slug>-start.webp` and `<slug>-end.webp`, about 1 MB in
  total. They are WebP, 420 × 280, quality 80.
- **No upload and no image hosting.** The files are committed with the code. Vercel
  serves them with the app, the same way it serves the app icons. There is no
  Supabase Storage bucket and no upload screen.
- `scripts/exercise-image.mjs` does every conversion. It takes a link, a local file or
  a base64 image, and writes 1 WebP file.
- **New images later.** The owner gives an image link and the step. The `coach-plan`
  skill downloads the image, converts it, saves it, and adds the step with its
  `images` paths. See step 3.11.
- The service worker precaches all 52. A user who never opened a plan online still
  sees every image in flight mode.
- Every `<img>` has an alt text: `<name>, start position` or `<name>, end position`.
- **Licence.** The source of the images is not known. The app has 1 user, so private
  use is fine. The owner confirms before step 3.4 commits the images, and says if the
  repository is public.

## 8. Screens

The mockup: https://claude.ai/artifact/1GTuEKpPzugLtzpVP43L2b. Step 3.1 copies it into
`docs/design/prototype/index.html`, which is the visual contract.

| #   | Screen              | Route                   | Content                                                                      |
| --- | ------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| 1   | Choose a plan       | `/workouts`             | Suggested plan hero, 4 plan cards, select 1 or 2, the missed-day note, Start |
| 2   | Plan preview        | `/workouts/[planId]`    | The steps by group, a thumbnail, the target, the last weight, Start          |
| 3   | Guided step         | `/workout` in plan mode | Header, progress bars, the image card, the set rows, rest, Skip, Next        |
| 4   | Session done        | `/workout` after Finish | Gym time hero, the result per step, the Phase 2 offer to save gym time       |
| 5   | Guided step, laptop | `/workout` at 1440 px   | Sidebar, the step list on the left, the step on the right                    |

### The guided step, in detail

- The header: a back control (a leave control on step 1), the plan title, `Step 2 of 9
· Chest`, and the elapsed time from `started_at`.
- The progress bars: 1 bar per step. Each bar also carries a text label for a screen
  reader, so color is not the only signal.
- The image card: the 2 images side by side, labelled `1 · Start` and `2 · End`. Then
  the name, the muscle group, the how-to text, `Target 3 × 10–12` and `Last time`.
- The set rows: 3 rows fill in from the last set of that exercise. A first time leaves
  the weight empty. `Bench Dips` has no weight. `+ Add set` copies the row above.
- A tick starts the Phase 2 rest timer.
- The foot: `Skip` and `Next step`, with the next name under it. The last step shows
  `Finish session`.

### Two plans together

The steps of the first plan run first, then the steps of the second. The header shows
both titles, `Shoulders + Legs`. The Phase 3 data has no shared exercise between plans.
`combinePlans` still drops a duplicate, and keeps the first.

## 9. Error cases

| Case                                       | Behaviour                                                          |
| ------------------------------------------ | ------------------------------------------------------------------ |
| A session is already active on Start       | The Phase 2 resume-or-discard prompt. Never 2 active sessions.     |
| The app reloads in the middle of a plan    | `planCursors` resumes at the same step, with the same skips.       |
| `planCursors` is empty for an active plan  | Resume at the first step with no sets.                             |
| `plan_ids` names a retired plan            | Show its title in history. Hide it from the plan list.             |
| `plan_ids` names an id that the code lacks | Drop the unknown id. If none is left, show the free session.       |
| An image fails to load                     | The card keeps its size and shows the name on `--color-surface-2`. |
| Every step skipped, then Finish            | Allowed. The summary shows 0 steps done. No gym time offer.        |

## 10. Out of scope

- A plan editor, custom plans, and custom images in the app.
- An image upload screen, and any image hosting or storage bucket.
- A per-exercise target from the coach.
- A weekly calendar or reminders.
- Tap to zoom on an image.
- Video.
