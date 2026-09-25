# Phase 3 — The coach plans

Goal: follow the coach's 4-day routine in the app, one exercise at a time, with the
start and end images, on any day, with no network.

Exit condition: in flight mode, the user picks a plan, sees both images on every step,
logs every set, finishes, and the sets appear in the Phase 2 charts after sync.

Do not start Phase 3 before every Phase 2 checklist item passes.

The design: `docs/specs/2026-09-24-coach-plans-design.md`. The step files:
`docs/plan/phase-3/index.md`.

Every step below ends with `pnpm verify` green. Load the `design-system` skill before
any step that touches `app/` or `components/`.

---

## 3.1 The design contract

**Do**

1. Add 5 plates to `docs/design/prototype/index.html`, from the mockup at
   https://claude.ai/artifact/1GTuEKpPzugLtzpVP43L2b: choose a plan, plan preview,
   guided step, session done, and the guided step at 1440 px.
2. Use the existing prototype classes. Add a class only for the image card and the
   progress bars.
3. Add Phase 3 to the delivery table of `docs/specs/2026-09-20-gym-tracker-design.md`
   and to the phase list of `CLAUDE.md` and `PROGRESS.md`.

**Done when** the owner opens the prototype and accepts the 5 plates.

---

## 3.2 The plan schema and the coach data

**Do**

1. `lib/schema/plan.ts`: the zod shape of a plan, a group and a step.
2. `lib/plans/coach.ts`: the 4 plans and 26 steps, copied word for word from
   `docs/My Gym Plan.html`, in the coach's order.
3. `lib/plans/index.ts`: `listPlans()`, `getPlan(id)`, `combinePlans(ids)`.
4. Every step carries its own `images.start` and `images.end` paths under
   `/exercises/`. A plan can carry `retired: true`.

**Tests**

- The data parses with the schema. There are 4 plans and 26 steps.
- Every slug and every `exerciseId` is unique.
- Every image path has the shape `/exercises/<slug>-start.webp` or `-end.webp`.
- `combinePlans(['shoulders', 'legs'])` returns 8 steps, shoulders first.
- `combinePlans` drops an unknown id and a duplicate step.

---

## 3.3 The coach exercises and the plan column

**Do**

1. Run the `db-migration` skill. It writes the SQL and the Dexie bump together.
2. The migration inserts the missing coach exercises as global rows, with the UUIDs
   from `lib/plans/coach.ts`. A name that matches a Phase 2 seed row reuses that row.
3. The migration adds `workout_sessions.plan_ids text[] null`.
4. Dexie gains the column and the local table `planCursors`.
5. The Phase 2 session schema in `lib/schema/` gains `plan_ids`. Never re-declare it.

**Tests**

- Every `exerciseId` in `lib/plans/coach.ts` exists in the seed.
- The Dexie upgrade keeps every Phase 1 and Phase 2 row.
- A session with `plan_ids` round trips through the schema.

---

## 3.4 The exercise images, offline

**Do**

1. Ask the owner to confirm the image licence. Stop if the answer is no.
2. Write `scripts/exercise-image.mjs`. It takes a link, a file or a base64 image and
   writes 1 WebP file, 420 × 280, quality 80. Step 3.11 reuses it.
3. Run it on the 52 images in `docs/My Gym Plan.html`, into `public/exercises/`.
4. Precache all 52 in the service worker. There is no upload and no image hosting.

**Tests**

- Unit: every step in `lib/plans/coach.ts` has both files on disk.
- E2E offline: a step image loads with the network down, on a cold cache.

---

## 3.5 `lib/metrics` for plans — write the tests first

| File                | Function                         |
| ------------------- | -------------------------------- |
| `planSuggestion.ts` | `lastDoneByPlan`, `suggestPlan`  |
| `planProgress.ts`   | `stepStatuses`, `sessionSummary` |

**Tests**

- `suggestPlan`: a plan never done wins. A tie breaks on the coach order.
- `suggestPlan`: a combined session counts for both plans.
- `suggestPlan`: an active or soft-deleted session does not count.
- `stepStatuses`: a step with a set is `done`, even when it was skipped first.
- `sessionSummary`: an empty session is 0 steps, 0 sets and 0 volume.

**Done when** coverage on `lib/metrics/**` is still 100 percent for lines.

---

## 3.6 The repository for plans

**Do**

