# Step A3 — The local error log, Dexie v4, Profile card

**Branch:** `fix/a3-error-log`, in worktree `../gym-tracker-a3`, cut from `fix/feedback-fixes` · **Wave:** 3 · **Size:** M · **Depends on:** W0, A2 (and A1 through A2) · **Unlocks:** D1, and the sub-plan A checkpoint · **Skills to load:** `design-system`, `db-migration` · **Agent to use:** `test-writer` for the tests, then `sync-auditor` (the `clearAll` change) and `ui-reviewer` (the Errors card) before the step ends

## Before you start

### 1. The worktree

```bash
cd /Users/cefalo_1/Documents/Projects/gym-tracker
git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-a3 -b fix/a3-error-log fix/feedback-fixes
cd ../gym-tracker-a3
cp ../gym-tracker/.env.local ../gym-tracker/.env.test.local .
export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"
pnpm install
```

If you are already in that worktree on that branch, skip this block. Run every later
command from `../gym-tracker-a3`.

### 2. Dependency checks

Run this from the worktree. Each line prints `ok` or `FAIL` and the step it belongs to.

```bash
check() { if sh -c "$2" >/dev/null 2>&1; then echo "ok   $1"; else echo "FAIL $1: $2"; fi; }
check W0 'test -f scripts/e2e-lock.mjs'
check W0 'grep -q verify:parallel package.json'
check A1 'grep -q "export function reportError" lib/errors/report.ts'
check A1 'grep -q "export function safeQuery" lib/db/safeQuery.ts'
check A1 'grep -q "export async function copyText" lib/errors/browser.ts'
check A2 'grep -q "export function subscribeVersionState" lib/db/dexie.ts'
check A2 'grep -q "export function installChunkReload" lib/errors/chunk.ts'
check A2 'grep -q "export function AppGuards" components/errors/AppGuards.tsx'
check A2 'grep -q "DATABASE_VERSION = 3" lib/db/dexie.ts'
```

If any check fails, the step it names is not merged into `fix/feedback-fixes`. Stop. Report which check
failed. Do not do that step's work here.

### 3. Already done check

```bash
git cat-file -e HEAD:lib/schema/errorRecord.ts 2>/dev/null && echo "A3 is already done"
```

If it prints that the step is already done, stop and report.

### 4. Every e2e run goes through the lock

Other steps run at the same time in other worktrees. They share port 3100 and the test
account. Start every Playwright run with `node scripts/e2e-lock.mjs`, for example
`node scripts/e2e-lock.mjs pnpm exec playwright test tests/e2e/<file>.spec.ts`. The lock
waits while another worktree runs its e2e suite.

## Names this step uses from earlier steps

A1 and A2 made these. The dependency checks prove they are on `fix/feedback-fixes`.

```ts
// lib/errors/report.ts (A1). This step changes reportError so it also records.
export type ErrorSource = 'boundary' | 'window' | 'rejection' | 'live-query' | 'sync'
export function describeError(error: unknown): { message: string; stack: string | null }
export function currentRoute(): string
export function reportError(error: unknown, context: { route: string; source: ErrorSource }): void

// lib/errors/browser.ts (A1)
export async function copyText(text: string): Promise<void>

// lib/db/safeQuery.ts (A1)
export function safeQuery<T>(query: () => Promise<T>, source: string): () => Promise<T | null>

// lib/db/dexie.ts (A2). DATABASE_VERSION is 3 before this step.
export const DATABASE_VERSION = 3
export const STORES_V1 = { ... }
export const STORES_V2 = { ...STORES_V1, ... }
export const STORES = { ...STORES_V2, ... }
export function createDatabase(name?: string, watch?: VersionWatch): GymDatabase

// components/errors/AppGuards.tsx (A2), before this step
export function AppGuards({ reload = reloadPage }: { reload?: () => void }) {
  useEffect(() => installChunkReload(window, sessionStore, reload), [reload])
  return <VersionBanner reload={reload} />
}
```

A2 also shows the banner "A new version is ready." when another tab opens a newer
database version. This step relies on it for the Dexie bump.

This step fixes these names for later steps:

```ts
// lib/schema/errorRecord.ts
export const MAX_ERROR_RECORDS = 50
export const MAX_STACK_LENGTH = 2000
export const MAX_MESSAGE_LENGTH = 500
export type ErrorRecord = {
  id: string
  at: string
  source: ErrorSource
  message: string
  stack: string | null
  route: string
}
export const errorRecordSchema: z.ZodType<ErrorRecord>

// lib/db/repository.ts
export async function recordError(input: Omit<ErrorRecord, 'id' | 'at'>): Promise<void>
export async function listErrors(): Promise<ErrorRecord[]>
export async function clearErrors(): Promise<void>
```

Dexie version 4 adds `errorLog: '&id, at'` and renames the version 3 map to `STORES_V3`.
D1 later renames the version 4 map to `STORES_V4`.

## Context to read first

1. `.claude/skills/design-system/` — load it first. This step adds a card to `/profile`.
2. `.claude/skills/db-migration/SKILL.md`, the Dexie half only. `errorLog` is local only,
   so this step has no Supabase migration and no sync mapping. The spec says so in
   section 3.1.
3. `docs/specs/2026-10-05-feedback-fixes-design.md`, sections 3.1 (the `errorLog` line)
   and 3.5.
