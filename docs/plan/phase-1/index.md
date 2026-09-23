# Phase 1 — step index

`docs/plan/01-phase-1.md` is the source of truth. This folder splits it into 17 step
files, plus step 1.13b, added after 1.13. One step is one session. Never do two steps in one session.

**Branch for all of Phase 1:** `feat/phase-1-daily-tracker`

## How a session runs

1. Read `PROGRESS.md`. It names the next step.
2. Open that step file in this folder. Read only that file.
3. Do the step. Stop at the end of the step.
4. Run `pnpm verify`.
5. Run the `commit-report` skill. Then commit.
6. Update the **Next step** line in `PROGRESS.md`.

## The steps

| Step  | File                            | Title                       | Size | Depends on | State |
| ----- | ------------------------------- | --------------------------- | ---- | ---------- | ----- |
| 1.1   | `S1.1-supabase-migration.md`    | Supabase project and 0001   | M    | —          | done  |
| 1.2   | `S1.2-supabase-clients.md`      | Generated types and clients | S    | 1.1        | done  |
| 1.3   | `S1.3-auth-magic-link.md`       | Magic link and route groups | M    | 1.2        | done  |
| 1.4   | `S1.4-duration.md`              | `lib/duration.ts` rewrite   | M    | —          | done  |
| 1.5   | `S1.5-zod-schemas.md`           | Shared zod schemas          | S    | 1.4        | done  |
| 1.6   | `S1.6-dexie-repository.md`      | Dexie and the repository    | M    | 1.5        | done  |
| 1.7   | `S1.7-outbox-sync-worker.md`    | Outbox and sync worker      | L    | 1.2, 1.6   | done  |
| 1.8   | `S1.8-app-shell.md`             | The responsive app shell    | S    | 1.3        | done  |
| 1.9   | `S1.9-log-form.md`              | `/log` — the daily form     | M    | 1.6, 1.8   | done  |
| 1.10  | `S1.10-metrics.md`              | `lib/metrics`               | M    | 1.4        | done  |
| 1.11  | `S1.11-dashboard.md`            | `/` — the dashboard         | M    | 1.9, 1.10  | done  |
| 1.12  | `S1.12-analytics-charts.md`     | `/analytics` — the charts   | L    | 1.10, 1.11 | done  |
| 1.13  | `S1.13-profile.md`              | `/profile`                  | M    | 1.7, 1.8   | done  |
| 1.13b | `S1.13b-sync-hardening.md`      | Sync hardening, dead letter | M    | 1.13       | now   |
| 1.14  | `S1.14-motion-pass.md`          | The motion pass             | S    | 1.12       | —     |
| 1.15  | `S1.15-responsive-a11y-pass.md` | Responsive and access pass  | M    | 1.13b      | —     |
| 1.16  | `S1.16-e2e-suite.md`            | The end-to-end suite        | M    | 1.15       | —     |
| 1.17  | `S1.17-deploy-device-check.md`  | Deploy and device check     | S    | 1.16       | —     |

## Order

```
1.1 ─ 1.2 ─ 1.3 ─ 1.8 ─┐
            │          │
            └── 1.7 ───┤
                       │
1.4 ─ 1.5 ─ 1.6 ───────┤
  │                    │
  └── 1.10 ────────────┤
                       ├─ 1.9 ─ 1.11 ─ 1.12 ─ 1.14 ─┐
                       └─ 1.13 ─ 1.13b ─────────────┼─ 1.15 ─ 1.16 ─ 1.17
```

1.4 has no dependency. Start it at any time. It is the highest risk step.

## Checkpoints

Stop and report to the user at each checkpoint. Do not continue without approval.

### Checkpoint A — after 1.3 · passed

- [x] The migration applies on a fresh database.
- [x] Account A cannot read a row of account B.
- [x] A real magic link signs the user in on a phone and on a laptop.
      Laptop confirmed. The iPhone half runs again at 1.17 on the deployed URL.

### Checkpoint B — after 1.7 · passed

- [x] `lib/duration.ts` coverage is 100 percent.
- [x] `lib/sync/**` coverage is 95 percent or higher.
- [x] A write with the network down survives a reload.

### Checkpoint C — after 1.12 · passed

- [x] Every Phase 1 screen renders at 390 px, 768 px and 1440 px.
      Proven on `/sign-in` and the `/styleguide` samples. The live signed-in routes,
      `/log` included, run again at 1.16 with the signed-in fixture.
- [x] Every chart has an empty state and a text alternative.

### Checkpoint D — after 1.17

- [ ] Every item in the Phase 1 checklist of `docs/plan/01-phase-1.md` passes.

## What Phase 0 already built

Do not build these again. Read them first.

- `lib/duration.ts` — exists, but with the old API. Step 1.4 replaces it.
- `lib/design/tokens.ts` — the chart colours. Charts read from here.
- `lib/id.ts` — the UUID helper. The repository uses it.
- `components/ui/` — all eleven primitives, including `AppShell`, `DurationField`,
  `NumberField`, `SegmentedTabs`, `StatCard`, `HeroCard`, `StatusChip`, `SheetModal`,
  `MicroLabel`, `PrimaryButton`, `SecondaryButton`, `Card`.
- `app/styleguide/page.tsx` — the live design contract.

## Risks

| Risk                                                      | Impact | Mitigation                                                   |
| --------------------------------------------------------- | ------ | ------------------------------------------------------------ |
| The `lib/duration.ts` rewrite breaks Phase 0 callers      | High   | Step 1.4 lists every caller and updates it in the same step. |
| A sync bug loses a write made offline                     | High   | Step 1.7 writes the tests first. The `sync-auditor` reviews. |
| A duration in the sheet is ambiguous, for example `15.54` | Medium | `parseSheetValue` returns `certain: false`. Phase 2 asks.    |
| Coverage floors block a commit late in the phase          | Medium | Every step writes its own tests before it ends.              |

## Open questions

- 1.1 needs a real Supabase project. The user must create it and supply the keys.
- 1.17 needs a real iPhone and a Vercel account.

&nbsp;