1. `startPlanSession(planIds, date)`: calls the Phase 2 `startSession` path, with
   `plan_ids`. One transaction with its outbox entry.
2. `getPlanCursor`, `setPlanCursor`, `clearPlanCursor`. Local only. No outbox.
3. `lastSetFor(exerciseId)`: the last finished set, to fill the rows.
4. `listPlanHistory()`: the finished sessions that carry `plan_ids`.
5. The sync worker pushes and pulls `plan_ids`. `clearAll` clears `planCursors`.

**Tests**

- `startPlanSession` fails when a session is already active.
- `setPlanCursor` writes no outbox entry.
- Sign-out clears `planCursors`.

---

## 3.7 `/workouts` — choose a plan, and the plan preview

**Do**

1. Replace the placeholder `/workouts` page with the choose screen.
2. Add `/workouts/[planId]`, the preview, built statically for the 4 ids.
3. Start calls `startPlanSession`, then opens `/workout`.

**Tests**

- Component: the hero names the plan that `suggestPlan` returns.
- Component: a third selection drops the oldest one.
- Component: with no selection, Start is disabled.

---

## 3.8 `/workout` in plan mode — the guided step

**Do**

1. `/workout` shows plan mode when the active session has `plan_ids`.
2. Build the header, the progress bars, the image card, the set rows, the rest timer
   and the foot from the prototype.
3. The cursor lives in `planCursors`. A reload resumes the same step.
4. Under 1024 px, hide the bottom bar through an `AppShell` focus mode.

**Tests**

- Component: Next moves the cursor. Back returns it. Skip records the skip.
- Component: the rows fill in from `lastSetFor`, and are empty on a first time.
- Integration: a reload resumes at the same step, with the same skips.

---

## 3.9 Session done, 2 plans together, and the laptop layout

**Do**

1. The done screen: the hero, the result per step, and the Phase 2 gym time offer.
2. 2 plans run one after the other, with both titles in the header.
3. At 1024 px and up: the step list on the left, the step on the right.

**Tests**

- Component: the summary counts done and skipped steps correctly.
- Component: all steps skipped shows no gym time offer.
- Component: a step in the list opens that step.

---

## 3.10 Style guide, responsive, access and the end-to-end suite

**Do**

1. `/styleguide` gains the plan card, the image card and the progress bars.
2. Add `/workouts`, `/workouts/[planId]` and `/workout` in plan mode to the responsive
   and axe suites.
3. Write the Phase 3 end-to-end tests.

**Tests** E2E offline: pick 2 plans, log a set on each, reload in the middle, finish,
go online, and every set reaches Supabase.

---

## 3.11 The `coach-plan` skill

**Do**

1. Write `.claude/skills/coach-plan/`. The owner gives a plan, a step and 2 image
   links. The skill downloads the images, runs `scripts/exercise-image.mjs`, saves the
   WebP files, and adds or changes the step in `lib/plans/coach.ts` with its `images`
   paths.
2. A new exercise also gets a seed migration, through the `db-migration` skill. A new
   plan also gets a new `PlanId`.
3. The skill runs the tests, then stops. It never commits.

**Tests** Run the skill on an existing step with its original images. It must leave
no change in git.

---

## 3.12 Phase 3 verification and the device check

**Do** On the real iPhone, in flight mode: pick a plan, check every image, log the
sets, finish. Turn flight mode off. Confirm the sync on the laptop.

---

## Phase 3 checklist

- [ ] `pnpm verify` passes.
- [ ] `pnpm e2e` passes on all three projects.
- [ ] Every step reads its images from `step.images`, and every path is a real file.
- [ ] The `coach-plan` skill adds a step from 2 image links, with no manual edit.
- [ ] `lib/metrics/**` coverage is 100 percent for lines.
- [ ] `lib/sync/**` coverage is 95 percent or higher.
- [ ] All 52 images load in flight mode on the iPhone, on a cold cache.
- [ ] A full plan records offline, and every set syncs.
- [ ] 2 plans together run in order and show both titles.
- [ ] A reload in the middle of a plan resumes at the same step.
- [ ] Zero serious axe issues on the 3 new screens.
- [ ] No horizontal scroll from 320 px to 2560 px on the new screens.
- [ ] `/styleguide` still matches the prototype.

**Commit** one report per step. The final one is
`feat(ui): phase 3 coach plans complete`.
