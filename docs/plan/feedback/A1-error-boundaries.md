# Step A1 — Error boundaries and guarded live queries

**Branch:** `fix/a1-error-boundaries`, in worktree `../gym-tracker-a1`, cut from `fix/feedback-fixes` · **Wave:** 1 · **Size:** M · **Depends on:** W0 · **Unlocks:** A2 · **Skills to load:** `design-system` · **Agent to use:** `test-writer` for the tests, then `ui-reviewer` before the step ends

## Before you start

### 1. The worktree

```bash
cd /Users/cefalo_1/Documents/Projects/gym-tracker
git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-a1 -b fix/a1-error-boundaries fix/feedback-fixes
cd ../gym-tracker-a1
cp ../gym-tracker/.env.local ../gym-tracker/.env.test.local .
export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"
pnpm install
```

If you are already in that worktree on that branch, skip this block. Run every later
command from `../gym-tracker-a1`.

### 2. Dependency checks

Run this from the worktree. Each line prints `ok` or `FAIL` and the step it belongs to.

```bash
check() { if sh -c "$2" >/dev/null 2>&1; then echo "ok   $1"; else echo "FAIL $1: $2"; fi; }
check W0 'test -f scripts/e2e-lock.mjs'
check W0 'grep -q verify:parallel package.json'
```

If any check fails, the step it names is not merged into `fix/feedback-fixes`. Stop. Report which check
failed. Do not do that step's work here.

### 3. Already done check

```bash
git cat-file -e HEAD:lib/db/safeQuery.ts 2>/dev/null && echo "A1 is already done"
```

If it prints that the step is already done, stop and report.

### 4. Every e2e run goes through the lock

Other steps run at the same time in other worktrees. They share port 3100 and the test
account. Start every Playwright run with `node scripts/e2e-lock.mjs`, for example
`node scripts/e2e-lock.mjs pnpm exec playwright test tests/e2e/<file>.spec.ts`. The lock
waits while another worktree runs its e2e suite.

## Names this step fixes for later steps

A2 and A3 import these names. Write them exactly as shown in "Do":

```ts
// lib/errors/report.ts
export type ErrorSource = 'boundary' | 'window' | 'rejection' | 'live-query' | 'sync'
export function describeError(error: unknown): { message: string; stack: string | null }
export function errorText(error: unknown): string
export function currentRoute(): string
export function reportError(error: unknown, context: { route: string; source: ErrorSource }): void

// lib/errors/browser.ts
export function reloadPage(): void
export async function copyText(text: string): Promise<void>

// lib/db/safeQuery.ts
export function safeQuery<T>(query: () => Promise<T>, source: string): () => Promise<T | null>

// components/errors/ErrorScreen.tsx
export type ErrorScreenProps = {
  error: Error & { digest?: string }
  reload?: () => void
  copy?: (text: string) => Promise<void>
}
export function ErrorScreenView(props: ErrorScreenProps): JSX.Element
export function ErrorScreen(props: ErrorScreenProps): JSX.Element

// lib/flags.ts
export function crashTestEnabled(): boolean
```

`SyncStatus` in `lib/sync/useSyncStatus.ts` gains `'unknown'`. `useDeadLetters` falls back
to `[]`.

## Context to read first

1. `.claude/skills/design-system/` — load it first. This step adds a screen and a chip state.
2. `docs/specs/2026-10-05-feedback-fixes-design.md`, section 3.5 "Error safety".
3. "Names this step fixes for later steps", below. A2 and A3 import them. Use them as written.
4. `lib/sync/useSyncStatus.ts:62-69` — the 3 unguarded `useLiveQuery` calls.
5. `components/csv/ImportReview.tsx:447-465` — the unguarded `firstPullDone` query and `hint()`.
6. `components/sync/SyncChip.tsx` and `components/ui/StatusChip.tsx` — the chip states.
7. `lib/flags.ts` and `app/styleguide/page.tsx:597-603` — the flag pattern for a route that must not ship.
8. `tests/e2e/support/signedIn.ts` — the signed-in `test` fixture.

## State before the step

- No `error.tsx` and no `global-error.tsx` exist. A render error leaves a blank page.
- `useSyncStatus` and `useDeadLetters` call `useLiveQuery` with no guard. A Dexie read that
  fails, for example while the PWA wakes from the background, throws during render.
- `ImportReview` reads `source.firstPullDone()` with no guard.
- `lib/errors/` does not exist.

## Goal

A render error on any `(app)` route shows a Reload screen, never a blank page. A failed
Dexie read in a live query returns `null`, and the sync chip shows "Unknown".

## Do

### 1. Write the failing tests first

Run the `test-writer` agent with the acceptance list below. The tests in this section are
the ones it must produce. Run `pnpm test` and see them fail before you write any code.

