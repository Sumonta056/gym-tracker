# Step A2 — Version change, stale chunk, sync catch

**Branch:** `fix/a2-version-and-chunks`, in worktree `../gym-tracker-a2`, cut from `fix/feedback-fixes` · **Wave:** 2 · **Size:** S · **Depends on:** W0, A1 · **Unlocks:** A3 · **Skills to load:** `design-system` · **Agent to use:** `test-writer` for the tests, `sync-auditor` and `ui-reviewer` before the step ends

## Before you start

### 1. The worktree

```bash
cd /Users/cefalo_1/Documents/Projects/gym-tracker
git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-a2 -b fix/a2-version-and-chunks fix/feedback-fixes
cd ../gym-tracker-a2
cp ../gym-tracker/.env.local ../gym-tracker/.env.test.local .
export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"
pnpm install
```

If you are already in that worktree on that branch, skip this block. Run every later
command from `../gym-tracker-a2`.

### 2. Dependency checks

Run this from the worktree. Each line prints `ok` or `FAIL` and the step it belongs to.

```bash
check() { if sh -c "$2" >/dev/null 2>&1; then echo "ok   $1"; else echo "FAIL $1: $2"; fi; }
check W0 'test -f scripts/e2e-lock.mjs'
check W0 'grep -q verify:parallel package.json'
check A1 'grep -q "export function reportError" lib/errors/report.ts'
check A1 'grep -q "export function reloadPage" lib/errors/browser.ts'
check A1 'grep -q "export function safeQuery" lib/db/safeQuery.ts'
check A1 'grep -q "export function ErrorScreen(" components/errors/ErrorScreen.tsx'
check A1 'test -f app/global-error.tsx'
```

If any check fails, the step it names is not merged into `fix/feedback-fixes`. Stop. Report which check
failed. Do not do that step's work here.

### 3. Already done check

```bash
git cat-file -e HEAD:lib/errors/chunk.ts 2>/dev/null && echo "A2 is already done"
```

If it prints that the step is already done, stop and report.

### 4. Every e2e run goes through the lock

Other steps run at the same time in other worktrees. They share port 3100 and the test
account. Start every Playwright run with `node scripts/e2e-lock.mjs`, for example
`node scripts/e2e-lock.mjs pnpm exec playwright test tests/e2e/<file>.spec.ts`. The lock
waits while another worktree runs its e2e suite.

## Names this step uses from earlier steps

A1 made these. The dependency checks prove they are on `fix/feedback-fixes`.

```ts
// lib/errors/report.ts (A1)
export type ErrorSource = 'boundary' | 'window' | 'rejection' | 'live-query' | 'sync'
export function describeError(error: unknown): { message: string; stack: string | null }
export function currentRoute(): string
export function reportError(error: unknown, context: { route: string; source: ErrorSource }): void

// lib/errors/browser.ts (A1)
export function reloadPage(): void
export async function copyText(text: string): Promise<void>

// lib/db/safeQuery.ts (A1)
export function safeQuery<T>(query: () => Promise<T>, source: string): () => Promise<T | null>

// components/errors/ErrorScreen.tsx (A1)
export type ErrorScreenProps = {
  error: Error & { digest?: string }
  reload?: () => void
  copy?: (text: string) => Promise<void>
}
export function ErrorScreenView(props: ErrorScreenProps): JSX.Element
export function ErrorScreen(props: ErrorScreenProps): JSX.Element
export const ERROR_TITLE = 'Something went wrong.'
```

A1 also added the prototype plate "Something went wrong" to
`docs/design/prototype/index.html`, and `tests/e2e/errors.spec.ts`.

This step fixes these names for A3: `VersionState`, `getVersionState`,
`subscribeVersionState` (re-exported from `lib/db/repository.ts`), `isChunkLoadError`,
`installChunkReload`, `sessionStore` in `lib/errors/chunk.ts`, and
`AppGuards({ reload }: { reload?: () => void })` in `components/errors/AppGuards.tsx`.

## Context to read first

1. `.claude/skills/design-system/` — load it first. This step adds a banner.
2. `docs/specs/2026-10-05-feedback-fixes-design.md`, section 3.5 "Error safety".
3. `lib/db/dexie.ts:109-142` — `DATABASE_VERSION`, the `STORES` maps and `createDatabase`.
4. `lib/sync/worker.ts:1047-1075` — `mountTriggers` and the `void sync()` in `tick`.
5. `lib/errors/report.ts`, `lib/errors/browser.ts` and `components/errors/ErrorScreen.tsx`
   from A1.
