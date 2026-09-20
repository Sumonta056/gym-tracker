# Architecture rules

Four rules carry the offline-first design. Break one and an offline write is lost or
duplicated.

## 1. The repository rule

No screen calls Supabase. Every screen calls `lib/db/repository.ts`. The repository
writes to Dexie and returns at once. `lib/sync/worker.ts` is the only code that talks
to Supabase. ESLint enforces this.

- Allowed: `app/**` and `components/**` import `lib/db/repository.ts`.
- Forbidden: `app/**` or `components/**` import `@supabase/*` or `lib/sync/**`.

## 2. The UUID rule

The client generates every `id` as a UUID, before the write. An offline write keeps
its identity when it syncs, so a retry never creates a duplicate row.

- Never let the database assign an id.
- Never generate an id inside the sync worker.
- A write and its outbox entry share one transaction. Never one without the other.

## 3. The soft delete rule

Set `deleted_at`. A hard delete does not sync, so it comes back on the next pull.

- Every read filters `deleted_at == null`.
- Every table has a Row Level Security policy of `user_id = auth.uid()`.

## 4. The seconds rule

Durations are integer seconds in storage. `lib/duration.ts` owns every parse and every
format. No component parses `mm:ss` by hand.

Weight is metric in storage. The imperial toggle is display only.

## Shapes

One zod schema per entity in `lib/schema/`. The form, the outbox and the CSV importer
all import it. Never re-declare a shape.