`lib/errors/report.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

import { currentRoute, describeError, errorText, reportError, UNKNOWN_ERROR } from './report'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('describeError', () => {
  it('keeps the message and the stack of an Error', () => {
    const error = new Error('boom')

    expect(describeError(error)).toEqual({ message: 'boom', stack: error.stack ?? null })
  })

  it('names an Error with an empty message by its name', () => {
    expect(describeError(new TypeError('')).message).toBe('TypeError')
  })

  it('keeps a thrown string as the message', () => {
    expect(describeError('boom')).toEqual({ message: 'boom', stack: null })
  })

  it('writes a thrown object as JSON', () => {
    expect(describeError({ code: 7 }).message).toBe('{"code":7}')
  })

  it('writes undefined as the word undefined', () => {
    expect(describeError(undefined).message).toBe('undefined')
  })

  it('names a value that JSON cannot write', () => {
    const loop: Record<string, unknown> = {}
    loop.self = loop

    expect(describeError(loop).message).toBe(UNKNOWN_ERROR)
  })
})

describe('errorText', () => {
  it('joins the message, the digest and the stack for the clipboard', () => {
    const error = Object.assign(new Error('boom'), { digest: 'abc123' })
    error.stack = 'Error: boom\n    at render'

    expect(errorText(error)).toBe('boom\nDigest: abc123\nError: boom\n    at render')
  })

  it('leaves out a digest and a stack that do not exist', () => {
    expect(errorText('boom')).toBe('boom')
  })
})

describe('currentRoute', () => {
  it('is empty outside a browser', () => {
    expect(currentRoute()).toBe('')
  })

  it('reads the path of the open page', () => {
    vi.stubGlobal('window', { location: { pathname: '/log' } })

    expect(currentRoute()).toBe('/log')
  })
})

describe('reportError', () => {
  it('writes the source, the route and the message to the console', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    reportError(new Error('boom'), { route: '/log', source: 'boundary' })

    expect(spy).toHaveBeenCalledWith('[boundary] /log boom', expect.any(String))
  })
})
```

`lib/errors/browser.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

import { copyText, reloadPage } from './browser'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('reloadPage', () => {
  it('reloads the open page', () => {
    const reload = vi.fn()
    vi.stubGlobal('window', { location: { reload } })

    reloadPage()

    expect(reload).toHaveBeenCalledTimes(1)
  })
})

describe('copyText', () => {
  it('writes the text to the clipboard', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await copyText('boom')

    expect(writeText).toHaveBeenCalledWith('boom')
  })

  it('rejects when the browser has no clipboard', async () => {
    vi.stubGlobal('navigator', {})

    await expect(copyText('boom')).rejects.toThrow()
  })
})
```

`lib/db/safeQuery.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '../errors/report'

import { safeQuery } from './safeQuery'

import type * as Report from '../errors/report'

vi.mock('../errors/report', async (importOriginal) => ({
  ...(await importOriginal<typeof Report>()),
  reportError: vi.fn(),
  currentRoute: () => '/log',
}))

beforeEach(() => {
  vi.mocked(reportError).mockClear()
})

describe('safeQuery', () => {
  it('returns the value of a query that succeeds', async () => {
    await expect(safeQuery(() => Promise.resolve(3), 'count')()).resolves.toBe(3)
  })

  it('reports nothing when the query succeeds', async () => {
    await safeQuery(() => Promise.resolve(3), 'count')()

    expect(reportError).not.toHaveBeenCalled()
  })

  it('returns null when the query rejects', async () => {
    await expect(
      safeQuery(() => Promise.reject(new Error('closed')), 'count')(),
    ).resolves.toBeNull()
  })

  it('returns null when the query throws before it returns a promise', async () => {
    await expect(
      safeQuery(() => {
        throw new Error('closed')
      }, 'count')(),
    ).resolves.toBeNull()
  })

  it('reports the failure as a live-query error with the query name in the message', async () => {
    await safeQuery(() => Promise.reject(new Error('closed')), 'sync pending count')()

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'sync pending count: closed' }),
      { route: '/log', source: 'live-query' },
    )
  })
})
```

`lib/sync/useSyncStatus.test.ts`. Add `reportError` to the hoisted `mocks`, mock
`../errors/report`, and add an `afterEach` that calls `vi.restoreAllMocks()`:

```ts
const mocks = vi.hoisted(() => ({
  getSyncState: vi.fn(),
  subscribeSyncState: vi.fn(),
  reportError: vi.fn(),
}))

vi.mock('../errors/report', async (importOriginal) => ({
  ...(await importOriginal<typeof Report>()),
  reportError: mocks.reportError,
}))
```

Add `import type * as Report from '../errors/report'` with the other type imports, and
`afterEach` to the `vitest` import. Then add these cases:

```ts
describe('useSyncStatus when a read fails', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports unknown when the outbox count cannot be read', async () => {
    vi.spyOn(db.outbox, 'count').mockRejectedValue(new Error('DatabaseClosedError'))
    const { result } = renderHook(() => useSyncStatus())

    await waitFor(() => {
      expect(result.current.status).toBe('unknown')
    })
    expect(result.current.pending).toBe(0)
  })

  it('reports unknown when the failed write count cannot be read', async () => {
    vi.spyOn(db.deadLetters, 'count').mockRejectedValue(new Error('DatabaseClosedError'))
    const { result } = renderHook(() => useSyncStatus())

    await waitFor(() => {
      expect(result.current.status).toBe('unknown')
    })
    expect(result.current.failed).toBe(0)
  })

  it('reports the failed read as a live-query error', async () => {
    vi.spyOn(db.outbox, 'count').mockRejectedValue(new Error('DatabaseClosedError'))
    renderHook(() => useSyncStatus())

    await waitFor(() => {
      expect(mocks.reportError).toHaveBeenCalledWith(expect.any(Error), {
        route: '/',
        source: 'live-query',
      })
    })
  })

  it('lists no failed writes when the list cannot be read', async () => {
    vi.spyOn(db.deadLetters, 'orderBy').mockImplementation(() => {
      throw new Error('DatabaseClosedError')
    })
    const { result } = renderHook(() => useDeadLetters())

    await waitFor(() => {
      expect(mocks.reportError).toHaveBeenCalled()
    })
    expect(result.current).toEqual([])
  })
})
```

`listDeadLetters` calls `db.deadLetters.orderBy('sequence')` (`lib/sync/deadLetters.ts:69`),
so the last case spies on `orderBy`. jsdom's `location.pathname` is `/`.

`components/ui/StatusChip.test.tsx`, add:

```tsx
it('names the unknown state in words', () => {
  render(<StatusChip status="unknown" />)
  expect(screen.getByRole('status')).toHaveTextContent('Unknown')
})
```

`components/sync/SyncChip.test.tsx`, add:

```tsx
it('reports unknown when the counts could not be read', () => {
  expect(chipStatus({ status: 'unknown', pending: 0, failed: 0 })).toBe('unknown')
})
```

and in `describe('SyncChip')`:

```tsx
it('shows unknown when the repository cannot read the counts', () => {
  vi.mocked(useSyncStatus).mockReturnValue({ status: 'unknown', pending: 0, failed: 0 })
  render(<SyncChip />)
  expect(screen.getByRole('status')).toHaveTextContent('Unknown')
})
```

`components/csv/ImportReview.test.tsx`, next to "keeps Apply disabled with a reason when
the device cannot be read":

```tsx
it('keeps Apply disabled with a reason when the first sync state cannot be read', async () => {
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  renderReview([HEADER, 'August 12,20,,,,,,'].join('\n'), {
    source: {
      firstPullDone: () => Promise.reject(new Error('closed')),
      loggedDates: () => Promise.resolve(new Set<string>()),
      importDays: vi.fn(),
    },
  })

  await waitFor(() => {
    expect(applyButton()).toHaveAccessibleDescription(LOGGED_READ_FAILED)
  })
  expect(applyButton()).toBeDisabled()
  quiet.mockRestore()
})
```

`components/errors/ErrorScreen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '../../lib/errors/report'

import {
  COPIED,
  COPY_FAILED,
  ERROR_BODY,
  ERROR_TITLE,
  ErrorScreen,
  ErrorScreenView,
} from './ErrorScreen'

import type * as Report from '../../lib/errors/report'

vi.mock('../../lib/errors/report', async (importOriginal) => ({
  ...(await importOriginal<typeof Report>()),
  reportError: vi.fn(),
}))

function boom(): Error {
  const error = new Error('boom')
  error.stack = 'Error: boom\n    at render'
  return error
}

beforeEach(() => {
  vi.mocked(reportError).mockClear()
})

describe('ErrorScreenView', () => {
  it('shows the title and says the data is safe', () => {
    render(<ErrorScreenView error={boom()} />)

    expect(screen.getByRole('heading', { name: ERROR_TITLE })).toBeInTheDocument()
    expect(screen.getByText(ERROR_BODY)).toBeInTheDocument()
  })

  it('reloads the page when Reload is pressed', async () => {
    const reload = vi.fn()
    render(<ErrorScreenView error={boom()} reload={reload} />)

    await userEvent.click(screen.getByRole('button', { name: 'Reload' }))

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('copies the message and the stack when Copy error is pressed', async () => {
    const copy = vi.fn(() => Promise.resolve())
    render(<ErrorScreenView error={boom()} copy={copy} />)

    await userEvent.click(screen.getByRole('button', { name: 'Copy error' }))

    expect(copy).toHaveBeenCalledWith('boom\nError: boom\n    at render')
  })

  it('says the error is copied', async () => {
    render(<ErrorScreenView error={boom()} copy={() => Promise.resolve()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Copy error' }))

    expect(await screen.findByText(COPIED)).toBeInTheDocument()
  })

  it('says the copy failed when the clipboard refuses', async () => {
    render(<ErrorScreenView error={boom()} copy={() => Promise.reject(new Error('denied'))} />)

    await userEvent.click(screen.getByRole('button', { name: 'Copy error' }))

    expect(await screen.findByText(COPY_FAILED)).toBeInTheDocument()
  })

  it('reports nothing by itself', () => {
    render(<ErrorScreenView error={boom()} />)

    expect(reportError).not.toHaveBeenCalled()
  })
})

describe('ErrorScreen', () => {
  it('reports the error once with the boundary source', () => {
    const error = boom()
    render(<ErrorScreen error={error} />)

    expect(reportError).toHaveBeenCalledTimes(1)
    expect(reportError).toHaveBeenCalledWith(error, { route: '/', source: 'boundary' })
  })
})
```