6. `app/(app)/layout.tsx` and `app/(app)/layout.test.tsx` — the client mounts and the
   repository mock.

## State before the step

- Dexie runs its default `versionchange` handler. It closes the database and lets the next
  query open it again. An old tab then fails its reads, with no message to the user.
- A `ChunkLoadError` after a deploy shows the A1 error screen. Nothing reloads by itself.
- `tick` in `lib/sync/worker.ts:1050-1052` calls `void sync()`. A rejected drain is an
  unhandled rejection.

## Goal

An old tab shows "A new version is ready." with a Reload button. A stale chunk reloads the
page 1 time, never in a loop. A failed sync drain reaches `reportError`.

## Do

### 1. Write the failing tests first

Run the `test-writer` agent with the acceptance list below. Run `pnpm test` and see the
tests fail before you write any code.

`lib/db/dexie.test.ts`. Import `createVersionWatch`, `getVersionState`, `STORES`,
`subscribeVersionState` and `versionWatch` from `./dexie`, and `vi` from `vitest`. Add:

```ts
describe('the version watch', () => {
  const opened: Dexie[] = []

  afterEach(async () => {
    for (const instance of opened) {
      instance.close()
      await instance.delete()
    }

    opened.length = 0
  })

  it('starts current', () => {
    expect(createVersionWatch().get()).toBe('current')
  })

  it('tells a listener when the state changes', () => {
    const watch = createVersionWatch()
    const listener = vi.fn()
    watch.subscribe(listener)

    watch.set('stale')

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('does not tell a listener when the state stays the same', () => {
    const watch = createVersionWatch()
    const listener = vi.fn()
    watch.subscribe(listener)

    watch.set('current')

    expect(listener).not.toHaveBeenCalled()
  })

  it('stops telling a listener after it unsubscribes', () => {
    const watch = createVersionWatch()
    const listener = vi.fn()
    const stop = watch.subscribe(listener)

    stop()
    watch.set('stale')

    expect(listener).not.toHaveBeenCalled()
  })

  it('turns stale and closes the database when another tab opens a newer version', async () => {
    const name = 'gym-tracker-versionchange'
    const watch = createVersionWatch()
    const instance = createDatabase(name, watch)
    await instance.open()

    const newer = new Dexie(name)
    newer.version(DATABASE_VERSION + 1).stores(STORES)
    opened.push(newer)
    await newer.open()

    expect(watch.get()).toBe('stale')
    expect(instance.isOpen()).toBe(false)
  })

  it('refuses every read after it turned stale, so no old code writes to a new schema', async () => {
    const name = 'gym-tracker-stale-read'
    const watch = createVersionWatch()
    const instance = createDatabase(name, watch)
    await instance.open()

    const newer = new Dexie(name)
    newer.version(DATABASE_VERSION + 1).stores(STORES)
    opened.push(newer)
    await newer.open()

    await expect(instance.syncMeta.count()).rejects.toThrow()
  })

  it('turns blocked while an old tab holds the database open, then current once it opens', async () => {
    const name = 'gym-tracker-blocked'
    const old = new Dexie(name)
    old.version(1).stores(STORES_V1)
    old.on('versionchange', () => false)
    await old.open()

    const watch = createVersionWatch()
    const instance = createDatabase(name, watch)
    opened.push(instance)
    const opening = instance.open()

    await vi.waitFor(() => {
      expect(watch.get()).toBe('blocked')
    })
    old.close()
    await opening

    expect(watch.get()).toBe('current')
  })

  it('reads and subscribes to the shared watch of the app database', () => {
    const listener = vi.fn()
    const stop = subscribeVersionState(listener)

    versionWatch.set('blocked')
    expect(getVersionState()).toBe('blocked')
    versionWatch.set('current')
    stop()

    expect(listener).toHaveBeenCalledTimes(2)
  })
})
```

