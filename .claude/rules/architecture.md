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

### The owner column

The sync worker invents no row id, but it does fill the owner column. `lib/db/` stays
free of auth.

- The repository writes a `profiles` row under the sentinel `LOCAL_PROFILE_ID`. It
  never reads the session.
- On push, `lib/sync/worker.ts` fills `daily_entries.user_id` from the session, and
  swaps the sentinel for the session id in `profiles.id`.
- On pull, the worker maps the server profile id back to `LOCAL_PROFILE_ID`, and drops
  `user_id` before the row reaches Dexie.

### The two writes that carry no outbox entry

`lib/sync/worker.ts` is the one place allowed to write an entity table without an
outbox entry. It happens twice, and never with user content.

- **The server stamp.** After a confirmed push the worker copies the server
  `updated_at` onto the local row, so both sides hold one clock. It writes only when
  the local row still carries the timestamp that was pushed. An outbox entry here
  would loop forever.
- **The server id.** On a duplicate date the worker moves the local row onto the id
  the server already holds, inside one transaction with the outbox, and re-keys every
  queued write for that row. The row with the higher `updated_at` keeps its content.

Two known limits of that second rule:

- The comparison puts a device clock against a server clock. The queued write has
  never reached the server, so nothing can stamp it first. A badly skewed device can
  therefore lose the newer write.
- The comparison covers the one entry being pushed. A later queued write for the same
  row keeps its own content and lands on the next turn, as any later write does.

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