`components/errors/ForcedCrash.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { Component } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { FORCED_CRASH_MESSAGE, ForcedCrash } from './ForcedCrash'

import type { ReactNode } from 'react'

class Catch extends Component<{ children: ReactNode }, { message: string | null }> {
  override state: { message: string | null } = { message: null }

  static getDerivedStateFromError(error: Error) {
    return { message: error.message }
  }

  override render() {
    return this.state.message === null ? this.props.children : <p>{this.state.message}</p>
  }
}

describe('ForcedCrash', () => {
  it('throws a render error once it is mounted in the browser', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <Catch>
        <ForcedCrash />
      </Catch>,
    )

    expect(await screen.findByText(FORCED_CRASH_MESSAGE)).toBeInTheDocument()
    quiet.mockRestore()
  })
})
```

`app/(app)/crash-test/page.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ForcedCrash } from '../../../components/errors/ForcedCrash'

import CrashTestPage from './page'

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('the crash test route', () => {
  it('is not found when the flag is absent', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_CRASH_TEST', '')

    expect(() => CrashTestPage()).toThrow('NEXT_NOT_FOUND')
  })

  it('renders the forced crash when the flag is on', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_CRASH_TEST', '1')

    expect(CrashTestPage()).toEqual(<ForcedCrash />)
  })
})
```

`app/(app)/error.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ERROR_TITLE } from '../../components/errors/ErrorScreen'
import { reportError } from '../../lib/errors/report'

import AppError from './error'

import type * as Report from '../../lib/errors/report'

vi.mock('../../lib/errors/report', async (importOriginal) => ({
  ...(await importOriginal<typeof Report>()),
  reportError: vi.fn(),
}))

describe('AppError', () => {
  it('shows the Reload screen for a render error in the app', () => {
    render(<AppError error={new Error('boom')} reset={vi.fn()} />)

    expect(screen.getByRole('heading', { name: ERROR_TITLE })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })

  it('reports the error from the boundary', () => {
    const error = new Error('boom')
    render(<AppError error={error} reset={vi.fn()} />)

    expect(reportError).toHaveBeenCalledWith(error, { route: '/', source: 'boundary' })
  })
})
```

`app/global-error.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ERROR_BODY, ERROR_TITLE } from '../components/errors/ErrorScreen'

import GlobalError from './global-error'

describe('GlobalError', () => {
  it('renders its own html and body around the error screen', () => {
    const markup = renderToStaticMarkup(<GlobalError error={new Error('boom')} reset={vi.fn()} />)

    expect(markup).toMatch(/^<html lang="en"><body/)
    expect(markup).toContain(ERROR_TITLE)
    expect(markup).toContain(ERROR_BODY)
    expect(markup).toContain('Copy error')
  })
})
```

`lib/flags.test.ts`, add:

```ts
describe('crashTestEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is off when the flag is absent', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_CRASH_TEST', '')
    expect(crashTestEnabled()).toBe(false)
  })

  it('is on when the flag is 1', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_CRASH_TEST', '1')
    expect(crashTestEnabled()).toBe(true)
  })
})
```

`tests/e2e/errors.spec.ts`:

```ts
import { expect, test } from './support/signedIn'

test('a render error on an app route shows the Reload screen, not a blank page', async ({
  page,
}) => {
  await page.goto('/crash-test')

  await expect(page.getByRole('heading', { name: 'Something went wrong.' })).toBeVisible()
  await expect(page.getByText('Your data is safe on this device.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy error' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Today', exact: true }).first()).toBeAttached()
})

test('Reload on the error screen loads the page again', async ({ page }) => {
  await page.goto('/crash-test')
  await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible()

  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Reload' }).click(),
  ])

  await expect(page.getByRole('heading', { name: 'Something went wrong.' })).toBeVisible()
})
```

The link label comes from `lib/nav.ts:8`. It proves the `(app)` navigation stays on screen.

### 2. The error helpers

`lib/errors/report.ts`:

```ts
export type ErrorSource = 'boundary' | 'window' | 'rejection' | 'live-query' | 'sync'

export const UNKNOWN_ERROR = 'An error with no message'

function textOf(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return UNKNOWN_ERROR
  }
}

export function describeError(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) {
    return { message: error.message || error.name, stack: error.stack ?? null }
  }

  if (typeof error === 'string') {
    return { message: error, stack: null }
  }

  return { message: textOf(error), stack: null }
}

function digestOf(error: unknown): string | null {
  if (error instanceof Error && 'digest' in error && typeof error.digest === 'string') {
    return error.digest
  }

  return null
}

export function errorText(error: unknown): string {
  const { message, stack } = describeError(error)
  const digest = digestOf(error)

  return [message, digest === null ? null : `Digest: ${digest}`, stack]
    .filter((line): line is string => line !== null)
    .join('\n')
}

export function currentRoute(): string {
  return typeof window === 'undefined' ? '' : window.location.pathname
}

export function reportError(error: unknown, context: { route: string; source: ErrorSource }): void {
  const { message, stack } = describeError(error)

  console.error(`[${context.source}] ${context.route} ${message}`, stack ?? '')
}
```

`lib/errors/browser.ts`:

```ts
export function reloadPage(): void {
  window.location.reload()
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}
```

### 3. The guarded query

`lib/db/safeQuery.ts`:

```ts
import { currentRoute, describeError, reportError } from '../errors/report'

export function safeQuery<T>(query: () => Promise<T>, source: string): () => Promise<T | null> {
  return async () => {
    try {
      return await query()
    } catch (cause) {
      const { message, stack } = describeError(cause)
      const error = new Error(`${source}: ${message}`)

      error.stack = stack ?? error.stack
      reportError(error, { route: currentRoute(), source: 'live-query' })

      return null
    }
  }
}
```

`lib/sync/useSyncStatus.ts`. Add `'unknown'` to `SyncStatus`. Replace lines 62-69:

```ts
export type SyncStatus = 'offline' | 'syncing' | 'synced' | 'error' | 'unknown'
```

```ts
  const pending = useLiveQuery(safeQuery(() => pendingCount(), 'sync pending count'), [])
  const failed = useLiveQuery(safeQuery(() => deadLetterCount(), 'sync failed count'), [])

  if (pending === null || failed === null) {
    return { status: 'unknown', pending: 0, failed: 0 }
  }

  return { status: toStatus(online, state), pending: pending ?? 0, failed: failed ?? 0 }
}

export function useDeadLetters(): DeadLetter[] {
  return useLiveQuery(safeQuery(() => listDeadLetters(), 'sync failed writes'), []) ?? []
}
```

Import `safeQuery` from `'../db/safeQuery'`. The query has no default value now. So
`undefined` means "still loading" and `null` means "the read failed".

### 4. The unknown chip

`components/ui/StatusChip.tsx`:

```ts
export type SyncStatus = 'synced' | 'offline' | 'syncing' | 'pending' | 'unknown'
```

Add to `CHIP`:

```ts
  unknown: { label: 'Unknown', dot: 'bg-dim' },
```

The label carries the meaning. The dot is decorative, so `--color-dim` is allowed here.

`components/sync/SyncChip.tsx`, the first branch of `chipStatus`:

```ts
if (status === 'offline' || status === 'syncing' || status === 'unknown') {
  return status
}
```

### 5. The import review

`components/csv/ImportReview.tsx:447`:

```ts
const pulled = useLiveQuery(
  safeQuery(() => source.firstPullDone(), 'import first pull'),
  [source],
)
```

Import `safeQuery` from `'../../lib/db/safeQuery'`. In `hint()`, change the first and the
third checks:

```ts
if (loggedFailed || pulled === null) {
  return LOGGED_READ_FAILED
}

if (pulled === false) {
  return WAITING_FOR_FIRST_SYNC
}

if (logged === null || pulled === undefined) {
  return 'Reading the days on this device…'
}
```

`ready` keeps `pulled === true`.

### 6. The error screen