`lib/errors/chunk.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CHUNK_RELOAD_KEY,
  installChunkReload,
  isChunkLoadError,
  reloadOnce,
  sessionStore,
} from './chunk'

import type { ReloadStorage } from './chunk'

function memoryStorage(): ReloadStorage {
  const values = new Map<string, string>()

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}

function chunkError(): Error {
  return Object.assign(new Error('Loading chunk 812 failed.'), { name: 'ChunkLoadError' })
}

function rejection(reason: unknown): Event {
  return Object.assign(new Event('unhandledrejection'), { reason })
}

function errorEvent(error: unknown): Event {
  return Object.assign(new Event('error'), { error })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isChunkLoadError', () => {
  it('knows a ChunkLoadError by its name', () => {
    expect(isChunkLoadError(chunkError())).toBe(true)
  })

  it('knows a failed dynamic import by its message', () => {
    expect(
      isChunkLoadError(
        new TypeError('Failed to fetch dynamically imported module: /_next/static/chunks/a.js'),
      ),
    ).toBe(true)
  })

  it('knows the Safari wording of a failed module script', () => {
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
  })

  it('ignores any other error', () => {
    expect(isChunkLoadError(new Error('boom'))).toBe(false)
  })

  it('ignores a value that is not an Error', () => {
    expect(isChunkLoadError('Loading chunk 812 failed.')).toBe(false)
  })
})

describe('reloadOnce', () => {
  it('reloads the first time and writes the flag', () => {
    const storage = memoryStorage()
    const reload = vi.fn()

    expect(reloadOnce(storage, reload)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(storage.getItem(CHUNK_RELOAD_KEY)).not.toBeNull()
  })

  it('does not reload a second time in the same session', () => {
    const storage = memoryStorage()
    const reload = vi.fn()

    reloadOnce(storage, reload)
    expect(reloadOnce(storage, reload)).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload with no session storage', () => {
    const reload = vi.fn()

    expect(reloadOnce(null, reload)).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('does not reload when the session storage throws', () => {
    const reload = vi.fn()
    const broken: ReloadStorage = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => undefined,
    }

    expect(reloadOnce(broken, reload)).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('sessionStore', () => {
  it('is null outside a browser', () => {
    expect(sessionStore()).toBeNull()
  })

  it('returns the session storage of the window', () => {
    const storage = memoryStorage()
    vi.stubGlobal('window', { sessionStorage: storage })

    expect(sessionStore()).toBe(storage)
  })
})

describe('installChunkReload', () => {
  it('reloads once on an unhandled chunk rejection', () => {
    const target = new EventTarget()
    const reload = vi.fn()
    const storage = memoryStorage()
    installChunkReload(target, () => storage, reload)

    target.dispatchEvent(rejection(chunkError()))
    target.dispatchEvent(rejection(chunkError()))

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads once on a chunk error event', () => {
    const target = new EventTarget()
    const reload = vi.fn()
    const storage = memoryStorage()
    installChunkReload(target, () => storage, reload)

    target.dispatchEvent(errorEvent(chunkError()))

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('ignores any other error', () => {
    const target = new EventTarget()
    const reload = vi.fn()
    const storage = memoryStorage()
    installChunkReload(target, () => storage, reload)

    target.dispatchEvent(rejection(new Error('boom')))
    target.dispatchEvent(errorEvent(new Error('boom')))

    expect(reload).not.toHaveBeenCalled()
  })

  it('stops listening after the teardown', () => {
    const target = new EventTarget()
    const reload = vi.fn()
    const storage = memoryStorage()
    const stop = installChunkReload(target, () => storage, reload)

    stop()
    target.dispatchEvent(rejection(chunkError()))

    expect(reload).not.toHaveBeenCalled()
  })
})
```

`components/errors/ErrorScreen.test.tsx`. Add `beforeEach(() => { window.sessionStorage.clear() })`
inside the `describe('ErrorScreen')` block, then:

```tsx
it('reloads once for a stale chunk', () => {
  const reload = vi.fn()
  const error = Object.assign(new Error('Loading chunk 812 failed.'), { name: 'ChunkLoadError' })

  render(<ErrorScreen error={error} reload={reload} />)

  expect(reload).toHaveBeenCalledTimes(1)
})

it('does not reload a stale chunk a second time in the same session', () => {
  const reload = vi.fn()
  const error = Object.assign(new Error('Loading chunk 812 failed.'), { name: 'ChunkLoadError' })
  window.sessionStorage.setItem(CHUNK_RELOAD_KEY, '2026-10-05T10:00:00.000Z')

  render(<ErrorScreen error={error} reload={reload} />)

  expect(reload).not.toHaveBeenCalled()
})

it('does not reload by itself for an ordinary error', () => {
  const reload = vi.fn()

  render(<ErrorScreen error={new Error('boom')} reload={reload} />)

  expect(reload).not.toHaveBeenCalled()
})
```

