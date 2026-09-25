---
name: db-migration
description: Write a paired Supabase SQL migration and Dexie version bump together for the Gym
  Tracker. Use when adding or changing a table, a column, an index or a constraint,
  when asked to "add a field", "change the schema", "write a migration", or when a new
  entity is introduced.
---

# Database migration

The local store and the remote store must never drift. A migration is always a pair.
One without the other is a bug, not a step.

## Before you start

Read `.claude/rules/architecture.md`. Confirm with the user which entity changes and
whether existing rows need a backfill.

## The pair

### 1. The Supabase migration

`supabase/migrations/<YYYYMMDDHHMMSS>_<slug>.sql`.

- Forward only. Never edit a migration that has already run.
- Every new table carries `id uuid primary key`, `user_id uuid not null`,
  `created_at`, `updated_at` and `deleted_at timestamptz`.
- Every new table enables Row Level Security and gets a policy of
  `user_id = auth.uid()` for select, insert, update and delete.
- A new column on an existing table is nullable, or has a default. Never a bare
  `not null` on a populated table.
- Durations are `integer` seconds. Weight is metric.

### 2. The Dexie version bump

`lib/db/dexie.ts`. It holds `DATABASE_VERSION`, the `STORES` map and the row
interfaces. `lib/db/repository.ts` is the only caller.

- Add a new `.version(n + 1).stores({ ... })`. Never change an existing version block.
- Add an `.upgrade()` when existing rows need a new field filled in.
- Index what a screen filters or sorts by. `deleted_at` is not indexed: the
  repository reads a date range and filters the soft-deleted rows in memory.

### 3. The zod schema

Update the one schema in `lib/schema/<entity>.ts`. The form, the outbox and the CSV
importer all import it. Never re-declare the shape.

### 4. The repository

Update `lib/db/repository.ts` so screens reach the new field. Reads filter
`deleted_at == null`. A write and its outbox entry share one transaction.

### 5. The sync mapping

Update `lib/sync/**` so the field is carried both ways. The client still generates
every `id` as a UUID, so a retry never creates a duplicate row.

## Tests

Write these before the code. `lib/sync/**` has a 95 line and 90 branch floor.

- The Dexie upgrade runs against a database at the previous version.
- A round trip through the outbox preserves the new field.
- A retried push does not create a duplicate row.

## Done when

- The SQL and the Dexie version land in the same change.
- `pnpm verify` passes.
- The migration is stated in the report's "Things to consider" section, because it
  cannot be rolled back silently.