`components/errors/ErrorScreen.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'

import { copyText, reloadPage } from '../../lib/errors/browser'
import { currentRoute, errorText, reportError } from '../../lib/errors/report'
import { Card } from '../ui/Card'
import { MicroLabel } from '../ui/MicroLabel'
import { PrimaryButton } from '../ui/PrimaryButton'
import { SecondaryButton } from '../ui/SecondaryButton'

export const ERROR_TITLE = 'Something went wrong.'

export const ERROR_BODY = 'Your data is safe on this device.'

export const COPIED = 'The error is copied.'

export const COPY_FAILED = 'The error could not be copied.'

type CopyState = 'idle' | 'copied' | 'failed'

const COPY_TEXT: Record<CopyState, string> = {
  idle: '',
  copied: COPIED,
  failed: COPY_FAILED,
}

export type ErrorScreenProps = {
  error: Error & { digest?: string }
  reload?: () => void
  copy?: (text: string) => Promise<void>
}

export function ErrorScreenView({ error, reload = reloadPage, copy = copyText }: ErrorScreenProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle')

  function copyError(): void {
    void copy(errorText(error)).then(
      () => {
        setCopyState('copied')
      },
      () => {
        setCopyState('failed')
      },
    )
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <MicroLabel as="p">Error</MicroLabel>
      <h1 className="mt-2 text-[23px] leading-tight font-bold tracking-[-0.6px]">{ERROR_TITLE}</h1>
      <p className="text-muted mt-3 text-sm leading-relaxed">{ERROR_BODY}</p>
      <div className="mt-6 flex flex-col gap-2">
        <PrimaryButton
          onClick={() => {
            reload()
          }}
        >
          Reload
        </PrimaryButton>
        <SecondaryButton onClick={copyError}>Copy error</SecondaryButton>
      </div>
      <p
        role="status"
        className={copyState === 'failed' ? 'text-danger mt-2 text-xs' : 'text-muted mt-2 text-xs'}
      >
        {COPY_TEXT[copyState]}
      </p>
    </Card>
  )
}

export function ErrorScreen(props: ErrorScreenProps) {
  const { error } = props

  useEffect(() => {
    reportError(error, { route: currentRoute(), source: 'boundary' })
  }, [error])

  return <ErrorScreenView {...props} />
}
```

`app/(app)/error.tsx`. It renders inside the `(app)` layout, so the navigation stays:

```tsx
'use client'

import { ErrorScreen } from '../../components/errors/ErrorScreen'

export default function AppError({
  error,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorScreen error={error} />
}
```

`app/global-error.tsx`. It replaces the root layout, so it owns `html` and `body`:

```tsx
'use client'

import { ErrorScreen } from '../components/errors/ErrorScreen'

import './globals.css'

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="bg-ground text-text font-sans [font-variant-numeric:tabular-nums]">
        <main className="px-5 pt-[calc(env(safe-area-inset-top)+40px)] pb-10 md:px-7">
          <ErrorScreen error={error} />
        </main>
      </body>
    </html>
  )
}
```

Do not use `min-h-dvh` here. The design check allows it only in `AppShell` and the 2
named frames.

### 7. The test-only crash route

`lib/flags.ts`, add:

```ts
export function crashTestEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_CRASH_TEST === '1'
}
```

`components/errors/ForcedCrash.tsx`. It throws only after mount, so `next build` can
prerender the route:

```tsx
'use client'

import { useEffect, useState } from 'react'

export const FORCED_CRASH_MESSAGE = 'A forced render error for the end to end test.'

export function ForcedCrash() {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    setArmed(true)
  }, [])

  if (armed) {
    throw new Error(FORCED_CRASH_MESSAGE)
  }

  return <p className="text-muted text-sm">Forcing a render error…</p>
}
```

`app/(app)/crash-test/page.tsx`. A page file may export only the default and the Next
fields, so the component lives in `components/errors/`:

```tsx
import { notFound } from 'next/navigation'

import { ForcedCrash } from '../../../components/errors/ForcedCrash'
import { crashTestEnabled } from '../../../lib/flags'

export default function CrashTestPage() {
  if (!crashTestEnabled()) {
    notFound()
  }

  return <ForcedCrash />
}
```

Turn the flag on for the end to end build only:

- `playwright.config.ts:51` — add `NEXT_PUBLIC_ENABLE_CRASH_TEST: '1'` to `webServer.env`.
- `.github/workflows/ci.yml:139-141` — add `NEXT_PUBLIC_ENABLE_CRASH_TEST: '1'` to the
  Build step `env`.

Vercel never sets the flag, so production answers `/crash-test` with a 404.

### 8. The style guide and the prototype

- `app/styleguide/page.tsx:953` — add `<StatusChip status="unknown" />` after the
  `pending` chip. Add a section "Error screen" that renders
  `<ErrorScreenView error={new Error('Sample error')} reload={() => undefined} copy={() => Promise.resolve()} />`.
  Use the view, not `ErrorScreen`, so the style guide logs no error.
- `app/styleguide/page.test.tsx` — add 1 `it` that finds the heading
  `Something went wrong.` and 1 `it` that finds a status with the text `Unknown`.
- `docs/design/prototype/index.html` — in the plate "06 Profile", add an Unknown chip to
  the "Chip states" group (line 5006), after Offline:

  ```html
  <span class="chip"
    ><span class="dot" style="background: var(--color-dim)" aria-hidden="true"></span>Unknown</span
  >
  ```