Import `CHUNK_RELOAD_KEY` from `'../../lib/errors/chunk'`.

`components/errors/VersionBanner.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { VERSION_BLOCKED, VERSION_READY, VersionBanner, VersionBannerView } from './VersionBanner'

import type { VersionState } from '../../lib/db/repository'

const mocks = vi.hoisted(() => ({
  state: 'current' as VersionState,
  listeners: new Set<() => void>(),
}))

vi.mock('../../lib/db/repository', () => ({
  getVersionState: () => mocks.state,
  subscribeVersionState: (listener: () => void) => {
    mocks.listeners.add(listener)

    return () => {
      mocks.listeners.delete(listener)
    }
  },
}))

beforeEach(() => {
  mocks.state = 'current'
  mocks.listeners.clear()
})

describe('VersionBannerView', () => {
  it('asks to close the other tabs while the upgrade is blocked, with no Reload button', () => {
    render(<VersionBannerView state="blocked" onReload={vi.fn()} />)

    expect(screen.getByRole('alert')).toHaveTextContent(VERSION_BLOCKED)
    expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument()
  })
})

describe('VersionBanner', () => {
  it('shows nothing while the version is current', () => {
    render(<VersionBanner reload={vi.fn()} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('says a new version is ready when the database turned stale', () => {
    mocks.state = 'stale'
    render(<VersionBanner reload={vi.fn()} />)

    expect(screen.getByRole('alert')).toHaveTextContent(VERSION_READY)
  })

  it('reloads the page when Reload is pressed', async () => {
    mocks.state = 'stale'
    const reload = vi.fn()
    render(<VersionBanner reload={reload} />)

    await userEvent.click(screen.getByRole('button', { name: 'Reload' }))

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('appears when the state changes after the first render', () => {
    render(<VersionBanner reload={vi.fn()} />)

    mocks.state = 'stale'
    act(() => {
      for (const listener of mocks.listeners) listener()
    })

    expect(screen.getByRole('alert')).toHaveTextContent(VERSION_READY)
  })
})
```

`components/errors/AppGuards.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppGuards } from './AppGuards'

import type { VersionState } from '../../lib/db/repository'

const mocks = vi.hoisted(() => ({ state: 'current' as VersionState }))

vi.mock('../../lib/db/repository', () => ({
  getVersionState: () => mocks.state,
  subscribeVersionState: () => () => undefined,
}))

function chunkRejection(): Event {
  return Object.assign(new Event('unhandledrejection'), {
    reason: Object.assign(new Error('Loading chunk 812 failed.'), { name: 'ChunkLoadError' }),
  })
}

beforeEach(() => {
  mocks.state = 'current'
  window.sessionStorage.clear()
})

describe('AppGuards', () => {
  it('reloads once when a chunk fails to load', () => {
    const reload = vi.fn()
    render(<AppGuards reload={reload} />)

    window.dispatchEvent(chunkRejection())
    window.dispatchEvent(chunkRejection())

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('stops listening after it unmounts', () => {
    const reload = vi.fn()
    const { unmount } = render(<AppGuards reload={reload} />)

    unmount()
    window.dispatchEvent(chunkRejection())

    expect(reload).not.toHaveBeenCalled()
  })

  it('shows the version banner when the database turned stale', () => {
    mocks.state = 'stale'
    render(<AppGuards reload={vi.fn()} />)

    expect(screen.getByRole('alert')).toHaveTextContent('A new version is ready.')
  })
})
```

`app/(app)/layout.test.tsx`. Add `version: 'current' as string` to the hoisted `mocks`. Add
to the repository mock:

```ts
  getVersionState: () => mocks.version,
  subscribeVersionState: () => () => undefined,
```

Then add:

```tsx
it('shows the reload banner when the database turned stale', () => {
  mocks.version = 'stale'
  setup()
  expect(screen.getByRole('alert')).toHaveTextContent('A new version is ready.')
  mocks.version = 'current'
})
```

`lib/sync/worker.test.ts`. Add `reportError: vi.fn()` to the hoisted `mocks`. Mock the
module next to the Supabase mock:

```ts
vi.mock('../errors/report', async (importOriginal) => ({
  ...(await importOriginal<typeof Report>()),
  reportError: mocks.reportError,
}))
```

Add `import type * as Report from '../errors/report'` with the type imports. Reset the spy
in the top `beforeEach` with `mocks.reportError.mockReset()`. Then add to
`describe('startSync')`:

```ts
it('reports a drain that rejects, so it is never an unhandled rejection', async () => {
  const fake = fakeClient()
  mocks.createClient.mockReturnValue(fake.client)
  Object.defineProperty(globalThis.navigator, 'locks', {
    configurable: true,
    value: { request: () => Promise.reject(new Error('lock manager gone')) },
  })

  const stop = startSync()

  await vi.waitFor(() => {
    expect(mocks.reportError).toHaveBeenCalledWith(expect.any(Error), {
      route: '/',
      source: 'sync',
    })
  })
  stop()
})
```

The top `afterEach` already deletes `navigator.locks`.

`tests/e2e/errors.spec.ts`, add:

```ts
test('a newer database version in another tab shows the reload banner', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('dashboard-grid')).toBeVisible()

  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('gym-tracker', 10000)
        request.onsuccess = () => {
          request.result.close()
          resolve()
        }
        request.onerror = () => {
          reject(new Error(String(request.error)))
        }
      }),
  )

  const banner = page.getByRole('alert').filter({ hasText: 'A new version is ready.' })
  await expect(banner).toBeVisible()
  await expect(banner.getByRole('button', { name: 'Reload' })).toBeVisible()
})
```

Dexie stores version `n` as IndexedDB version `n × 10`, so 10000 is always newer. The
filter skips the Next route announcer, which also has `role="alert"`.

### 2. The version watch in `lib/db/dexie.ts`

Add above `createDatabase`:

```ts
export type VersionState = 'current' | 'stale' | 'blocked'

export interface VersionWatch {
  get: () => VersionState
  subscribe: (listener: () => void) => () => void
  set: (next: VersionState) => void
}

export function createVersionWatch(): VersionWatch {
  let state: VersionState = 'current'
  const listeners = new Set<() => void>()

  return {
    get: () => state,
    subscribe: (listener) => {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
    set: (next) => {
      if (next === state) {
        return
      }

      state = next

      for (const listener of listeners) {
        listener()
      }
    },
  }
}

export const versionWatch = createVersionWatch()

export function getVersionState(): VersionState {
  return versionWatch.get()
}

export function subscribeVersionState(listener: () => void): () => void {
  return versionWatch.subscribe(listener)
}
```

Replace `createDatabase`:

```ts
export function createDatabase(
  name: string = DATABASE_NAME,
  watch: VersionWatch = versionWatch,
): GymDatabase {
  const instance = new Dexie(name) as GymDatabase

  instance.version(1).stores(STORES_V1)
  instance.version(2).stores(STORES_V2)
  instance.version(DATABASE_VERSION).stores(STORES)

  instance.on('versionchange', () => {
    instance.close({ disableAutoOpen: true })
    watch.set('stale')

    return false
  })
  instance.on('blocked', () => {
    watch.set('blocked')
  })
  instance.on(
    'ready',
    () => {
      if (watch.get() === 'blocked') {
        watch.set('current')
      }
    },
    true,
  )

  return instance
}
```

Why each part:

- Dexie runs the newest `versionchange` subscriber first. `return false` stops the chain,
  so the default handler, which closes with auto open, never runs.
- `disableAutoOpen: true` makes every later read fail with `DatabaseClosedError`. The A1
  `safeQuery` turns that into `null`. The old code can never write rows into a new schema.
- `stale` never goes back to `current`. Only a reload loads the new code.
- `blocked` fires in the new tab while an old tab holds the database. `ready` lifts it once
  the upgrade runs.

### 3. The repository re-export

`lib/db/repository.ts`, next to the other `./dexie` re-export at line 36:

```ts
export { getVersionState, subscribeVersionState } from './dexie'

export type { VersionState } from './dexie'
```

Screens reach the version state through the repository only.

### 4. The chunk reload

`lib/errors/chunk.ts`:

```ts
export const CHUNK_RELOAD_KEY = 'gym-tracker:chunk-reload'

const CHUNK_MESSAGES = [
  /Loading chunk [\w-]+ failed/i,
  /Loading CSS chunk [\w-]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
]

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  return (
    error.name === 'ChunkLoadError' || CHUNK_MESSAGES.some((pattern) => pattern.test(error.message))
  )
}

export type ReloadStorage = Pick<Storage, 'getItem' | 'setItem'>

export function reloadOnce(storage: ReloadStorage | null, reload: () => void): boolean {
  if (storage === null) {
    return false
  }

  try {
    if (storage.getItem(CHUNK_RELOAD_KEY) !== null) {
      return false
    }

    storage.setItem(CHUNK_RELOAD_KEY, new Date().toISOString())
  } catch {
    return false
  }

  reload()

  return true
}

export function sessionStore(): ReloadStorage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

type ListenTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>

export function installChunkReload(
  target: ListenTarget,
  storage: () => ReloadStorage | null,
  reload: () => void,
): () => void {
  const handle = (error: unknown): void => {
    if (isChunkLoadError(error)) {
      reloadOnce(storage(), reload)
    }
  }
  const onError = (event: Event): void => {
    handle((event as ErrorEvent).error)
  }
  const onRejection = (event: Event): void => {
    handle((event as PromiseRejectionEvent).reason)
  }

  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onRejection)

  return () => {
    target.removeEventListener('error', onError)
    target.removeEventListener('unhandledrejection', onRejection)
  }
}
```

`components/errors/ErrorScreen.tsx`. Replace `ErrorScreen`:

```tsx
export function ErrorScreen(props: ErrorScreenProps) {
  const { error, reload = reloadPage } = props

  useEffect(() => {
    reportError(error, { route: currentRoute(), source: 'boundary' })

    if (isChunkLoadError(error)) {
      reloadOnce(sessionStore(), reload)
    }
  }, [error, reload])

  return <ErrorScreenView {...props} />
}
```

Import `isChunkLoadError`, `reloadOnce` and `sessionStore` from `'../../lib/errors/chunk'`.

### 5. The banner and the guard mount

`components/errors/VersionBanner.tsx`:

```tsx
'use client'

import { useSyncExternalStore } from 'react'

import { getVersionState, subscribeVersionState } from '../../lib/db/repository'
import { reloadPage } from '../../lib/errors/browser'

import type { VersionState } from '../../lib/db/repository'

export const VERSION_READY = 'A new version is ready.'

export const VERSION_BLOCKED = 'Close the other Gym Tracker tabs to finish the update.'

function currentOnServer(): VersionState {
  return 'current'
}

export function VersionBannerView({
  state,
  onReload,
}: {
  state: Exclude<VersionState, 'current'>
  onReload: () => void
}) {
  return (
    <div
      role="alert"
      className="bg-surface border-accent rounded-card flex items-center justify-between gap-3 border p-3"
    >
      <p className="text-text text-sm font-bold">
        {state === 'stale' ? VERSION_READY : VERSION_BLOCKED}
      </p>
      {state === 'stale' ? (
        <button
          type="button"
          onClick={onReload}
          className="bg-accent text-accent-ink min-h-11 shrink-0 rounded-full px-4 text-sm font-bold"
        >
          Reload
        </button>
      ) : null}
    </div>
  )
}

export function VersionBanner({ reload = reloadPage }: { reload?: () => void }) {
  const state = useSyncExternalStore(subscribeVersionState, getVersionState, currentOnServer)

  if (state === 'current') {
    return null
  }

  return (
    <div className="fixed inset-x-0 top-0 z-50 px-5 pt-[calc(env(safe-area-inset-top)+8px)] md:px-7 lg:left-60">
      <VersionBannerView
        state={state}
        onReload={() => {
          reload()
        }}
      />
    </div>
  )
}
```

`lg:left-60` keeps the banner clear of the 240 px sidebar.

`components/errors/AppGuards.tsx`:

```tsx
'use client'

import { useEffect } from 'react'

import { reloadPage } from '../../lib/errors/browser'
import { installChunkReload, sessionStore } from '../../lib/errors/chunk'

import { VersionBanner } from './VersionBanner'

export function AppGuards({ reload = reloadPage }: { reload?: () => void }) {
  useEffect(() => installChunkReload(window, sessionStore, reload), [reload])

  return <VersionBanner reload={reload} />
}
```

`app/(app)/layout.tsx`. Mount it first:

```tsx
import { AppNav } from '../../components/AppNav'
import { AppGuards } from '../../components/errors/AppGuards'
import { SyncRunner } from '../../components/sync/SyncRunner'
import { ResumePrompt } from '../../components/workout/ResumePrompt'

import type { ReactNode } from 'react'

export default function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <AppGuards />
      <SyncRunner />
      <AppNav>{children}</AppNav>
      <ResumePrompt />
    </>
  )
}
```

### 6. The sync catch

