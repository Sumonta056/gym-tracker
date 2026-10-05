# Step B4 — The Saved toast, Finish with no reload

**Branch:** `fix/b4-saved-toast`, in worktree `../gym-tracker-b4`, cut from `fix/feedback-fixes` · **Wave:** 4 · **Size:** S · **Depends on:** W0, B3 (and B1, B2 through B3) · **Unlocks:** E2, E3, F1, G1 · **Skill to load:** `design-system` · **Agent to use:** `ui-reviewer`

## Before you start

### 1. The worktree

```bash
cd /Users/cefalo_1/Documents/Projects/gym-tracker
git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-b4 -b fix/b4-saved-toast fix/feedback-fixes
cd ../gym-tracker-b4
cp ../gym-tracker/.env.local ../gym-tracker/.env.test.local .
export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"
pnpm install
```

If you are already in that worktree on that branch, skip this block. Run every later
command from `../gym-tracker-b4`.

### 2. Dependency checks

Run this from the worktree. Each line prints `ok` or `FAIL` and the step it belongs to.

```bash
check() { if sh -c "$2" >/dev/null 2>&1; then echo "ok   $1"; else echo "FAIL $1: $2"; fi; }
check W0 'test -f scripts/e2e-lock.mjs'
check W0 'grep -q verify:parallel package.json'
check B3 'test -f tests/e2e/sheet.spec.ts'
check B3 'grep -q createPortal components/ui/SheetModal.tsx'
check B3 'grep -q visualViewport components/ui/SheetModal.tsx'
```

If any check fails, the step it names is not merged into `fix/feedback-fixes`. Stop. Report which check
failed. Do not do that step's work here.

### 3. Already done check

```bash
git cat-file -e HEAD:components/ui/Toast.tsx 2>/dev/null && echo "B4 is already done"
```

If it prints that the step is already done, stop and report.

### 4. Every e2e run goes through the lock

Other steps run at the same time in other worktrees. They share port 3100 and the test
account. Start every Playwright run with `node scripts/e2e-lock.mjs`, for example
`node scripts/e2e-lock.mjs pnpm exec playwright test tests/e2e/<file>.spec.ts`. The lock
waits while another worktree runs its e2e suite.

## Names this step uses from earlier steps

- B3 made `components/ui/SheetModal.tsx` render through `createPortal` on
  `document.body`. Its overlay is `fixed inset-0 z-50`. The new toast sits at `z-[60]`,
  above it.
- `components/workout/UndoToast.tsx` keeps a bottom `role="status"` region. B2 fix F2a
  may already render it through a portal. This step adds `data-testid="undo-region"` to
  that outer region either way.
- `app/(app)/workouts/page.tsx` "Start a session" still calls
  `window.location.assign('/workout')`, unless B2 applied fix F5.

This step fixes these names for later steps (E2, E3, F1, G1):

```ts
// components/ui/Toast.tsx
export const TOAST_MS = 2000
export const SAVED_MESSAGE = 'Saved'
export function ToastProvider({ children }: { children: ReactNode }): JSX.Element
export function useToast(): { show: (message: string) => void }
```

The Saved toast sits at the top. The undo toast stays at the bottom.

## Stop and ask the owner

Before you write the "Finish with no page load" part, stop, report, and wait for the
answer. Do not choose for the owner. Ask:

"Finish loads `/workouts` as a full document today, on purpose, so it opens offline from
the cache. This step changes Finish to `router.push`, with no page load and no white
flash. The e2e test 'keeps every set of a session logged offline through a finish and a
reload' in `tests/e2e/workout.spec.ts` still guards the offline path. May I make this
change?"

You may build the toast parts while you wait. If the owner says no, leave out "Finish with
no page load", keep `goToWorkouts`, change the commit subject to
`feat(ui): show a saved toast after each save`, and mark the Finish criterion as "not
applied, owner said no" in the report.

## Context to read first

1. `docs/specs/2026-10-05-feedback-fixes-design.md`, section 3.6 "The sheet", the
   toast paragraph, and item 2.
2. "Names this step uses from earlier steps", above. Use those names exactly:
   `ToastProvider`, `useToast`, `TOAST_MS`.
3. `.claude/skills/design-system/` — load it. `references/components.md` and
   `references/tokens.md`.