4. "Names this step uses from earlier steps", above.
5. `lib/db/dexie.ts:76-142` — `GymDatabase`, `DATABASE_VERSION = 3`, `STORES_V1`,
   `STORES_V2`, `STORES` and `createDatabase` as A2 left it.
6. `lib/db/repository.ts:961-1025` — `clearAll`.
7. `lib/errors/report.ts` from A1, and `components/errors/AppGuards.tsx` from A2.
8. `components/profile/ProfileView.tsx` and `components/profile/ManageExercisesSheet.tsx:24-36`
   — the `source` prop pattern this card copies.

## State before the step

- `reportError` writes to the console only. Nothing survives a reload.
- No `window` `error` or `unhandledrejection` listener records anything.
- Dexie is at version 3 with 8 tables.
- Profile has no Errors card.

## Goal

Every reported error lands in a local `errorLog` table that keeps the last 50 rows.
Profile lists them, with a Copy all button and a Clear button. Sign-out clears the log.

## Do

### 1. Write the failing tests first

Run the `test-writer` agent with the acceptance list below. Run `pnpm test` and see the
tests fail before you write any code.

`lib/schema/errorRecord.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { errorRecordSchema, MAX_MESSAGE_LENGTH, MAX_STACK_LENGTH } from './errorRecord'

const RECORD = {
  id: '11111111-1111-4111-8111-111111111111',
  at: '2026-10-05T10:00:00.000Z',
  source: 'boundary',
  message: 'boom',
  stack: 'Error: boom\n    at render',
  route: '/log',
}

describe('errorRecordSchema', () => {
  it('accepts a full record', () => {
    expect(errorRecordSchema.parse(RECORD)).toEqual(RECORD)
  })

  it('accepts a record with no stack', () => {
    expect(errorRecordSchema.parse({ ...RECORD, stack: null }).stack).toBeNull()
  })

  it('refuses an unknown source', () => {
    expect(errorRecordSchema.safeParse({ ...RECORD, source: 'server' }).success).toBe(false)
  })

  it('refuses a stack longer than the limit', () => {
    const stack = 'x'.repeat(MAX_STACK_LENGTH + 1)

    expect(errorRecordSchema.safeParse({ ...RECORD, stack }).success).toBe(false)
  })

  it('refuses a message longer than the limit', () => {
    const message = 'x'.repeat(MAX_MESSAGE_LENGTH + 1)

    expect(errorRecordSchema.safeParse({ ...RECORD, message }).success).toBe(false)
  })
})
```

`lib/db/dexie.test.ts`. Rename the case "declares the eight tables of version 3" and change
its body:

```ts
it('declares the nine tables of version 4', async () => {
  const instance = createDatabase('gym-tracker-tables')
  opened.push(instance)
  await instance.open()

  expect(instance.tables.map((table) => table.name).sort()).toEqual([
    'dailyEntries',
    'deadLetters',
    'errorLog',
    'exercises',
    'outbox',
    'profiles',
    'syncMeta',
    'workoutSessions',
    'workoutSets',
  ])
  expect(instance.verno).toBe(4)
  expect(DATABASE_VERSION).toBe(4)
})
```

In "upgrades a version 2 database and keeps every row it held", change
`expect(instance.verno).toBe(3)` to `expect(instance.verno).toBe(DATABASE_VERSION)`.
Import `STORES_V3` and add:

```ts
it('upgrades a version 3 database, keeps every row and starts an empty error log', async () => {
  const name = 'gym-tracker-upgrade-v3'
  const old = new Dexie(name)
  old.version(1).stores(STORES_V1)
  old.version(3).stores(STORES_V3)
  await old.open()
  await old.table('syncMeta').put({ key: 'outbox_sequence', value: '9' })
  old.close()

  const instance = createDatabase(name)
  opened.push(instance)
  await instance.open()

  expect(instance.verno).toBe(4)
  expect(await instance.syncMeta.get('outbox_sequence')).toEqual({
    key: 'outbox_sequence',
    value: '9',
  })
  expect(await instance.errorLog.count()).toBe(0)
})

it('indexes the error log on at', async () => {
  const instance = createDatabase('gym-tracker-error-indexes')
  opened.push(instance)
  await instance.open()

  const indexes = instance.tables
    .filter((table) => table.name === 'errorLog')
    .flatMap((table) => table.schema.indexes.map((index) => index.name))

  expect(indexes).toEqual(['at'])
})
```

`lib/db/repository.test.ts`. Add `db.errorLog.clear()` to the `Promise.all` in the top
`beforeEach` (line 145). Import `clearErrors`, `listErrors` and `recordError` from
`./repository`, and `MAX_ERROR_RECORDS`, `MAX_MESSAGE_LENGTH` and `MAX_STACK_LENGTH` from
`../schema/errorRecord`. Add:

```ts
describe('the error log', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function failure(message = 'boom') {
    return {
      source: 'boundary' as const,
      message,
      stack: 'Error: boom\n    at render',
      route: '/log',
    }
  }

  it('records an error with a new id and the time it happened', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-05T10:00:00.000Z'))

    await recordError(failure())

    const [row] = await listErrors()
    expect(row).toMatchObject({ ...failure(), at: '2026-10-05T10:00:00.000Z' })
    expect(row?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('writes no outbox entry for an error', async () => {
    await recordError(failure())

    expect(await db.outbox.count()).toBe(0)
  })

  it('lists the newest error first', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-05T10:00:00.000Z'))
    await recordError(failure('first'))
    vi.setSystemTime(new Date('2026-10-05T10:00:01.000Z'))
    await recordError(failure('second'))

    expect((await listErrors()).map((row) => row.message)).toEqual(['second', 'first'])
  })

  it('keeps only the last 50 errors', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })

    for (let index = 0; index <= MAX_ERROR_RECORDS; index += 1) {
      vi.setSystemTime(Date.UTC(2026, 9, 5, 10, 0, index))
      await recordError(failure(`error ${String(index)}`))
    }

    const rows = await listErrors()
    expect(rows).toHaveLength(MAX_ERROR_RECORDS)
    expect(rows[0]?.message).toBe(`error ${String(MAX_ERROR_RECORDS)}`)
    expect(rows.at(-1)?.message).toBe('error 1')
  })

  it('cuts a long stack at the stack limit', async () => {
    await recordError({ ...failure(), stack: 'x'.repeat(MAX_STACK_LENGTH + 500) })

    const [row] = await listErrors()
    expect(row?.stack).toHaveLength(MAX_STACK_LENGTH)
  })

  it('cuts a long message at the message limit', async () => {
    await recordError(failure('x'.repeat(MAX_MESSAGE_LENGTH + 500)))

    const [row] = await listErrors()
    expect(row?.message).toHaveLength(MAX_MESSAGE_LENGTH)
  })

  it('records an error while the device is signed out', async () => {
    await db.syncMeta.put({ key: SIGNED_OUT_KEY, value: '2026-10-05T10:00:00.000Z' })

    await recordError(failure())

    expect(await listErrors()).toHaveLength(1)
  })

  it('clears every error', async () => {
    await recordError(failure('first'))
    await recordError(failure('second'))

    await clearErrors()

    expect(await listErrors()).toEqual([])
  })
})
```

In `describe('clearAll')`, add:

```ts
it('clears the error log at sign-out', async () => {
  await recordError({ source: 'sync', message: 'boom', stack: null, route: '/' })

  await clearAll(await counted(), endSession)

  expect(await db.errorLog.count()).toBe(0)
})
```

`lib/errors/report.test.ts`. Mock the repository at the top:

```ts
vi.mock('../db/repository', () => ({
  recordError: vi.fn(() => Promise.resolve()),
}))
```

Import `recordError` from `'../db/repository'`. Add to `describe('reportError')`:

```ts
it('records the error in the local log', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const error = new Error('boom')

  reportError(error, { route: '/log', source: 'boundary' })

  expect(recordError).toHaveBeenCalledWith({
    source: 'boundary',
    message: 'boom',
    stack: error.stack ?? null,
    route: '/log',
  })
})

it('never throws when the log cannot be written', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.mocked(recordError).mockRejectedValueOnce(new Error('DatabaseClosedError'))

  expect(() => {
    reportError(new Error('boom'), { route: '/', source: 'window' })
  }).not.toThrow()
  await Promise.resolve()
})

it('never throws when the console throws', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {
    throw new Error('console gone')
  })

  expect(() => {
    reportError(new Error('boom'), { route: '/', source: 'window' })
  }).not.toThrow()
})
```

Vitest fails a run on an unhandled rejection, so the second case also proves the rejection
is caught.

`lib/errors/listeners.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from './report'
import { installErrorListeners } from './listeners'

import type * as Report from './report'

vi.mock('./report', async (importOriginal) => ({
  ...(await importOriginal<typeof Report>()),
  reportError: vi.fn(),
  currentRoute: () => '/log',
}))

function errorEvent(fields: { error?: unknown; message?: string }): Event {
  return Object.assign(new Event('error'), { error: null, message: '', ...fields })
}

function rejection(reason: unknown): Event {
  return Object.assign(new Event('unhandledrejection'), { reason })
}

beforeEach(() => {
  vi.mocked(reportError).mockClear()
})

describe('installErrorListeners', () => {
  it('reports a window error with the window source', () => {
    const target = new EventTarget()
    const error = new Error('boom')
    installErrorListeners(target)

    target.dispatchEvent(errorEvent({ error }))

    expect(reportError).toHaveBeenCalledWith(error, { route: '/log', source: 'window' })
  })

  it('reports the message when the error event carries no error', () => {
    const target = new EventTarget()
    installErrorListeners(target)

    target.dispatchEvent(errorEvent({ message: 'Script error.' }))

    expect(reportError).toHaveBeenCalledWith('Script error.', { route: '/log', source: 'window' })
  })

  it('reports an unhandled rejection with the rejection source', () => {
    const target = new EventTarget()
    const reason = new Error('lost')
    installErrorListeners(target)

    target.dispatchEvent(rejection(reason))

    expect(reportError).toHaveBeenCalledWith(reason, { route: '/log', source: 'rejection' })
  })

  it('stops listening after the teardown', () => {
    const target = new EventTarget()
    const stop = installErrorListeners(target)

    stop()
    target.dispatchEvent(rejection(new Error('lost')))

    expect(reportError).not.toHaveBeenCalled()
  })
})
```

`components/errors/AppGuards.test.tsx`. Mock the report module next to the repository mock:

```tsx
vi.mock('../../lib/errors/report', async (importOriginal) => ({
  ...(await importOriginal<typeof Report>()),
  reportError: vi.fn(),
}))
```