`lib/sync/worker.ts:1050-1052`:

```ts
const tick = (): void => {
  sync().catch((cause: unknown) => {
    reportError(cause, { route: currentRoute(), source: 'sync' })
  })
}
```

Add `import { currentRoute, reportError } from '../errors/report'` with the other imports.
No other worker code changes.

### 7. The style guide and the prototype

- `app/styleguide/page.tsx` — a section "Version banner" with
  `<VersionBannerView state="stale" onReload={() => undefined} />` and
  `<VersionBannerView state="blocked" onReload={() => undefined} />`, stacked with `gap-3`.
- `app/styleguide/page.test.tsx` — 1 `it` that finds an alert with the text
  `A new version is ready.`
- `docs/design/prototype/index.html` — a new plate after the plate "Something went wrong"
  from A1:

  ```html
  <section class="plate" aria-labelledby="p-version">
    <div class="plate-label">
      <span class="n">13</span>
      <span class="name" id="p-version">A new version is ready</span>
      <span class="route">any (app) route · old tab</span>
    </div>
    <div class="frame">
      <div class="screen" style="position: relative">
        <div style="position: absolute; inset: 0 0 auto; z-index: 5; padding: 8px 20px 0">
          <div
            class="card"
            role="alert"
            style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; border-color: var(--color-accent)"
          >
            <p style="margin: 0; font-size: 14px; font-weight: 700">A new version is ready.</p>
            <button
              type="button"
              style="min-height: 44px; padding: 0 16px; border: 0; border-radius: 999px; background: var(--color-accent); color: var(--color-accent-ink); font-weight: 700"
            >
              Reload
            </button>
          </div>
        </div>
        <div class="topbar">
          <div>
            <h2>Today</h2>
            <p class="sub">Sunday 5 Oct</p>
          </div>
          <span class="chip"
            ><span class="dot" style="background: var(--color-dim)" aria-hidden="true"></span
            >Unknown</span
          >
        </div>
      </div>
    </div>
  </section>
  ```

  The `.screen` class has no `position` (`index.html:157`), so the plate sets it inline.

## Acceptance criteria

- [ ] A new version watch starts `current`.
- [ ] The watch tells a listener when the state changes.
- [ ] The watch does not tell a listener when the state stays the same.
- [ ] The watch stops telling a listener after it unsubscribes.
- [ ] A newer version in another connection turns the watch `stale` and closes the database.
- [ ] A stale database refuses every read.
- [ ] An old open connection turns the watch `blocked`, then `current` once the upgrade runs.
- [ ] `getVersionState` and `subscribeVersionState` read the shared watch of the app database.
- [ ] `isChunkLoadError` knows a `ChunkLoadError` by its name.
- [ ] `isChunkLoadError` knows a failed dynamic import by its message.
- [ ] `isChunkLoadError` knows the Safari wording of a failed module script.
- [ ] `isChunkLoadError` ignores any other error.
- [ ] `isChunkLoadError` ignores a value that is not an `Error`.
- [ ] `reloadOnce` reloads the first time and writes the flag.
- [ ] `reloadOnce` does not reload a second time in the same session.
- [ ] `reloadOnce` does not reload with no session storage.
- [ ] `reloadOnce` does not reload when the session storage throws.
- [ ] `sessionStore` is `null` outside a browser.
- [ ] `sessionStore` returns the session storage of the window.
- [ ] `installChunkReload` reloads once on an unhandled chunk rejection.
- [ ] `installChunkReload` reloads once on a chunk error event.
- [ ] `installChunkReload` ignores any other error.
- [ ] `installChunkReload` stops listening after the teardown.
- [ ] `ErrorScreen` reloads once for a stale chunk.
- [ ] `ErrorScreen` does not reload a stale chunk a second time in the same session.
- [ ] `ErrorScreen` does not reload by itself for an ordinary error.
- [ ] `VersionBannerView` asks to close the other tabs while blocked, with no Reload button.
- [ ] `VersionBanner` shows nothing while the version is current.
- [ ] `VersionBanner` says a new version is ready when the database turned stale.
- [ ] `VersionBanner` reloads the page when Reload is pressed.
- [ ] `VersionBanner` appears when the state changes after the first render.
- [ ] `AppGuards` reloads once when a chunk fails to load.
- [ ] `AppGuards` stops listening after it unmounts.
- [ ] `AppGuards` shows the version banner when the database turned stale.
- [ ] The `(app)` layout shows the reload banner when the database turned stale.
- [ ] `startSync` reports a drain that rejects with the `sync` source.
- [ ] The style guide shows the version banner.
- [ ] End to end: a newer database version in another tab shows the reload banner.