- `docs/design/prototype/index.html` — a new plate after plate 11, before `</main>`
  (line 5965). Use the next free plate number:

  ```html
  <section class="plate" aria-labelledby="p-error">
    <div class="plate-label">
      <span class="n">12</span>
      <span class="name" id="p-error">Something went wrong</span>
      <span class="route">any (app) route · error.tsx</span>
    </div>
    <div class="frame">
      <div class="screen">
        <div class="body">
          <div class="card">
            <span class="micro">Error</span>
            <h2 style="margin: 8px 0 0; font-size: 23px; font-weight: 700; letter-spacing: -0.6px">
              Something went wrong.
            </h2>
            <p class="muted" style="margin: 12px 0 0; font-size: 14px">
              Your data is safe on this device.
            </p>
            <div style="display: grid; gap: 8px; margin-top: 24px">
              <button class="btn" type="button">Reload</button>
              <button class="btn btn-secondary" type="button">Copy error</button>
            </div>
          </div>
        </div>
        <nav class="tabbar" aria-label="Main">
          <a href="#"><span class="glyph" aria-hidden="true">◧</span>Today</a>
          <a href="#"><span class="glyph" aria-hidden="true">✎</span>Log</a>
          <button class="center" type="button" aria-label="Start a live workout">
            <span class="glyph" aria-hidden="true">▶</span>
          </button>
          <a href="#"><span class="glyph" aria-hidden="true">◔</span>Stats</a>
          <a href="#"><span class="glyph" aria-hidden="true">☰</span>Profile</a>
        </nav>
      </div>
    </div>
  </section>
  ```

## Acceptance criteria

- [ ] `describeError` keeps the message and the stack of an `Error`.
- [ ] `describeError` names an `Error` with an empty message by its name.
- [ ] `describeError` keeps a thrown string as the message.
- [ ] `describeError` writes a thrown object as JSON.
- [ ] `describeError` writes `undefined` as the word `undefined`.
- [ ] `describeError` names a value that JSON cannot write, and does not throw.
- [ ] `errorText` joins the message, the digest and the stack.
- [ ] `errorText` leaves out a digest and a stack that do not exist.
- [ ] `currentRoute` is empty outside a browser.
- [ ] `currentRoute` reads the path of the open page.
- [ ] `reportError` writes the source, the route and the message to the console.
- [ ] `reloadPage` reloads the open page.
- [ ] `copyText` writes the text to the clipboard.
- [ ] `copyText` rejects when the browser has no clipboard.
- [ ] `safeQuery` returns the value of a query that succeeds.
- [ ] `safeQuery` reports nothing when the query succeeds.
- [ ] `safeQuery` returns `null` when the query rejects.
- [ ] `safeQuery` returns `null` when the query throws before it returns a promise.
- [ ] `safeQuery` reports the failure as a `live-query` error with the query name.
- [ ] `useSyncStatus` reports `unknown` when the outbox count cannot be read.
- [ ] `useSyncStatus` reports `unknown` when the failed write count cannot be read.
- [ ] `useSyncStatus` reports the failed read as a `live-query` error.
- [ ] `useDeadLetters` lists no failed writes when the list cannot be read.
- [ ] `StatusChip` names the unknown state in words.
- [ ] `chipStatus` returns `unknown` for the `unknown` status.
- [ ] `SyncChip` shows "Unknown" when the repository cannot read the counts.
- [ ] `ImportReview` keeps Apply disabled with `LOGGED_READ_FAILED` when `firstPullDone` fails.
- [ ] `ErrorScreenView` shows the title and says the data is safe.
- [ ] `ErrorScreenView` reloads the page when Reload is pressed.
- [ ] `ErrorScreenView` copies the message and the stack.
- [ ] `ErrorScreenView` says the error is copied.
- [ ] `ErrorScreenView` says the copy failed when the clipboard refuses.
- [ ] `ErrorScreenView` reports nothing by itself.
- [ ] `ErrorScreen` reports the error once with the `boundary` source.
- [ ] `ForcedCrash` throws a render error once it is mounted.
- [ ] `/crash-test` is not found when the flag is absent.
- [ ] `/crash-test` renders the forced crash when the flag is on.
- [ ] `AppError` shows the Reload screen.
- [ ] `AppError` reports the error from the boundary.
- [ ] `GlobalError` renders its own `html` and `body` around the error screen.
- [ ] `crashTestEnabled` is off when the flag is absent.
- [ ] `crashTestEnabled` is on when the flag is 1.
- [ ] The style guide shows the error screen.
- [ ] The style guide shows the Unknown chip.
- [ ] End to end: a render error on an app route shows the Reload screen, not a blank page.
- [ ] End to end: Reload on the error screen loads the page again.

### The gate and the dependencies

- [ ] W0 is merged: every dependency check in "Before you start" prints `ok`.
- [ ] The exported names match "Names this step fixes for later steps". Tests: `lib/errors/report.test.ts`, `lib/errors/browser.test.ts`, `lib/db/safeQuery.test.ts`, `components/errors/ErrorScreen.test.tsx`, `lib/flags.test.ts`.
- [ ] `/crash-test` has no sideways scroll at 390, 768 and 1440 px, and every button is 44 px or taller. Manual check: "Verification", item 5.
- [ ] The `ui-reviewer` agent reports no drift on the error screen and the chip. Manual check: "Verification", item 4.
- [ ] The staged diff holds only the files in "Files touched". Manual check: `git diff --cached --stat`.
- [ ] `pnpm verify:parallel` passes. Manual check: "When the step is done", item 1.