Import `reportError` from `'../../lib/errors/report'` and `type * as Report` from the same
path. Add `vi.mocked(reportError).mockClear()` to `beforeEach`, then:

```tsx
it('reports an unhandled rejection to the error log', () => {
  const reason = new Error('lost')
  render(<AppGuards reload={vi.fn()} />)

  window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason }))

  expect(reportError).toHaveBeenCalledWith(reason, { route: '/', source: 'rejection' })
})

it('stops reporting after it unmounts', () => {
  const { unmount } = render(<AppGuards reload={vi.fn()} />)

  unmount()
  window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: 'lost' }))

  expect(reportError).not.toHaveBeenCalled()
})
```

`components/profile/ErrorLogCard.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  ErrorLogCard,
  errorLogText,
  LOG_CLEAR_FAILED,
  LOG_COPIED,
  LOG_COPY_FAILED,
  LOG_READ_FAILED,
  NO_ERRORS,
} from './ErrorLogCard'

import type { ErrorLogSource } from './ErrorLogCard'
import type * as Report from '../../lib/errors/report'
import type { ErrorRecord } from '../../lib/schema/errorRecord'

vi.mock('../../lib/errors/report', async (importOriginal) => ({
  ...(await importOriginal<typeof Report>()),
  reportError: vi.fn(),
}))

function record(index: number, overrides: Partial<ErrorRecord> = {}): ErrorRecord {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    at: `2026-10-05T10:00:${String(index).padStart(2, '0')}.000Z`,
    source: 'boundary',
    message: `error ${String(index)}`,
    stack: `Error: error ${String(index)}\n    at render`,
    route: '/log',
    ...overrides,
  }
}

function fakeSource(records: ErrorRecord[] = []) {
  return {
    listErrors: vi.fn<ErrorLogSource['listErrors']>(() => Promise.resolve(records)),
    clearErrors: vi.fn<ErrorLogSource['clearErrors']>(() => Promise.resolve()),
  }
}

describe('errorLogText', () => {
  it('writes the time, the source, the route, the message and the stack of each error', () => {
    expect(errorLogText([record(2), record(1)])).toBe(
      [
        '2026-10-05T10:00:02.000Z boundary /log\nerror 2\nError: error 2\n    at render',
        '2026-10-05T10:00:01.000Z boundary /log\nerror 1\nError: error 1\n    at render',
      ].join('\n\n'),
    )
  })

  it('leaves out a stack that does not exist', () => {
    expect(errorLogText([record(1, { stack: null })])).toBe(
      '2026-10-05T10:00:01.000Z boundary /log\nerror 1',
    )
  })
})

describe('ErrorLogCard', () => {
  it('says there are no errors and disables both buttons on an empty log', async () => {
    render(<ErrorLogCard source={fakeSource()} />)

    expect(await screen.findByText(NO_ERRORS)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy all' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled()
  })

  it('lists every error with its message, source and route', async () => {
    render(<ErrorLogCard source={fakeSource([record(2), record(1, { source: 'sync' })])} />)

    const list = await screen.findByRole('list', { name: '2 errors on this device' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('error 2')
    expect(items[1]).toHaveTextContent('sync')
    expect(items[1]).toHaveTextContent('/log')
  })

  it('lets the keyboard reach the list so a long log can scroll', async () => {
    render(<ErrorLogCard source={fakeSource([record(1)])} />)

    expect(await screen.findByRole('list')).toHaveAttribute('tabindex', '0')
  })

  it('copies every error when Copy all is pressed', async () => {
    const records = [record(2), record(1)]
    const copy = vi.fn(() => Promise.resolve())
    render(<ErrorLogCard source={fakeSource(records)} copy={copy} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Copy all' }))

    expect(copy).toHaveBeenCalledWith(errorLogText(records))
    expect(await screen.findByText(LOG_COPIED)).toBeInTheDocument()
  })

  it('says the copy failed when the clipboard refuses', async () => {
    const copy = vi.fn(() => Promise.reject(new Error('denied')))
    render(<ErrorLogCard source={fakeSource([record(1)])} copy={copy} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Copy all' }))

    expect(await screen.findByText(LOG_COPY_FAILED)).toBeInTheDocument()
  })

  it('clears the log when Clear is pressed', async () => {
    const source = fakeSource([record(1)])
    render(<ErrorLogCard source={source} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Clear' }))

    expect(source.clearErrors).toHaveBeenCalledTimes(1)
  })

  it('says the clear failed when the device refuses', async () => {
    const source = fakeSource([record(1)])
    source.clearErrors.mockRejectedValueOnce(new Error('locked'))
    render(<ErrorLogCard source={source} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Clear' }))

    expect(await screen.findByText(LOG_CLEAR_FAILED)).toBeInTheDocument()
  })

  it('says the log could not be read when the read fails', async () => {
    const source = fakeSource()
    source.listErrors.mockRejectedValue(new Error('DatabaseClosedError'))
    render(<ErrorLogCard source={source} />)

    expect(await screen.findByText(LOG_READ_FAILED)).toBeInTheDocument()
  })
})
```

`components/profile/ProfileView.test.tsx`. Pass `errorLogSource` in `renderView` with a fake
that resolves `[]`, and add:

```tsx
it('shows the Errors card', async () => {
  renderView()
  expect(await screen.findByTestId('error-log-card')).toHaveTextContent('Errors')
})
```