4. `.claude/rules/accessibility.md`, rule 3 and rule 4.
5. `components/workout/UndoToast.tsx` and its test. The new toast copies its style.
6. `components/ui/AppShell.tsx`, `components/DailyEntryForm.tsx` (the `save`
   callback), `components/profile/TargetsCard.tsx` (`commit`),
   `components/workout/LiveSession.tsx` (`finish`, `saveEdit`, `saveRest`,
   `goToWorkouts`).

## State before the step

- A save shows only a small "Saved on this device." line under the form, in
  `DailyEntryForm` and in `TargetsCard`. A save in the edit set sheet or the rest time
  sheet closes the sheet and shows nothing.
- `LiveSession` ends a session with `goToWorkouts`, which calls
  `window.location.assign('/workouts')`. That is a full page load: a white flash and a
  fresh Dexie open.
- `UndoToast` sits at the bottom, 84 px above the safe area on the phone, inside its
  own `role="status"` region.

## Goal

Every save shows "Saved" for 2 s in one shared toast. The toast sits at the top, so it
never covers the undo toast at the bottom. Finish moves to `/workouts` inside the app,
with no page load.

## Do

1. Load the `design-system` skill.
2. Write `components/ui/Toast.test.tsx`. Run it. It fails.
3. Write `components/ui/Toast.tsx`. The test passes.
4. Mount `ToastProvider` in `AppShell`, test first.
5. Call `show(SAVED_MESSAGE)` after each save, test first: `DailyEntryForm`,
   `TargetsCard`, and the edit set save and the rest time save in `LiveSession`.
6. Replace `goToWorkouts` with `router.push`, test first.
7. Add the toast to `/styleguide`, test first.
8. Write `tests/e2e/saved-toast.spec.ts`.

Keep the "Saved on this device." line in `DailyEntryForm` and `TargetsCard`. It tells
the user where the data is, and e2e helpers wait for it. The toast is the visible
confirmation on top.

### The toast primitive

`components/ui/Toast.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SAVED_MESSAGE, TOAST_MS, ToastProvider, useToast } from './Toast'

afterEach(() => {
  vi.useRealTimers()
})

function Saver({ message = SAVED_MESSAGE }: { message?: string }) {
  const toast = useToast()

  return (
    <button
      type="button"
      onClick={() => {
        toast.show(message)
      }}
    >
      Save
    </button>
  )
}

function renderToast() {
  return render(
    <ToastProvider>
      <Saver />
    </ToastProvider>,
  )
}

describe('ToastProvider', () => {
  it('shows the message in a status region, so it is read out', () => {
    renderToast()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('status')).toHaveTextContent('Saved')
  })

  it('keeps the status region in place with no message, so a new one is announced', () => {
    renderToast()

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('hides the message after 2 seconds', () => {
    vi.useFakeTimers()
    renderToast()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    act(() => {
      vi.advanceTimersByTime(TOAST_MS - 1)
    })
    expect(screen.getByRole('status')).toHaveTextContent('Saved')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('starts the 2 seconds again when a second save shows the same message', () => {
    vi.useFakeTimers()
    renderToast()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    act(() => {
      vi.advanceTimersByTime(1500)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(screen.getByRole('status')).toHaveTextContent('Saved')
  })

  it('lasts 2 seconds', () => {
    expect(TOAST_MS).toBe(2000)
  })

  it('says Saved', () => {
    expect(SAVED_MESSAGE).toBe('Saved')
  })

  it('sits at the top below the safe area, clear of the undo toast at the bottom', () => {
    renderToast()

    const region = screen.getByRole('status')
    expect(region).toHaveClass('fixed', 'top-[calc(env(safe-area-inset-top)+12px)]')
    expect(region.className).not.toMatch(/\bbottom-/)
  })

  it('sits above an open sheet and never takes a tap', () => {
    renderToast()

    expect(screen.getByRole('status')).toHaveClass('z-[60]', 'pointer-events-none')
  })

  it('draws the message with tokens only', () => {
    renderToast()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Saved')).toHaveClass(
      'bg-surface-2',
      'border-border',
      'text-text',
      'rounded-full',
    )
  })
})

describe('useToast', () => {
  it('does nothing outside a provider', () => {
    render(<Saver />)

    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    }).not.toThrow()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
```

`components/ui/Toast.tsx`:

```tsx
'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import type { ReactNode } from 'react'

export const TOAST_MS = 2000

export const SAVED_MESSAGE = 'Saved'

type ToastApi = { show: (message: string) => void }

type Shown = { key: number; message: string }

const ToastContext = createContext<ToastApi | null>(null)

const SILENT: ToastApi = { show: () => undefined }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<Shown | null>(null)
  const count = useRef(0)

  const show = useCallback((message: string) => {
    count.current += 1
    setShown({ key: count.current, message })
  }, [])

  useEffect(() => {
    if (shown === null) {
      return
    }

    const timer = setTimeout(() => {
      setShown(null)
    }, TOAST_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [shown])

  const api = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        data-testid="toast-region"
        className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] z-[60] flex justify-center px-5 md:px-7 lg:left-60"
      >
        {shown === null ? null : (
          <p
            key={shown.key}
            className="bg-surface-2 border-border text-text rounded-full border px-4 py-2.5 text-sm font-semibold"
          >
            {shown.message}
          </p>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  return useContext(ToastContext) ?? SILENT
}
```

Why:

- The top place keeps the 2 toasts apart. The undo toast keeps its own place at the
  bottom, as the spec says. Neither one ever covers the other.
- `z-[60]` puts it above the sheet overlay (`z-50`), so a save from a sheet that is
  still closing shows.
- `pointer-events-none` on the region: the toast never blocks a tap on the header.
- `useToast` outside a provider returns a silent no-op. Component tests that do not
  test the toast need no provider.
- `text-text` on `bg-surface-2` passes 4.5:1.

### Mount it in AppShell

Test first, in `components/ui/AppShell.test.tsx`:

```tsx
it('holds the Saved toast region outside the page transition', () => {
  render(
    <AppShell items={ITEMS} transitionKey="/">
      <p>Page body</p>
    </AppShell>,
  )

  expect(screen.getByTestId('page-transition')).not.toContainElement(
    screen.getByTestId('toast-region'),
  )
})
```

Then the code, in `components/ui/AppShell.tsx`. Import `ToastProvider` from
`./Toast`, and wrap the returned root:

```tsx
return (
  <ToastProvider>
    <div className={cn('bg-ground text-text min-h-dvh w-full lg:flex', className)}>
      ...the sidebar, the main column and the bottom nav, unchanged...
    </div>
  </ToastProvider>
)
```

`ToastProvider` is a client component. `AppShell` may stay a server-safe module: a
server module may render a client component.

### Show it after each save

**`DailyEntryForm`.** Test first, in `components/DailyEntryForm.test.tsx`. Import
`ToastProvider` from `./ui/Toast`:

```tsx
it('shows the Saved toast after a save', async () => {
  render(
    <ToastProvider>
      <DailyEntryForm date={DATE} />
    </ToastProvider>,
  )
  await userEvent.type(await screen.findByLabelText('Steps'), '9000')
  await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

  expect(await screen.findByTestId('toast-region')).toHaveTextContent('Saved')
})

it('shows no Saved toast when the save fails', async () => {
  vi.mocked(upsertDay).mockRejectedValueOnce(new Error('Dexie is closed.'))
  render(
    <ToastProvider>
      <DailyEntryForm date={DATE} />
    </ToastProvider>,
  )
  await userEvent.type(await screen.findByLabelText('Steps'), '9000')
  await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

  expect(await screen.findByText('Dexie is closed.')).toBeInTheDocument()
  expect(screen.getByTestId('toast-region')).toBeEmptyDOMElement()
})
```

Then the code, in `components/DailyEntryForm.tsx`. Import
`{ SAVED_MESSAGE, useToast } from './ui/Toast'`. Add `const toast = useToast()` beside
the other hooks at the top of `DailyEntryForm`. Change `save`:

```tsx
const save = useCallback(
  (values: DailyEntryInput) => {
    setSaved(false)
    setSaveError(null)

    return upsertDay(values).then(
      () => {
        setSaved(true)
        toast.show(SAVED_MESSAGE)
        setOfferRead((count) => count + 1)
      },
      (reason: unknown) => {
        setSaveError(reason instanceof Error ? reason.message : 'The entry could not be saved.')
      },
    )
  },
  [toast],
)
```

**`TargetsCard`.** Test first, in `components/profile/TargetsCard.test.tsx`. Import
`ToastProvider` from `'../ui/Toast'`. `SET` is the profile fixture already in that
file:

```tsx
it('shows the Saved toast after a target saves', async () => {
  render(
    <ToastProvider>
      <TargetsCard profile={SET} unit="metric" onSave={vi.fn(() => Promise.resolve())} />
    </ToastProvider>,
  )
  const field = screen.getByLabelText('Daily step goal')
  await userEvent.clear(field)
  await userEvent.type(field, '9000')
  await userEvent.tab()

  expect(await screen.findByTestId('toast-region')).toHaveTextContent('Saved')
})
```

Then the code, in `commit`, right after `setSaved(true)`:

```tsx
toast.show(SAVED_MESSAGE)
```

with `const toast = useToast()` at the top of `TargetsCard`.

**`LiveSession`, the edit set save and the rest time save.** Test first, in
`components/workout/LiveSession.test.tsx`. Import `{ SAVED_MESSAGE, ToastProvider }`
from `'../ui/Toast'`. In `describe('editing a set')`:

```tsx
it('shows the Saved toast after a set is edited', async () => {
  await sessionWithBench()
  render(
    <ToastProvider>
      <LiveSession onFinished={vi.fn()} />
    </ToastProvider>,
  )
  await screen.findByRole('heading', { level: 1, name: 'Session' })

  const dialog = await openEdit(1)
  await userEvent.clear(within(dialog).getByLabelText('Reps'))
  await userEvent.type(within(dialog).getByLabelText('Reps'), '10')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save set' }))

  expect(await screen.findByTestId('toast-region')).toHaveTextContent(SAVED_MESSAGE)
})
```

In `describe('changing the rest time')`:

```tsx
it('shows the Saved toast after the rest time saves', async () => {
  await sessionResting()
  render(
    <ToastProvider>
      <LiveSession onFinished={vi.fn()} now={restClock(6).now} />
    </ToastProvider>,
  )
  await screen.findByRole('heading', { level: 1, name: 'Session' })

  await changeRestTo('2:00')

  expect(await screen.findByTestId('toast-region')).toHaveTextContent(SAVED_MESSAGE)
})
```

Then the code, in `components/workout/LiveSession.tsx`. Import
`{ SAVED_MESSAGE, useToast } from '../ui/Toast'`. Add `const toast = useToast()`
beside the other hooks, before the first early return. In `saveEdit`, the success
branch:

```tsx
        async () => {
          setEditing(null)
          toast.show(SAVED_MESSAGE)
          await refresh()
        },
```

In `saveRest`, the success branch, right after `setChangingRest(null)`:

```tsx
toast.show(SAVED_MESSAGE)
```

### Finish with no page load

Test first, in `components/workout/LiveSession.test.tsx`. Add at the top, beside the
other `vi.mock` calls:

```tsx
const router = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}))
```

Delete `goToWorkouts` from the import and delete `describe('goToWorkouts')`. Replace
the test "returns to the workouts screen after Finish by default":

```tsx
it('moves to the workouts screen inside the app after Finish, with no page load', async () => {
  const assign = vi.fn()
  vi.stubGlobal('location', { assign })
  router.push.mockClear()
  await startSession('2026-09-01')
  render(<LiveSession />)

  await userEvent.click(await screen.findByRole('button', { name: 'Finish session' }))

  await waitFor(() => {
    expect(router.push).toHaveBeenCalledWith(WORKOUTS_PATH)
  })
  expect(assign).not.toHaveBeenCalled()
})
```

`app/(app)/workout/page.test.tsx` renders `LiveSession` too. Add the same
`next/navigation` mock there.

Then the code, in `components/workout/LiveSession.tsx`:

- Import `{ useRouter } from 'next/navigation'`.
- Delete `export function goToWorkouts()`.
- In the props, keep `onFinished?: () => void`. In the parameter list, drop the
  default: `onFinished,`.
- Beside the other hooks, before the first early return:

  ```tsx
  const router = useRouter()
  ```

- Right after the early returns, before `const saveSet`:

  ```tsx
  const leave = () => {
    if (onFinished === undefined) {
      router.push(WORKOUTS_PATH)
      return
    }

    onFinished()
  }
  ```

- In `finish`, `takeSessionTime` and `keepLogTime`, replace each `onFinished()` with
  `leave()`.

Offline, `router.push` fetches the route payload of `/workouts`. The service worker
answers it from its cache. When the fetch fails, Next.js falls back to a document
load, which the service worker answers from its page cache. The e2e test "keeps every
set of a session logged offline through a finish and a reload" in
`tests/e2e/workout.spec.ts` proves this still works.

