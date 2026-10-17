# Phase 3 — The coach plans

Goal: follow the coach's 4-day routine in the app, one exercise at a time, with the
start and end images, the muscle map and a video link, on any day, with no network.

Exit condition: in flight mode, the user picks a plan, sees both images and the muscle
map on every step, logs every set, finishes, and the sets appear in the Phase 2 charts
after sync.

Revised on 2026-10-17, after the fix track. The design:
`docs/specs/2026-09-24-coach-plans-design.md`, sections 11 to 14 hold the revision.
The mockup the owner accepted: https://claude.ai/artifact/FqAoJcGnmTCUEqQsTtNLa7.
The source data: `docs/data/README.md`. The step files: `docs/plan/phase-3/index.md`.

## The test loop in Phase 3

A step runs `pnpm check:step`, then `pnpm e2e:step <spec>` for the spec the step file
names. A step that names no spec runs no browser test. The full `pnpm verify` runs at
the 3 checkpoints and before the merge to `main`. CI runs the full gate on every push.
Step 3.0 adds the script and writes this rule into `.claude/rules/testing.md`.

Load the `design-system` skill before any step that touches `app/` or `components/`.

---

## 3.0 The step test loop

1. Add `e2e:step` to `package.json`: 1 spec on the `desktop` project, with the reused
   e2e build.
2. Write the Phase 3 loop into `.claude/rules/testing.md` and `PROGRESS.md`.

---

## 3.1 The design contract

1. Add 5 plates to `docs/design/prototype/index.html`, from the accepted mockup:
   choose a plan, plan preview, guided step with the Muscles view, session done, and
   the guided step at 1440 px.
2. Fix the stale links and the Dexie version in the Phase 3 docs.

**Done when** the owner opens the prototype and accepts the 5 plates.

---

## 3.2 The plan schema and the coach data

1. `lib/schema/plan.ts`: a plan, a group and a step. A step carries `images`,
   `muscles` with `primary` and `secondary`, and an optional `video`.
2. `lib/plans/coach.ts`: the 4 plans and 26 steps, generated from
   `docs/data/coach-exercises.json` by `scripts/coach-data.mjs`, never typed by hand.
3. `lib/plans/index.ts`: `listPlans()`, `getPlan(id)`, `combinePlans(ids)`,
   `planMinutes(plan)`.

---

## 3.3 The coach exercises and the plan column

Unchanged. The migration adds the missing coach exercises as global rows and
`workout_sessions.plan_ids`. Dexie bumps by 1 from the live `DATABASE_VERSION` and
gains `planCursors`. **Apply the migration to the live project through the Supabase
MCP in this step.** That is the first production push of Phase 3.

---

## 3.4 The exercise images, offline

1. The owner confirms the image licence. Stop if the answer is no.
2. `scripts/exercise-image.mjs` converts `docs/data/coach-images/` to 52 WebP files
   in `public/exercises/`, 420 × 280, quality 80.
3. Precache all 52 in the service worker.

---

## 3.4b The muscle map

1. `lib/design/body.ts`: the polygons from `docs/data/body-polygons.json`, with the
   MIT notice, and the muscle to region table from `docs/data/README.md`.
2. `components/plans/MuscleMap.tsx`: a front and a back figure. The primary muscles
   solid in the group colour, the secondary at 55 percent. A text alternative.
3. `components/plans/MuscleTags.tsx`: the muscles as chips under the name.

---

## 3.5 `lib/metrics` for plans — write the tests first

Unchanged: `planSuggestion.ts` and `planProgress.ts`.

---

## 3.6 The repository for plans

Unchanged: `startPlanSession`, the cursor functions, `lastSetFor`,
`listPlanHistory`, and `plan_ids` in the sync worker.

---

## 3.7 `/workouts` — choose a plan, and the plan preview

1. Add the suggestion hero, the 4 plan cards and the Start bar **above** the free
   session launcher and the day-card history. Nothing from the fix track leaves.
2. Add `/workouts/[planId]`, the preview, with a watch pill on a row that has a video.

---

## 3.8 `/workout` in plan mode — the guided step

1. The header, the progress bars, the step frame with Start, End, Play and Muscles,
   the name, the muscle chips, the pills, the set rows, the rest timer and the foot.
2. The cursor in `planCursors`. A reload resumes the same step.
3. Focus mode under 1024 px.

Split into 3.8a and 3.8b if it passes 1 session.

---

## 3.9 Session done, 2 plans together, and the laptop layout

Unchanged, with 1 change: at 1024 px and up the image row has 3 cells, Start, End and
Muscles.

---

## 3.10 Style guide, responsive, access and the end-to-end suite

Unchanged, plus `MuscleMap` and `MuscleTags` samples on `/styleguide`. The first full
`pnpm verify` since checkpoint B runs here.

---

## 3.11 The `coach-plan` skill

The owner gives a plan, a step, 2 image links, and optionally a video link. The skill
looks up the muscles in Free Exercise DB, converts the images, updates
`docs/data/coach-exercises.json`, and regenerates `lib/plans/coach.ts`.

---

## 3.12 Phase 3 verification, the production push and the device check

1. Full `pnpm verify`. Merge to `main`. The owner pushes. Vercel builds. The images,
   the polygons and the plans ship with the app.
2. On the real iPhone, in flight mode: pick a plan, check every image and the muscle
   map, log the sets, finish. Turn flight mode off. Confirm the sync on the laptop.

---

## Phase 3 checklist

- [ ] `pnpm verify` passes.
- [ ] `pnpm e2e` passes on all three projects.
- [ ] Every step reads its images from `step.images`, and every path is a real file.
- [ ] Every step has `muscles.primary` with 1 or more entries.
- [ ] `lib/plans/coach.ts` equals the output of `scripts/coach-data.mjs`.
- [ ] The `coach-plan` skill adds a step from 2 image links, with no manual edit.
- [ ] `lib/metrics/**` coverage is 100 percent for lines.
- [ ] `lib/sync/**` coverage is 95 percent or higher.
- [ ] All 52 images load in flight mode on the iPhone, on a cold cache.
- [ ] The Muscles view shows on every step in flight mode.
- [ ] A full plan records offline, and every set syncs.
- [ ] 2 plans together run in order and show both titles.
- [ ] A reload in the middle of a plan resumes at the same step.
- [ ] Zero serious axe issues on the 3 new screens.
- [ ] No horizontal scroll from 320 px to 2560 px on the new screens.
- [ ] `/styleguide` still matches the prototype.
- [ ] The migration is applied to the live project, and the app is live on Vercel.

**Commit** one report per step. The final one is
`feat(ui): phase 3 coach plans complete`.
