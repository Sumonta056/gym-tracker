---
name: new-feature
description: The workflow for any new feature or user-visible change in the Gym Tracker —
  agree the design, write `docs/features/<name>.md`, build test first, pass the gates,
  update the website and stop before the commit. Use when asked to "add a feature",
  "build X", "start the next feature", "new screen for", or when the owner describes a
  change to how the app works. Not for a one-line fix.
---

# New feature

There are no plan or progress files. The feature file and git are the only record.

## Before you start

1. Read `CLAUDE.md`, `docs/decisions.md` and `.claude/rules/*.md`.
2. Read the feature files in `docs/features/` that the change touches.
3. Make a branch: `feat/<short-kebab-subject>`. Never work on `main`.

## Steps

### 1. Agree the design

Ask the owner what the feature is for, who uses it and what it must not do. One
question at a time, with `AskUserQuestion`. Present the approach: affected files,
data changes, screens. Wait for approval. A UI change gets a prototype plate first in
`docs/design/prototype/index.html`, and the owner accepts it before any app code.

### 2. Write the feature file

`docs/features/<name>.md`. Keep the house style of the other feature files:

- `# <Feature> — design`, then `**Date:** YYYY-MM-DD`.
- Why, goals and non-goals, owner decisions, screens, data, offline, error cases,
  known limits.
- An `## Acceptance` list. One testable line per behaviour.

Add the row to `docs/README.md` and to "Shipped features" in `CLAUDE.md` when it ships.
A decision that must hold after this feature goes in `docs/decisions.md`.

### 3. Build

| The change needs               | Use                                     |
| ------------------------------ | --------------------------------------- |
| A table, a column, an index    | the `db-migration` skill                |
| A new route                    | the `add-screen` skill                  |
| A coach plan step or image     | the `coach-plan` skill                  |
| Any UI                         | the `design-system` skill, loaded first |
| Tests from the acceptance list | the `test-writer` agent                 |

- Write the tests first for `lib/duration.ts`, `lib/sync/**` and `lib/metrics/**`.
- Every source file gets a test beside it.
- Screens call `lib/db/repository.ts` only.
- No code comments unless the owner asks.

### 4. Review

- A change under `app/` or `components/`: run the `ui-reviewer` agent.
- A change under `lib/sync/**`, the outbox or the repository transaction: run the
  `sync-auditor` agent.
- Fix every finding, or write it under known limits in the feature file.

### 5. Gates

Node from `.nvmrc`: `export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"`.

1. `pnpm check:step`.
2. `pnpm e2e:step tests/e2e/<feature>.spec.ts`.
3. Check every changed screen at 390, 768 and 1440 px.
4. Run the full `pnpm verify` before the merge to `main`.

### 6. Website and README

Run the `update-website` skill. A feature with nothing to show puts
`Site-update: none` in its commit body.

### 7. Hand over

Stage the change. Run the `commit-report` skill. Give the owner the commit command and
stop. Never commit, push or merge unless the owner says so in that turn.

## Done when

- `docs/features/<name>.md` exists and its acceptance list is all tested.
- The gates pass and the report exists for the staged diff.
- `site/` and `README.md` show the feature, or the commit carries `Site-update: none`.