`components/profile/Profile.test.tsx`. Import `recordError` from the repository, then add:

```tsx
it('lists an error recorded on this device in the Errors card', async () => {
  await recordError({ source: 'sync', message: 'drain refused', stack: null, route: '/' })
  render(<Profile />)

  expect(await screen.findByText('drain refused')).toBeInTheDocument()
})
```

`tests/e2e/errors.spec.ts`, add:

```ts
test('the Profile Errors card lists a render error after a crash', async ({ page }) => {
  await page.goto('/crash-test')
  await expect(page.getByRole('heading', { name: 'Something went wrong.' })).toBeVisible()

  await page.goto('/profile')

  const card = page.getByTestId('error-log-card')
  await expect(card).toContainText('A forced render error for the end to end test.')
  await expect(card.getByRole('button', { name: 'Copy all' })).toBeEnabled()
})
```

### 2. The schema

`lib/schema/errorRecord.ts`:

```ts
import { z } from 'zod'

import type { ErrorSource } from '../errors/report'

export const MAX_ERROR_RECORDS = 50

export const MAX_STACK_LENGTH = 2000

export const MAX_MESSAGE_LENGTH = 500

export const ERROR_SOURCES = [
  'boundary',
  'window',
  'rejection',
  'live-query',
  'sync',
] as const satisfies readonly ErrorSource[]

export type ErrorRecord = {
  id: string
  at: string
  source: ErrorSource
  message: string
  stack: string | null
  route: string
}

export const errorRecordSchema: z.ZodType<ErrorRecord> = z.object({
  id: z.uuid(),
  at: z.iso.datetime(),
  source: z.enum(ERROR_SOURCES),
  message: z.string().max(MAX_MESSAGE_LENGTH),
  stack: z.string().max(MAX_STACK_LENGTH).nullable(),
  route: z.string(),
})
```

The import of `ErrorSource` is a type import, so it adds no runtime cycle.

### 3. Dexie version 4

`lib/db/dexie.ts`:

- Import `type { ErrorRecord } from '../schema/errorRecord'`.
- Add `errorLog: EntityTable<ErrorRecord, 'id'>` to `GymDatabase`.
- Set `DATABASE_VERSION = 4`.
- Rename the current `STORES` to `STORES_V3`. Never change its content.
- Add the new `STORES`.
- Declare version 3 from `STORES_V3` in `createDatabase`.

```ts
export const DATABASE_VERSION = 4

export const STORES_V3 = {
  ...STORES_V2,
  exercises: '&id, muscle_group, updated_at',
  workoutSessions: '&id, entry_date, status, updated_at',
  workoutSets: '&id, session_id, updated_at',
} as const

export const STORES = {
  ...STORES_V3,
  errorLog: '&id, at',
} as const
```

```ts
instance.version(1).stores(STORES_V1)
instance.version(2).stores(STORES_V2)
instance.version(3).stores(STORES_V3)
instance.version(DATABASE_VERSION).stores(STORES)
```

Keep the A2 `versionchange`, `blocked` and `ready` handlers as they are. This bump is what
fires them in an old tab.

### 4. The repository

`lib/db/repository.ts`. Import `errorRecordSchema`, `MAX_ERROR_RECORDS`,
`MAX_MESSAGE_LENGTH` and `MAX_STACK_LENGTH` from `'../schema/errorRecord'`, and
`type { ErrorRecord }` from the same path. Add after the session functions:

```ts
export async function recordError(input: Omit<ErrorRecord, 'id' | 'at'>): Promise<void> {
  const record = errorRecordSchema.parse({
    ...input,
    id: newId(),
    at: nowIso(),
    message: input.message.slice(0, MAX_MESSAGE_LENGTH),
    stack: input.stack === null ? null : input.stack.slice(0, MAX_STACK_LENGTH),
  })

  await db.transaction('rw', db.errorLog, async () => {
    await db.errorLog.put(record)

    const extra = (await db.errorLog.count()) - MAX_ERROR_RECORDS

    if (extra > 0) {
      await db.errorLog.bulkDelete(await db.errorLog.orderBy('at').limit(extra).primaryKeys())
    }
  })
}

export async function listErrors(): Promise<ErrorRecord[]> {
  return db.errorLog.orderBy('at').reverse().toArray()
}

export async function clearErrors(): Promise<void> {
  await db.errorLog.clear()
}
```

Why it looks like this:

- No outbox entry. The log is local only and never syncs. It is not a user entity.
- No `refuseWhenSignedOut`. An error after sign-out must still land in the log.
- The insert and the trim share 1 transaction, so 2 tabs cannot leave 51 rows.

`clearAll` (`lib/db/repository.ts:968-1000`). Add `db.errorLog` to the table list of the
transaction, and `db.errorLog.clear()` to the `Promise.all`. Change nothing else in
`clearAll`.

### 5. The report now persists

`lib/errors/report.ts`. Import `recordError` from `'../db/repository'`. Replace
`reportError`:

```ts
export function reportError(error: unknown, context: { route: string; source: ErrorSource }): void {
  try {
    const { message, stack } = describeError(error)

    console.error(`[${context.source}] ${context.route} ${message}`, stack ?? '')
    recordError({ source: context.source, message, stack, route: context.route }).catch(
      () => undefined,
    )
  } catch {
    return
  }
}
```