### The gate and the dependencies

- [ ] W0 and A1 are merged: every dependency check in "Before you start" prints `ok`.
- [ ] The `sync-auditor` agent reports no lost write and no duplicate row for the `tick` change. Manual check: "Verification", item 1. The report names it under "Evidence".
- [ ] The banner clears the sidebar at 1440 px, and its Reload button is 44 px tall at 390, 768 and 1440 px. Manual check: "Verification", item 5.
- [ ] The `ui-reviewer` agent reports no drift on the banner. Manual check: "Verification", item 4.
- [ ] The staged diff holds only the files in "Files touched". Manual check: `git diff --cached --stat`.
- [ ] `pnpm verify:parallel` passes. Manual check: "When the step is done", item 1.

## Tests

One `it` per criterion above, in `lib/db/dexie.test.ts`, `lib/errors/chunk.test.ts`,
`components/errors/ErrorScreen.test.tsx`, `components/errors/VersionBanner.test.tsx`,
`components/errors/AppGuards.test.tsx`, `app/(app)/layout.test.tsx`,
`lib/sync/worker.test.ts`, `app/styleguide/page.test.tsx` and `tests/e2e/errors.spec.ts`.

## Verification

1. The `sync-auditor` agent reviews the `tick` change. It must report no lost write and no
   duplicate row. The catch only reports. It does not retry or change the drain.
2. `pnpm test:cov`. `lib/sync/**` stays at 95 / 90 / 95.
3. `node scripts/e2e-lock.mjs pnpm e2e tests/e2e/errors.spec.ts`.
4. The `ui-reviewer` agent reports no drift on the banner.
5. Check the banner at 390, 768 and 1440 px. It clears the sidebar at 1440 px. The Reload
   button is 44 px tall.
6. `pnpm verify:parallel`.

## Files touched

- `lib/db/dexie.ts` and its test
- `lib/db/repository.ts`
- `lib/errors/chunk.ts` and its test (new)
- `lib/sync/worker.ts` and its test
- `components/errors/ErrorScreen.tsx` and its test
- `components/errors/VersionBanner.tsx` and its test (new)
- `components/errors/AppGuards.tsx` and its test (new)
- `app/(app)/layout.tsx` and its test
- `app/styleguide/page.tsx` and its test
- `tests/e2e/errors.spec.ts`
- `docs/design/prototype/index.html`

## Known limits

- The chunk flag lives for the whole tab session. A second stale chunk in the same tab
  does not reload by itself. The A1 error screen still shows its Reload button.
- A browser with no `sessionStorage` never reloads by itself. It shows the error screen.

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer when another step runs its e2e suite. Never skip a check, and never add a design-check or test exemption to pass.
2. Stage the files from "Files touched", including the tests. Then run the `commit-report` skill. The skill reports on the staged diff, so stage first:
   ```bash
   git add lib/db/dexie.ts lib/db/dexie.test.ts lib/db/repository.ts lib/errors/chunk.ts lib/errors/chunk.test.ts lib/sync/worker.ts lib/sync/worker.test.ts components/errors/ErrorScreen.tsx components/errors/ErrorScreen.test.tsx components/errors/VersionBanner.tsx components/errors/VersionBanner.test.tsx components/errors/AppGuards.tsx components/errors/AppGuards.test.tsx 'app/(app)/layout.tsx' 'app/(app)/layout.test.tsx' app/styleguide/page.tsx app/styleguide/page.test.tsx tests/e2e/errors.spec.ts docs/design/prototype/index.html
   ```
   The report needs screenshots of every changed page at 390, 768 and 1440 px, next to the matching prototype plate: the banner over `/` next to the new plate "A new version is ready". Force the banner for the screenshot with the `indexedDB.open('gym-tracker', 10000)` call from the end to end test. "Evidence" names the `sync-auditor` result.
3. Commit on `fix/a2-version-and-chunks`. This step file tells you to commit, so you commit, not the owner:
   ```bash
   git commit -m "fix(sync): reload on a new version or a stale chunk and report a failed drain"
   ```
   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.
4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked, and anything the owner must check on the iPhone. For this step: an open app shows "A new version is ready." after a deploy, and Reload loads the new build.
