# Architecture rules

Four rules carry the offline-first design. Break one and an offline write is lost or
duplicated.

## 1. The repository rule

No screen calls Supabase. Every screen calls `lib/db/repository.ts`. The repository
writes to Dexie and returns at once. `lib/sync/worker.ts` is the only code that talks
to Supabase. ESLint enforces this.

- Allowed: `app/**` and `components/**` import `lib/db/repository.ts`.
- Forbidden: `app/**` or `components/**` import `@supabase/*` or `lib/sync/**`.
- Exception: `lib/auth/**` may call Supabase auth, in the browser or a server action:
  password sign-in, the magic link, session read and sign out. Nothing else. ESLint
  already exempts it.

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

## The sign-out

Sign-out drains, clears the device under `DRAIN_LOCK`, then ends the session while it
still holds the lock.

- **The lock wait has a limit.** `clearAll` waits at most `LOCK_TIMEOUT_MS`, 5 s, for
  `DRAIN_LOCK`. If another tab still holds it, nothing is cleared, the user stays
  signed in, and the sheet says so. A normal drain still waits with no limit.
- **The refusal count survives a turn.** The run of dead-letter moves in a row lives
  in `syncMeta` under `dead_letter_streak`. Once it reaches 3, a permanent error backs
  off like a transient one, and the entry moves only at the 20-attempt ceiling. A
  success sets the count to 0. Sign-out clears it. Nothing else lowers it, so a retried
  dead letter that is refused again backs off too. The sign-out drain then stops at the
  first refused write, and the confirm sheet counts every write behind it.
- **A signed-out device takes no save.** The clear writes `signed_out` into `syncMeta`
  in the same transaction. Every repository write checks it inside its own transaction
  and refuses with `SignedOutOnThisDevice`. A drain that reads a signed-in user lifts
  it. `resumeSync` lifts it only in the tab whose own clear wrote it, after a failed
  sign-out. A cancel, an unmount or a busy lock in another tab never lifts it.
- **The clear keeps the outbox sequence.** It writes the last issued sequence back, so
  a write made after a failed sign-out always carries a higher sequence than any
  confirm count taken before the clear.
- **The marker ends with the sign-out.** `clearAll` lifts the 15 s marker once the
  session has ended, still inside the lock. The 15 s limit only covers a tab that
  closes halfway through a sign-out.

Two known limits:

- **A save right after a new sign-in can be refused.** `signed_out` stays until the
  first drain after the new sign-in reads the user. If the device goes offline before
  that drain runs, saves are refused until it comes back online.
- **Kept on purpose: no Web Locks and no `localStorage`.** In a browser with neither,
  for example Safari before 15.4 in a private window, another tab can drain during a
  sign-out and fill the device again, or lift `signed_out` early. Closing this needs a
  guard in IndexedDB that knows which session is signing out. That guard would compare
  a device clock or a session id against the server, and a wrong answer leaves the
  device stuck with no sync and no save. That risk is worse than the case it closes.
  This app has one user on a current iPhone and a current laptop browser.

## Shapes

One zod schema per entity in `lib/schema/`. The form, the outbox and the CSV importer
all import it. Never re-declare a shape.