## Tests

One `it` per criterion above, in the files named in "Do", step 1:
`lib/errors/report.test.ts`, `lib/errors/browser.test.ts`, `lib/db/safeQuery.test.ts`,
`lib/sync/useSyncStatus.test.ts`, `components/ui/StatusChip.test.tsx`,
`components/sync/SyncChip.test.tsx`, `components/csv/ImportReview.test.tsx`,
`components/errors/ErrorScreen.test.tsx`, `components/errors/ForcedCrash.test.tsx`,
`app/(app)/crash-test/page.test.tsx`, `app/(app)/error.test.tsx`,
`app/global-error.test.tsx`, `lib/flags.test.ts`, `app/styleguide/page.test.tsx` and
`tests/e2e/errors.spec.ts`.

## Verification

1. `pnpm test:cov`. `lib/sync/**` stays at 95 / 90 / 95. Every new file meets its floor.
2. `pnpm test:required` passes. Every new source file has a test beside it.
3. `node scripts/e2e-lock.mjs pnpm e2e tests/e2e/errors.spec.ts`. Stop any server on port 3100 first. A reused
   server built without `NEXT_PUBLIC_ENABLE_CRASH_TEST` answers 404.
4. The `ui-reviewer` agent reports no drift on the error screen and the chip.
5. Check `/crash-test` at 390, 768 and 1440 px. No sideways scroll. Every button is 44 px
   or taller.
6. `pnpm verify:parallel`.

## Files touched

- `lib/errors/report.ts` and its test (new)
- `lib/errors/browser.ts` and its test (new)
- `lib/db/safeQuery.ts` and its test (new)
- `lib/sync/useSyncStatus.ts` and its test
- `lib/flags.ts` and its test
- `components/ui/StatusChip.tsx` and its test
- `components/sync/SyncChip.tsx` and its test
- `components/csv/ImportReview.tsx` and its test
- `components/errors/ErrorScreen.tsx` and its test (new)
- `components/errors/ForcedCrash.tsx` and its test (new)
- `app/(app)/error.tsx` and its test (new)
- `app/global-error.tsx` and its test (new)
- `app/(app)/crash-test/page.tsx` and its test (new)
- `app/styleguide/page.tsx` and its test
- `tests/e2e/errors.spec.ts` (new)
- `playwright.config.ts`, `.github/workflows/ci.yml`
- `docs/design/prototype/index.html`

## Known limits

- The sign-out hint counts 0 unsynced writes while the chip is Unknown. `clearAll` still
  recounts inside its own transaction and refuses with `UnsyncedWritesChanged`, so no write
  is lost.
- In A1 `reportError` only writes to the console. A3 makes it persist.

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer when another step runs its e2e suite. Never skip a check, and never add a design-check or test exemption to pass.
2. Stage the files from "Files touched", including the tests. Then run the `commit-report` skill. The skill reports on the staged diff, so stage first:
   ```bash
   git add lib/errors/report.ts lib/errors/report.test.ts lib/errors/browser.ts lib/errors/browser.test.ts lib/db/safeQuery.ts lib/db/safeQuery.test.ts lib/sync/useSyncStatus.ts lib/sync/useSyncStatus.test.ts lib/flags.ts lib/flags.test.ts components/ui/StatusChip.tsx components/ui/StatusChip.test.tsx components/sync/SyncChip.tsx components/sync/SyncChip.test.tsx components/csv/ImportReview.tsx components/csv/ImportReview.test.tsx components/errors/ErrorScreen.tsx components/errors/ErrorScreen.test.tsx components/errors/ForcedCrash.tsx components/errors/ForcedCrash.test.tsx 'app/(app)/error.tsx' 'app/(app)/error.test.tsx' app/global-error.tsx app/global-error.test.tsx 'app/(app)/crash-test/page.tsx' 'app/(app)/crash-test/page.test.tsx' app/styleguide/page.tsx app/styleguide/page.test.tsx tests/e2e/errors.spec.ts playwright.config.ts .github/workflows/ci.yml docs/design/prototype/index.html
   ```
   The report needs screenshots of every changed page at 390, 768 and 1440 px, next to the matching prototype plate: `/crash-test` (the error screen) next to the new plate "Something went wrong", and `/profile` (the Unknown chip) next to the plate "06 Profile".
3. Commit on `fix/a1-error-boundaries`. This step file tells you to commit, so you commit, not the owner:
   ```bash
   git commit -m "fix(ui): add the error boundaries and guard the live queries"
   ```
   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.
4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked, and anything the owner must check on the iPhone. For this step: nothing on the iPhone for this step alone. Say that `/crash-test` stays off unless `NEXT_PUBLIC_ENABLE_CRASH_TEST=1`.
