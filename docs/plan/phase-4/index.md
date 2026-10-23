# Phase 4 — step index

`docs/plan/04-phase-4.md` is the source of truth: the header, the Global Constraints,
the Review Focus and the checklist. This folder splits it into 6 step files. One step is
one session. Never do two steps in one session.

The design: `docs/specs/2026-10-23-saved-videos-design.md`. The mockups, until 4.1
replaces them: `.superpowers/brainstorm/53004-1792733300/content/saved-links-list-v5.html`
(the list and the form) and `nav-bar-options.html` option A (the bar).

**Branch:** `main`, 1 step at a time. A hook blocks Claude's commit and push on `main`;
the owner runs both.

## How a session runs

1. Read `PROGRESS.md`. It names the next step.
2. Open that step file. Read only that file and `docs/plan/04-phase-4.md`.
3. `export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"`.
4. Do the step. Stop at its end.
5. Run `pnpm check:step`, then `pnpm e2e:step <spec>` for the spec the step names.
6. Run the `commit-report` skill. Stage. Stop. The owner commits.
7. Update the **Next step** line in `PROGRESS.md`.

## The steps

| Step | File                      | Title                                    | Size | Depends on    | E2E spec                             | State |
| ---- | ------------------------- | ---------------------------------------- | ---- | ------------- | ------------------------------------ | ----- |
| 4.1  | `S4.1-design-contract.md` | The prototype plates                     | M    | spec approved | none                                 | done  |
| 4.2  | `S4.2-link-spike.md`      | The iPhone link spike and `openTarget`   | S    | 4.1           | none                                 | done  |
| 4.3  | `S4.3-data-and-sync.md`   | Schemas, migration, repository, sync     | L    | 4.1           | none                                 | done  |
| 4.4  | `S4.4-saved-screen.md`    | `/saved` and the add and edit form       | L    | 4.2, 4.3      | `saved.spec.ts`                      | done  |
| 4.5  | `S4.5-navigation.md`      | The Saved tab and the header avatar      | M    | 4.4           | `responsive.spec.ts`, `a11y.spec.ts` | done  |
| 4.6  | `S4.6-verification.md`    | Full verify, browser check, device check | S    | 4.5, Ckpt A   | full `pnpm verify`                   | done  |

## Order

```
4.1 ─┬─ 4.2 ─────────┐
     └─ 4.3 ─────────┼─ 4.4 ─ 4.5 ─ 4.6
   Checkpoint A ─────┘ (owner's iPhone answer, before 4.4 is done)
```

## Checkpoints

Stop and report to the owner at each checkpoint. Do not continue without approval.

### Checkpoint A — the iPhone link answer

- [x] The owner reported which way opens each app, from the home screen app.
- [x] `STANDALONE_WAY` holds the answer, with its tests.
- [x] If no way opens Instagram, the owner decided again. Not needed: Instagram opens
      with the default way. YouTube on the iPhone is not yet confirmed by the owner.

### Checkpoint B — after 4.6

- [x] Run the full `pnpm verify` first.
- [x] Every item in the Phase 4 checklist of `docs/plan/04-phase-4.md` passes.

## What already exists. Read it; do not build it again

- `lib/db/repository.ts`: `refuseWhenSignedOut`, the `deleteSet` and `restoreSet` pair
  (the soft delete and undo pattern), `clearAll`.
- `lib/sync/outbox.ts`: `SYNCED_TABLES`, `PARENT_TABLES`, `waitsOnParent`.
- `lib/sync/worker.ts`: `sendSet` with `setRefusal` (a foreign key refusal becomes
  `PARENT_NOT_SYNCED`), `pullSteps`.
- `components/ui/SheetModal.tsx`, `components/workout/UndoToast.tsx` (`UndoToast`,
  `ToastRoom`), `components/ui/Field.tsx`, `PrimaryButton`, `SecondaryButton`,
  `MicroLabel`, `components/sync/SyncChip.tsx`.
- `components/dashboard/DashboardHeader.tsx`: `initialOf(name)` and the avatar link
  that 4.5 turns into `ProfileAvatarLink`.
- `components/plans/WatchPill.tsx`: today's outbound link, `target="_blank"`.

## Risks

| Risk                                                    | Impact | Mitigation                                                                     |
| ------------------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| No way opens the Instagram app from the home screen app | High   | 4.2 ships first; Checkpoint A gates 4.4; the owner decides again.              |
| A video reaches the server before its category          | High   | 1 transaction, category first; a foreign key refusal waits as a parent refusal |
| The Dexie bump moves the version 6 upgrade              | High   | 4.3 pins version 6 as its own block; a test opens a version 6 database.        |
| The bar shows 5 items when Profile joins the sidebar    | Medium | `AppShell` takes `sidebarItems`; a test counts the bar links.                  |
| The chip row scrolls the page sideways                  | Medium | The row scrolls in its own box; `responsive.spec.ts` covers `/saved`.          |
| 2 offline devices make 2 categories with 1 name         | Low    | Kept on purpose (spec 11). The owner renames 1.                                |