`report.ts` and `repository.ts` now import each other through `lib/sync/worker.ts` and
`lib/db/safeQuery.ts`. Both sides use the other only inside a function body, never at
module load, so the cycle is safe. Do not add a top-level call across it.

### 6. The window listeners

`lib/errors/listeners.ts`:

```ts
import { currentRoute, reportError } from './report'

type ListenTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>

export function installErrorListeners(target: ListenTarget): () => void {
  const onError = (event: Event): void => {
    const failure: unknown = (event as ErrorEvent).error

    reportError(failure ?? (event as ErrorEvent).message, {
      route: currentRoute(),
      source: 'window',
    })
  }
  const onRejection = (event: Event): void => {
    reportError((event as PromiseRejectionEvent).reason, {
      route: currentRoute(),
      source: 'rejection',
    })
  }

  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onRejection)

  return () => {
    target.removeEventListener('error', onError)
    target.removeEventListener('unhandledrejection', onRejection)
  }
}
```

`components/errors/AppGuards.tsx`. It is the one client mount for every `(app)` route, so
the listeners go here. Add the second effect:

```tsx
export function AppGuards({ reload = reloadPage }: { reload?: () => void }) {
  useEffect(() => installChunkReload(window, sessionStore, reload), [reload])
  useEffect(() => installErrorListeners(window), [])

  return <VersionBanner reload={reload} />
}
```

Import `installErrorListeners` from `'../../lib/errors/listeners'`. The effect returns the
teardown, so React strict mode leaves exactly 1 pair of listeners.

### 7. The Errors card

`components/profile/ErrorLogCard.tsx`:

```tsx
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'

import { clearErrors, listErrors } from '../../lib/db/repository'
import { safeQuery } from '../../lib/db/safeQuery'
import { copyText } from '../../lib/errors/browser'
import { Card } from '../ui/Card'
import { MicroLabel } from '../ui/MicroLabel'
import { SecondaryButton } from '../ui/SecondaryButton'

import type { ErrorRecord } from '../../lib/schema/errorRecord'

export type ErrorLogSource = {
  listErrors: () => Promise<ErrorRecord[]>
  clearErrors: () => Promise<void>
}

export const REPOSITORY_ERROR_LOG_SOURCE: ErrorLogSource = { listErrors, clearErrors }

export const NO_ERRORS = 'No errors on this device.'

export const LOG_READ_FAILED = 'The error list on this device could not be read.'

export const LOG_COPIED = 'The errors are copied.'

export const LOG_COPY_FAILED = 'The errors could not be copied.'

export const LOG_CLEAR_FAILED = 'The errors could not be cleared.'

const TIME = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export function errorLogText(records: ErrorRecord[]): string {
  return records
    .map((record) =>
      [`${record.at} ${record.source} ${record.route}`, record.message, record.stack]
        .filter((line): line is string => line !== null)
        .join('\n'),
    )
    .join('\n\n')
}

type Notice = { text: string; failed: boolean }

export type ErrorLogCardProps = {
  source?: ErrorLogSource
  copy?: (text: string) => Promise<void>
  className?: string
}

export function ErrorLogCard({
  source = REPOSITORY_ERROR_LOG_SOURCE,
  copy = copyText,
  className,
}: ErrorLogCardProps) {
  const records = useLiveQuery(
    safeQuery(() => source.listErrors(), 'error log'),
    [source],
  )
  const [notice, setNotice] = useState<Notice | null>(null)
  const shown = records ?? []

  function copyAll(): void {
    void copy(errorLogText(shown)).then(
      () => {
        setNotice({ text: LOG_COPIED, failed: false })
      },
      () => {
        setNotice({ text: LOG_COPY_FAILED, failed: true })
      },
    )
  }

  function clearLog(): void {
    void source.clearErrors().then(
      () => {
        setNotice(null)
      },
      () => {
        setNotice({ text: LOG_CLEAR_FAILED, failed: true })
      },
    )
  }

  return (
    <Card data-testid="error-log-card" className={className}>
      <MicroLabel as="p">Errors</MicroLabel>
      {records === undefined ? (
        <p className="text-muted mt-2 text-sm">Reading the error list…</p>
      ) : null}
      {records === null ? <p className="text-danger mt-2 text-sm">{LOG_READ_FAILED}</p> : null}
      {records?.length === 0 ? <p className="text-muted mt-2 text-sm">{NO_ERRORS}</p> : null}
      {shown.length > 0 ? (
        <ol
          tabIndex={0}
          aria-label={`${String(shown.length)} errors on this device`}
          className="border-border divide-border rounded-input mt-2 max-h-72 divide-y overflow-y-auto border"
        >
          {shown.map((record) => (
            <li key={record.id} className="px-3 py-2">
              <p className="text-text text-[13px] font-bold break-words">{record.message}</p>
              <p className="text-muted text-xs">
                {TIME.format(new Date(record.at))} · {record.source} · {record.route}
              </p>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <SecondaryButton disabled={shown.length === 0} onClick={copyAll}>
          Copy all
        </SecondaryButton>
        <SecondaryButton tone="danger" disabled={shown.length === 0} onClick={clearLog}>
          Clear
        </SecondaryButton>
      </div>
      <p
        role="status"
        className={notice?.failed === true ? 'text-danger mt-2 text-xs' : 'text-muted mt-2 text-xs'}
      >
        {notice?.text ?? ''}
      </p>
    </Card>
  )
}
```