`app/(app)/workouts/page.tsx` "Start a session" still calls
`window.location.assign('/workout')`, unless B2 applied fix F5. It is outside this
step. Name it in the report under "Things to consider".

### The style guide entry

Test first, in `app/styleguide/page.test.tsx`:

```tsx
it('shows the Saved toast from its sample button', async () => {
  render(<StyleguidePage />)

  await userEvent.click(screen.getByRole('button', { name: 'Show the Saved toast' }))

  expect(screen.getByTestId('toast-region')).toHaveTextContent('Saved')
})
```

Then the code, in `app/styleguide/page.tsx`. Import
`{ SAVED_MESSAGE, useToast } from '../../components/ui/Toast'`. Add a component at the
end of the file:

```tsx
function ToastSample() {
  const toast = useToast()

  return (
    <SecondaryButton
      onClick={() => {
        toast.show(SAVED_MESSAGE)
      }}
    >
      Show the Saved toast
    </SecondaryButton>
  )
}
```

Render `<ToastSample />` in the `Card` of the "Buttons and the sheet" section, after
the "Open the sheet" button. The page renders inside `AppShell`, so the provider is
there.

### The end to end spec

`tests/e2e/saved-toast.spec.ts`:

```ts
import { expect, recordDay, test } from './support/signedIn'
import { benchCard, openLiveSession, pullOnlyThisWindow } from './support/workout'

test.use({ serviceWorkers: 'block' })

test.beforeEach(async ({ context, day }) => {
  await pullOnlyThisWindow(context, day)
})

test('shows Saved after a day is saved, then hides it', async ({ page }) => {
  await page.goto('/log')
  await expect(page.getByLabel('Gym time')).toBeVisible()

  await recordDay(page, { gym: '1:00:00', steps: '9000' })

  const toast = page.getByTestId('toast-region')
  await expect(toast).toHaveText('Saved')
  await expect(toast).toBeEmpty({ timeout: 4000 })
})

test('shows Saved after a set is edited, clear of the undo toast', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openLiveSession(page, context)

  await benchCard(page)
    .getByRole('button', { name: /^Edit set 1,/ })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Edit set 1' })
  await dialog.getByLabel('Reps').fill('10')
  await dialog.getByRole('button', { name: 'Save set' }).click()

  const toast = page.getByTestId('toast-region')
  await expect(toast).toHaveText('Saved')
  const saved = await toast.getByText('Saved').boundingBox()
  const undo = await page.getByTestId('undo-region').boundingBox()
  expect((saved?.y ?? 0) + (saved?.height ?? 0)).toBeLessThanOrEqual(undo?.y ?? 0)
})

test('finishes a session and opens /workouts with no page load', async ({ page, context }) => {
  await openLiveSession(page, context)
  await page.evaluate(() => {
    Object.assign(window, { stayedInTheApp: true })
  })

  await page.getByRole('button', { name: 'Finish session' }).click()
  await page
    .getByRole('dialog', { name: 'Session finished' })
    .getByRole('button', { name: 'Not now' })
    .click()

  await expect(page).toHaveURL(/\/workouts$/)
  await expect(page.getByRole('button', { name: 'Start a session' })).toBeVisible()
  expect(await page.evaluate(() => 'stayedInTheApp' in window)).toBe(true)
})
```

The empty undo region has no height, so its `y` is the line the undo toast grows up
from. The Saved toast must end above it.

The spec needs a hook on the undo region. Test first, in
`components/workout/UndoToast.test.tsx`:

```tsx
it('names its region for the end to end tests', () => {
  renderToast({ toast: null })

  expect(screen.getByRole('status')).toHaveAttribute('data-testid', 'undo-region')
})
```

Then add `data-testid="undo-region"` to the outer `role="status"` `div` in
`components/workout/UndoToast.tsx`.

## Acceptance criteria

- [ ] `Toast.tsx` exports `ToastProvider`, `useToast`, `TOAST_MS = 2000` and
      `SAVED_MESSAGE = 'Saved'`.
- [ ] The toast region has `role="status"`, stays in the page with no message, and
      clears 2 s after the last `show`.
- [ ] The toast sits at the top, above the sheet layer, and takes no tap.
- [ ] `AppShell` mounts the provider, with the region outside the page transition.
- [ ] A save in `/log`, in Targets, in the edit set sheet and in the rest time sheet
      shows "Saved". A failed save shows no toast.
