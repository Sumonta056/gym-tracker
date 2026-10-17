# Phase 3 — step index

`docs/plan/03-phase-3.md` is the source of truth. This folder splits it into 14 step
files. One step is one session. Never do two steps in one session.

Revised on 2026-10-17. The design: `docs/specs/2026-09-24-coach-plans-design.md`,
sections 11 to 14 hold the revision. The accepted mockup:
https://claude.ai/artifact/FqAoJcGnmTCUEqQsTtNLa7. The source data: `docs/data/`.

**Branch for all of Phase 3:** `feat/phase-3-coach-plans`, cut from `main` after the
fix track merge.

## How a session runs

1. Read `PROGRESS.md`. It names the next step.
2. Open that step file in this folder. Read only that file.
3. Do the step. Stop at the end of the step.
4. Run `pnpm check:step`, then `pnpm e2e:step <spec>` for the spec the step names.
5. Run the `commit-report` skill. Then the owner commits.
6. Update the **Next step** line in `PROGRESS.md`.

The full `pnpm verify` runs at a checkpoint only, and before the merge to `main`.

## The steps

| Step | File                        | Title                                  | Size | Depends on          | E2E spec                 | State |
| ---- | --------------------------- | -------------------------------------- | ---- | ------------------- | ------------------------ | ----- |
| 3.0  | `S3.0-test-loop.md`         | The step test loop                     | S    | Fix track           | `smoke.spec.ts`          | done  |
| 3.1  | `S3.1-design-contract.md`   | The prototype plates and the docs      | M    | 3.0                 | none                     | done  |
| 3.2  | `S3.2-plan-schema.md`       | The plan schema and the coach data     | M    | 3.1                 | none                     | done  |
| 3.3  | `S3.3-exercise-seed.md`     | The coach exercises, `plan_ids`        | M    | 3.2                 | none                     | —     |
| 3.4  | `S3.4-exercise-images.md`   | The images, offline                    | S    | 3.2                 | `offline-images.spec.ts` | —     |
| 3.4b | `S3.4b-muscle-map.md`       | The muscle map                         | S    | 3.2                 | none                     | —     |
| 3.5  | `S3.5-plan-metrics.md`      | `lib/metrics` for plans                | S    | 3.2                 | none                     | —     |
| 3.6  | `S3.6-plan-repository.md`   | The repository for plans               | M    | 3.3                 | none                     | —     |
| 3.7  | `S3.7-choose-plan.md`       | `/workouts` and the plan preview       | M    | 3.4, 3.4b, 3.5, 3.6 | `workouts.spec.ts`       | —     |
| 3.8  | `S3.8-guided-step.md`       | `/workout` in plan mode                | L    | 3.7                 | `plans.spec.ts`          | —     |
| 3.9  | `S3.9-session-done.md`      | Done, 2 plans, the laptop layout       | M    | 3.8                 | `plans.spec.ts`          | —     |
| 3.10 | `S3.10-styleguide-e2e.md`   | Style guide, access, end to end        | M    | 3.9                 | full `pnpm verify`       | —     |
| 3.11 | `S3.11-coach-plan-skill.md` | The `coach-plan` skill                 | M    | 3.3, 3.4, 3.10      | none                     | —     |
| 3.12 | `S3.12-device-check.md`     | Verification, production, device check | S    | 3.10, 3.11          | full `pnpm verify`       | —     |

## Order

```
3.0 ─ 3.1 ─ 3.2 ─┬─ 3.3 ─ 3.6 ─┐
                 ├─ 3.4 ───────┤
                 ├─ 3.4b ──────┤
                 └─ 3.5 ───────┼─ 3.7 ─ 3.8 ─ 3.9 ─ 3.10 ─ 3.11 ─ 3.12
```

3.3, 3.4, 3.4b and 3.5 are independent after 3.2. Do them in any order, one per
session.

## Checkpoints

Stop and report to the user at each checkpoint. Run the full `pnpm verify` first. Do
not continue without approval.

### Checkpoint A — after 3.4b

- [x] The owner accepted the 5 prototype plates.
- [ ] The owner confirmed the image licence.
- [ ] The migration is applied on the live project, and every coach exercise exists.
- [ ] A step image loads with the network down, on a cold cache.
- [ ] `MuscleMap` shows the right regions for all 26 steps on `/styleguide`.

### Checkpoint B — after 3.8

- [ ] A full plan runs at 390 px, from Start to the last step.
- [ ] A reload in the middle resumes at the same step.
- [ ] The owner accepted the focus mode with no bottom bar.
- [ ] The owner accepted the Muscles view on the phone.

### Checkpoint C — after 3.12

- [ ] Every item in the Phase 3 checklist of `docs/plan/03-phase-3.md` passes.

## What the fix track already built

Do not build these again. Read them first.

- `/workouts`: `SessionLauncher` with Start a session and Resume, and `WorkoutHistory`
  with the day cards and the session delete. The plan picker goes above them.
- `SessionSummary` and `sessionStats`, the finish summary. The gym time offer is gone.
- The error boundaries, the error log and the saved toast.

## What Phase 2 already built

- `exercises`, `workout_sessions`, `workout_sets` and their zod schemas in `lib/schema/`.
- The repository: `startSession`, `finishSession`, `addSet`, `updateSet`, `deleteSet`,
  `listSets`, `getActiveSession`.
- `/workout`: the timer from `started_at`, the set rows, "Add set", the resume prompt.
- The rest timer from step 2.5.
- `lib/metrics/volumeLoad.ts` and `personalRecords.ts`.

## What Phase 1 already built

- `components/ui/`, including `AppShell`, `Card`, `HeroCard`, `PrimaryButton`,
  `SecondaryButton`, `MicroLabel` and `StatusChip`.
- `lib/nav.ts`: Today, Stats, Workouts, Profile, and the Log action.
- `app/sw.ts`: the Serwist worker, with `/~offline` as the fallback.
- `lib/db/dexie.ts`. Read `DATABASE_VERSION` there. It was 5 on 2026-10-17.

## Risks

| Risk                                                      | Impact | Mitigation                                                        |
| --------------------------------------------------------- | ------ | ----------------------------------------------------------------- |
| An image is not in the cache in the gym                   | High   | 3.4 precaches all 52. An e2e test loads one on a cold cache.      |
| A coach exercise id drifts from the seed                  | High   | 3.3 has a test that checks every id against the seed.             |
| A step breaks a screen it did not touch                   | Medium | CI runs the full gate on every push. Full verify at checkpoints.  |
| The cursor table is written through the outbox by mistake | Medium | 3.6 asserts no outbox entry. The `sync-auditor` reviews.          |
| Focus mode breaks the "one navigation" e2e rule           | Medium | 3.8 adds a named exception with a reason. The owner approves it.  |
| A muscle match from Free Exercise DB is wrong             | Low    | `coach-exercises.json` names the matched entry. The owner checks. |
| The image licence is not clear                            | Medium | 3.4 stops until the owner confirms.                               |
| A new image from a link is the wrong picture              | Medium | The `coach-plan` skill opens each file and asks for a yes.        |
| Removing a plan breaks old sessions                       | Medium | A plan id never leaves `PlanId`. The plan gets `retired: true`.   |

## Open questions

- The image licence. The owner answers at 3.4.
- Whether the repository is public. It changes the licence answer.
- Closed on 2026-10-17: the mockup artifact from September is gone. The accepted demo
  above replaces it.
- Closed on 2026-10-17: video is a link out, never a player in the app.