The list has `tabIndex={0}` because axe flags a scrollable region that the keyboard cannot
reach. B5 later hides its scrollbar. The list stays scrollable.

`components/profile/ProfileView.tsx`:

- Add `errorLogSource?: ErrorLogSource` to `ProfileViewProps`.
- Default it to `REPOSITORY_ERROR_LOG_SOURCE` in the destructure.
- Render `<ErrorLogCard source={errorLogSource} />` right after `<SyncCard … />`.

### 8. The style guide and the prototype

- `app/styleguide/page.tsx` — pass `errorLogSource` to the sample `ProfileView` (line 818)
  with a fake that resolves 2 sample records, so the style guide never reads the device:

  ```tsx
  const SAMPLE_ERROR_LOG: ErrorLogSource = {
    listErrors: () =>
      Promise.resolve([
        {
          id: '00000000-0000-4000-8000-000000000001',
          at: '2026-10-05T07:42:00.000Z',
          source: 'live-query',
          message: 'sync pending count: DatabaseClosedError',
          stack: null,
          route: '/',
        },
        {
          id: '00000000-0000-4000-8000-000000000002',
          at: '2026-10-04T21:10:00.000Z',
          source: 'window',
          message: 'Loading chunk 812 failed.',
          stack: null,
          route: '/analytics',
        },
      ]),
    clearErrors: () => Promise.resolve(),
  }
  ```

- `app/styleguide/page.test.tsx` — 1 `it` that finds the text
  `Loading chunk 812 failed.` inside the test id `error-log-card`.
- `docs/design/prototype/index.html` — in the plate "06 Profile", add this card after the
  Sync card, which closes at line 4973:

  ```html
  <div class="card">
    <span class="micro">Errors</span>
    <ol
      class="list"
      style="margin-top: 8px; border: 1px solid var(--color-border); border-radius: var(--radius-input)"
      aria-label="2 errors on this device"
    >
      <li style="padding: 8px 12px; border-bottom: 1px solid var(--color-border)">
        <strong style="display: block; font-size: 13px"
          >sync pending count: DatabaseClosedError</strong
        >
        <span class="muted" style="font-size: 12px">5 Oct, 07:42 · live-query · /</span>
      </li>
      <li style="padding: 8px 12px">
        <strong style="display: block; font-size: 13px">Loading chunk 812 failed.</strong>
        <span class="muted" style="font-size: 12px">4 Oct, 21:10 · window · /analytics</span>
      </li>
    </ol>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px">
      <button class="btn btn-secondary" type="button">Copy all</button>
      <button class="btn btn-danger" type="button">Clear</button>
    </div>
  </div>
  ```

  `--radius-input` is the 16 px input radius in the prototype `:root` (`index.html:30`).

## Acceptance criteria

- [ ] `errorRecordSchema` accepts a full record.
- [ ] `errorRecordSchema` accepts a record with no stack.
- [ ] `errorRecordSchema` refuses an unknown source.
- [ ] `errorRecordSchema` refuses a stack longer than the limit.
- [ ] `errorRecordSchema` refuses a message longer than the limit.
- [ ] Dexie declares 9 tables at version 4.
- [ ] A version 2 database upgrades to version 4.
- [ ] A version 3 database upgrades, keeps every row and starts an empty error log.
- [ ] The error log is indexed on `at`.
- [ ] `recordError` records an error with a new id and the time it happened.
- [ ] `recordError` writes no outbox entry.
- [ ] `listErrors` lists the newest error first.
- [ ] `recordError` keeps only the last 50 errors.
- [ ] `recordError` cuts a long stack at 2000 characters.
- [ ] `recordError` cuts a long message at 500 characters.
- [ ] `recordError` records an error while the device is signed out.
- [ ] `clearErrors` clears every error.
- [ ] `clearAll` clears the error log at sign-out.
- [ ] `reportError` records the error in the local log.
- [ ] `reportError` never throws when the log cannot be written.
- [ ] `reportError` never throws when the console throws.
- [ ] `installErrorListeners` reports a window error with the `window` source.
- [ ] `installErrorListeners` reports the message when the event carries no error.
- [ ] `installErrorListeners` reports an unhandled rejection with the `rejection` source.
- [ ] `installErrorListeners` stops listening after the teardown.
- [ ] `AppGuards` reports an unhandled rejection to the error log.
- [ ] `AppGuards` stops reporting after it unmounts.
- [ ] `errorLogText` writes the time, the source, the route, the message and the stack.
- [ ] `errorLogText` leaves out a stack that does not exist.
- [ ] `ErrorLogCard` says there are no errors and disables both buttons on an empty log.
- [ ] `ErrorLogCard` lists every error with its message, source and route.
- [ ] `ErrorLogCard` lets the keyboard reach the list.
- [ ] `ErrorLogCard` copies every error when Copy all is pressed.
- [ ] `ErrorLogCard` says the copy failed when the clipboard refuses.
- [ ] `ErrorLogCard` clears the log when Clear is pressed.
- [ ] `ErrorLogCard` says the clear failed when the device refuses.
- [ ] `ErrorLogCard` says the log could not be read when the read fails.
- [ ] `ProfileView` shows the Errors card.
- [ ] `Profile` lists an error recorded on this device.
- [ ] The style guide shows the Errors card with its sample errors.
- [ ] End to end: the Profile Errors card lists a render error after a crash.