- [ ] The Saved toast never overlaps the undo toast at 390 px.
- [ ] Finish moves to `/workouts` with `router.push`. `window.location.assign` is not
      called, and the window survives the move.
- [ ] `/styleguide` shows the toast from a sample button.

### The gate and the dependencies

- [ ] W0 and B3 are merged: every dependency check in "Before you start" prints `ok`.
- [ ] The owner answered the question in "Stop and ask the owner" before the Finish change. Manual check: the report names the answer.
- [ ] `tests/e2e/workout.spec.ts` "keeps every set of a session logged offline through a finish and a reload" passes. Manual check: "Verification", item 2.
- [ ] The `ui-reviewer` agent reports no drift on the changed files. Manual check: "Verification", item 3.
- [ ] The staged diff holds only the files in "Files touched". Manual check: `git diff --cached --stat`.
- [ ] `pnpm verify:parallel` passes. Manual check: "When the step is done", item 1.

## Tests

| Criterion | Test                                                                                    |
| --------- | --------------------------------------------------------------------------------------- |
| 1         | `Toast.test.tsx` "lasts 2 seconds", "says Saved", and the imports                       |
| 2         | `Toast.test.tsx` "shows the message…", "keeps the status region…", "hides…", "starts…"  |
| 3         | `Toast.test.tsx` "sits at the top…", "sits above an open sheet…"                        |
| 4         | `AppShell.test.tsx` "holds the Saved toast region outside the page transition"          |
| 5         | The 5 save tests in `DailyEntryForm`, `TargetsCard` and `LiveSession`. E2E, first test. |
| 6         | E2E "shows Saved after a set is edited, clear of the undo toast"                        |
| 7         | `LiveSession.test.tsx` "moves to the workouts screen inside the app…". E2E, third test. |
| 8         | `app/styleguide/page.test.tsx` "shows the Saved toast from its sample button"           |

## Verification

1. `pnpm test -- components/ui components/workout components/DailyEntryForm.test.tsx components/profile app/styleguide`.
2. `node scripts/e2e-lock.mjs pnpm exec playwright test tests/e2e/saved-toast.spec.ts tests/e2e/workout.spec.ts`.
3. The `ui-reviewer` agent on the changed files.
4. `/log` and `/workout` at 390, 768 and 1440 px with the toast showing, by eye.
5. `pnpm verify:parallel`.

## Files touched

- `components/ui/Toast.tsx` and its test (new)
- `components/ui/AppShell.tsx` and its test
- `components/DailyEntryForm.tsx` and its test
- `components/profile/TargetsCard.tsx` and its test
- `components/workout/LiveSession.tsx` and its test
- `app/(app)/workout/page.test.tsx`
- `app/styleguide/page.tsx` and its test
- `tests/e2e/saved-toast.spec.ts` (new)

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer when another step runs its e2e suite. Never skip a check, and never add a design-check or test exemption to pass.
2. Stage the files from "Files touched", including the tests. Then run the `commit-report` skill. The skill reports on the staged diff, so stage first:
   ```bash
   git add components/ui/Toast.tsx components/ui/Toast.test.tsx components/ui/AppShell.tsx components/ui/AppShell.test.tsx components/DailyEntryForm.tsx components/DailyEntryForm.test.tsx components/profile/TargetsCard.tsx components/profile/TargetsCard.test.tsx components/workout/LiveSession.tsx components/workout/LiveSession.test.tsx components/workout/UndoToast.tsx 'app/(app)/workout/page.test.tsx' app/styleguide/page.tsx app/styleguide/page.test.tsx tests/e2e/saved-toast.spec.ts
   ```
   The report needs screenshots of every changed page at 390, 768 and 1440 px, next to the matching prototype plate: `/log` with the Saved toast next to the prototype's Log screen, and `/workout` with the Saved toast and an undo toast together at 390 px. "Things to consider" names "Start a session" in `app/(app)/workouts/page.tsx` if it still calls `window.location.assign`, and the owner answer from "Stop and ask the owner".
3. Commit on `fix/b4-saved-toast`. This step file tells you to commit, so you commit, not the owner:
   ```bash
   git commit -m "feat(ui): show a saved toast and finish a session with no reload"
   ```
   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.
4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked, and anything the owner must check on the iPhone. For this step: "Saved" shows at the top after each save, and Finish opens `/workouts` with no white flash, online and offline.