### The gate and the dependencies

- [ ] W0, A1 and A2 are merged: every dependency check in "Before you start" prints `ok`.
- [ ] `DATABASE_VERSION` is 4 and `STORES_V3` holds the old version 3 map unchanged. Test: `lib/db/dexie.test.ts` "A version 3 database upgrades, keeps every row…".
- [ ] The `sync-auditor` agent reports no lost write and no duplicate row, and confirms `errorLog` never enters the outbox. Manual check: "Verification", item 1.
- [ ] `/profile` has no sideways scroll at 390, 768 and 1440 px, with 0 errors and with 50 errors. Every button is 44 px or taller. A long message wraps. Manual check: "Verification", item 5.
- [ ] A tab on the version 3 build shows "A new version is ready." when this build opens in a second tab. Manual check: "Verification", item 6.
- [ ] The `ui-reviewer` agent reports no drift on the Errors card. Manual check: "Verification", item 4.
- [ ] The staged diff holds only the files in "Files touched". Manual check: `git diff --cached --stat`.
- [ ] `pnpm verify:parallel` passes. Manual check: "When the step is done", item 1.

## Tests

One `it` per criterion above, in `lib/schema/errorRecord.test.ts`, `lib/db/dexie.test.ts`,
`lib/db/repository.test.ts`, `lib/errors/report.test.ts`, `lib/errors/listeners.test.ts`,
`components/errors/AppGuards.test.tsx`, `components/profile/ErrorLogCard.test.tsx`,
`components/profile/ProfileView.test.tsx`, `components/profile/Profile.test.tsx`,
`app/styleguide/page.test.tsx` and `tests/e2e/errors.spec.ts`.

## Verification

1. The `sync-auditor` agent reviews the `clearAll` change and `recordError`. It must report
   no lost write and no duplicate row, and confirm that `errorLog` never enters the outbox.
2. `pnpm test:cov`. `lib/sync/**` stays at 95 / 90 / 95.
3. `node scripts/e2e-lock.mjs pnpm e2e tests/e2e/errors.spec.ts`, then `node scripts/e2e-lock.mjs pnpm e2e tests/e2e/a11y.spec.ts` for `/profile`.
4. The `ui-reviewer` agent reports no drift on the Errors card.
5. Check `/profile` at 390, 768 and 1440 px with 0 errors and with 50 errors. No sideways
   scroll. Every button is 44 px or taller. A long message wraps.
6. Open the app in a tab on the version 3 build, then load this build in a second tab. The
   first tab shows the A2 banner "A new version is ready."
7. `pnpm verify:parallel`.

## Files touched

- `lib/schema/errorRecord.ts` and its test (new)
- `lib/db/dexie.ts` and its test
- `lib/db/repository.ts` and its test
- `lib/errors/report.ts` and its test
- `lib/errors/listeners.ts` and its test (new)
- `components/errors/AppGuards.tsx` and its test
- `components/profile/ErrorLogCard.tsx` and its test (new)
- `components/profile/ProfileView.tsx` and its test
- `components/profile/Profile.test.tsx`
- `app/styleguide/page.tsx` and its test
- `tests/e2e/errors.spec.ts`
- `docs/design/prototype/index.html`

## Known limits

- 2 errors in the same millisecond share an `at`. The trim then orders them by `id`, so it
  may drop the newer of the 2. The log is for diagnosis, so this is kept.
- A message can hold a value from the failed code. The log holds no entry row, but the
  owner reads a copied log before sharing it.
- An error while the database is closed (A2 `stale`) cannot be written. It still reaches
  the console.

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer when another step runs its e2e suite. Never skip a check, and never add a design-check or test exemption to pass.
2. Stage the files from "Files touched", including the tests. Then run the `commit-report` skill. The skill reports on the staged diff, so stage first:
   ```bash
   git add lib/schema/errorRecord.ts lib/schema/errorRecord.test.ts lib/db/dexie.ts lib/db/dexie.test.ts lib/db/repository.ts lib/db/repository.test.ts lib/errors/report.ts lib/errors/report.test.ts lib/errors/listeners.ts lib/errors/listeners.test.ts components/errors/AppGuards.tsx components/errors/AppGuards.test.tsx components/profile/ErrorLogCard.tsx components/profile/ErrorLogCard.test.tsx components/profile/ProfileView.tsx components/profile/ProfileView.test.tsx components/profile/Profile.test.tsx app/styleguide/page.tsx app/styleguide/page.test.tsx tests/e2e/errors.spec.ts docs/design/prototype/index.html
   ```
   The report needs screenshots of every changed page at 390, 768 and 1440 px, next to the matching prototype plate: `/profile` with the Errors card, with 0 errors and with sample errors, next to the plate "06 Profile". "Things to consider" names the Dexie bump to version 4: an old open tab shows the reload banner, and the bump cannot be rolled back. "Evidence" names the `sync-auditor` result.
3. Commit on `fix/a3-error-log`. This step file tells you to commit, so you commit, not the owner:
   ```bash
   git commit -m "feat(db): add the local error log and the Profile errors card"
   ```
   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.
4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked, and anything the owner must check on the iPhone. For this step: this step closes sub-plan A. Name the "A" lines of `docs/plan/04-feedback-fixes.md` the owner checks on the iPhone: the Reload screen, the version banner, and the Profile Errors card after a crash.
