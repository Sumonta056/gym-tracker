# Step B3 — The sheet: portal, iOS scroll lock, keyboard

**Branch:** `fix/b3-sheet-portal`, in worktree `../gym-tracker-b3`, cut from `fix/feedback-fixes` · **Wave:** 3 · **Size:** M · **Depends on:** W0, B2 (and B1 through B2) · **Unlocks:** B4, E2 · **Skill to load:** `design-system` · **Agent to use:** `ui-reviewer`

## Before you start

### 1. The worktree

```bash
cd /Users/cefalo_1/Documents/Projects/gym-tracker
git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-b3 -b fix/b3-sheet-portal fix/feedback-fixes
cd ../gym-tracker-b3
cp ../gym-tracker/.env.local ../gym-tracker/.env.test.local .
export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"
pnpm install
```

If you are already in that worktree on that branch, skip this block. Run every later
command from `../gym-tracker-b3`.

### 2. Dependency checks

Run this from the worktree. Each line prints `ok` or `FAIL` and the step it belongs to.

```bash
check() { if sh -c "$2" >/dev/null 2>&1; then echo "ok   $1"; else echo "FAIL $1: $2"; fi; }
check W0 'test -f scripts/e2e-lock.mjs'
check W0 'grep -q verify:parallel package.json'
check B2 'git log --oneline fix/feedback-fixes | grep -qF "fix(ui): keep the /workout layout inside the phone screen"'
check B2 'grep -qF "project: string }[] = []" tests/e2e/workout-layout.spec.ts'
```

If any check fails, the step it names is not merged into `fix/feedback-fixes`. Stop. Report which check
failed. Do not do that step's work here.

### 3. Already done check

```bash
git cat-file -e HEAD:tests/e2e/sheet.spec.ts 2>/dev/null && echo "B3 is already done"
```

If it prints that the step is already done, stop and report.

### 4. Every e2e run goes through the lock

Other steps run at the same time in other worktrees. They share port 3100 and the test
account. Start every Playwright run with `node scripts/e2e-lock.mjs`, for example
`node scripts/e2e-lock.mjs pnpm exec playwright test tests/e2e/<file>.spec.ts`. The lock
waits while another worktree runs its e2e suite.

## Names this step uses from earlier steps

- `components/ui/SheetModal.tsx` keeps its props, exactly:
  ```ts
  export type SheetModalProps = {
    open: boolean
    title: string
    onClose: () => void
    children: ReactNode
    footer?: ReactNode
    className?: string
    closeDisabled?: boolean
  }
  ```
- B2 may already have changed `SheetModal`. Look before you write:
  - Fix F4 adds `focus({ preventScroll: true })` on open and on close. The code below
    keeps it.
  - Fix F2a may have moved `SheetModal` into a `createPortal` on `document.body`. If so,
    the code below replaces it whole. Keep 1 portal, never 2.
- `tests/e2e/workout-layout.spec.ts` from B1 and B2. It passes with an empty
  `KNOWN_BREAKS`. It must still pass after this step.
- B4 builds on this step: the sheet overlay stays `fixed inset-0 z-50`, so the B4 toast
  at `z-[60]` sits above it.

## Context to read first

1. `docs/specs/2026-10-05-feedback-fixes-design.md`, section 3.6 "The sheet", item 2,
   and the risk "The F3 portal breaks the focus trap of the sheet".
2. "Names this step uses from earlier steps", above. `SheetModal` keeps its props.
3. `.claude/skills/design-system/references/components.md`, the sheet recipe. Load the
   skill.
4. `.claude/rules/accessibility.md`, rules 2 and 3.
5. `components/ui/SheetModal.tsx` and `components/ui/SheetModal.test.tsx`.
6. `components/workout/EditSetSheet.tsx`, `components/workout/RestTimeSheet.tsx` and
   `components/workout/CreateExerciseForm.tsx` (`CreateExerciseActions`, the
   `form={formId}` pattern).
7. `tests/e2e/support/workout.ts`, `openLiveSession` and `openPicker`.

## State before the step

- `SheetModal` renders in place. In `LiveSession` that place is inside the
  `PageTransition` `motion.div`. A transform on that frame moves a `position: fixed`
  child with it.
- The scroll lock sets only `document.body.style.overflow = 'hidden'`. iOS Safari
  ignores it, so the page behind the sheet scrolls.
- The overlay is `fixed inset-0`. When the iOS keyboard opens, the layout viewport
  keeps its height, so the bottom of the sheet sits under the keyboard.
- The sheet with no footer scrolls with `overflow-y-auto` and no
  `overscroll-contain`, so a scroll at its end runs on into the page.
- `EditSetSheet` and `RestTimeSheet` keep their Save button at the end of the
  scrolling body. Under the keyboard it is out of view.

## Goal

Every sheet renders in a portal on `document.body`. The page behind it never scrolls
on iOS and comes back to the same place on close. The panel follows the visual
viewport, so the footer and its Save button stay above the keyboard. The focus trap
and Escape still work.

## Do

1. Load the `design-system` skill.
2. Write the unit tests below in `components/ui/SheetModal.test.tsx`. Run them. They
   fail.
3. Replace `components/ui/SheetModal.tsx` with the code below. The tests pass. The
   existing tests for focus, the trap, Escape and the classes pass with no change.
4. Move the Save buttons of `EditSetSheet` and `RestTimeSheet` into the `footer`,
   test first.
5. Write `tests/e2e/sheet.spec.ts`. Run it on all 3 projects.
   The existing tests "locks the page scroll while open and restores it on close" and
   "locks the page scroll with a footer too" still pass: the lock still sets
   `overflow: hidden` and puts the old value back.
6. If B2 already applied fix F4 (`focus({ preventScroll: true })`), keep it. The code
   below holds it too.

### The unit tests

Add `act` to the `@testing-library/react` import and `afterEach` to the `vitest`
import. Add at the top of the file, after the imports:

```tsx
class FakeViewport extends EventTarget {
  height = 844
  offsetTop = 0
}

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value })
}

afterEach(() => {
  setScrollY(0)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
```

Add this describe:

```tsx
describe('SheetModal on a phone', () => {
  it('renders into document.body, outside the parent that holds it', () => {
    render(
      <div data-testid="frame">
        <SheetModal open title="Log a set" onClose={vi.fn()}>
          <p>Sheet body</p>
        </SheetModal>
      </div>,
    )

    expect(screen.getByTestId('frame')).not.toContainElement(screen.getByRole('dialog'))
    expect(screen.getByTestId('sheet-overlay').parentElement).toBe(document.body)
  })

  it('fixes the body at the scroll offset while open, which iOS respects', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    setScrollY(240)
    setup()

    expect(document.body.style.position).toBe('fixed')
    expect(document.body.style.top).toBe('-240px')
    expect(document.body.style.width).toBe('100%')
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('puts the page back at the same scroll offset on close', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    setScrollY(240)
    const { rerender } = render(
      <SheetModal open title="Log a set" onClose={vi.fn()}>
        <p>Sheet body</p>
      </SheetModal>,
    )

    rerender(
      <SheetModal open={false} title="Log a set" onClose={vi.fn()}>
        <p>Sheet body</p>
      </SheetModal>,
    )

    expect(document.body.style.position).toBe('')
    expect(document.body.style.top).toBe('')
    expect(scrollTo).toHaveBeenCalledWith(0, 240)
  })

  it('keeps the body fixed until the last of 2 open sheets closes', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    setScrollY(120)
    const { rerender } = render(
      <>
        <SheetModal open title="First" onClose={vi.fn()}>
          <p>One</p>
        </SheetModal>
        <SheetModal open title="Second" onClose={vi.fn()}>
          <p>Two</p>
        </SheetModal>
      </>,
    )

    rerender(
      <>
        <SheetModal open title="First" onClose={vi.fn()}>
          <p>One</p>
        </SheetModal>
        <SheetModal open={false} title="Second" onClose={vi.fn()}>
          <p>Two</p>
        </SheetModal>
      </>,
    )

    expect(document.body.style.position).toBe('fixed')
    expect(document.body.style.top).toBe('-120px')
  })

  it('pins the overlay to the visual viewport', () => {
    vi.stubGlobal('visualViewport', new FakeViewport())
    setup()

    const overlay = screen.getByTestId('sheet-overlay')
    expect(overlay.style.top).toBe('0px')
    expect(overlay.style.height).toBe('844px')
  })

  it('follows the visual viewport when the keyboard opens, so the footer stays above it', () => {
    const viewport = new FakeViewport()
    vi.stubGlobal('visualViewport', viewport)
    setup()

    act(() => {
      viewport.height = 500
      viewport.offsetTop = 120
      viewport.dispatchEvent(new Event('resize'))
    })

    const overlay = screen.getByTestId('sheet-overlay')
    expect(overlay.style.top).toBe('120px')
    expect(overlay.style.height).toBe('500px')
  })

  it('fills the screen with no inline size where the browser has no visual viewport', () => {
    setup()

    const overlay = screen.getByTestId('sheet-overlay')
    expect(overlay).toHaveClass('fixed', 'inset-0')
    expect(overlay.style.height).toBe('')
  })

  it('contains the overscroll of a sheet with no footer', () => {
    setup()

    expect(screen.getByRole('dialog')).toHaveClass('overflow-y-auto', 'overscroll-contain')
  })

  it('contains the overscroll of the body of a sheet with a footer', () => {
    render(
      <SheetModal open title="Log a set" onClose={vi.fn()} footer={<p>Footer</p>}>
        <p>Sheet body</p>
      </SheetModal>,
    )

    expect(screen.getByTestId('sheet-body')).toHaveClass('overflow-y-auto', 'overscroll-contain')
  })

  it('still closes on Escape from inside the portal', async () => {
    const { onClose } = setup()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('still keeps focus inside the portal on tab and shift tab', async () => {
    render(
      <SheetModal open title="Log a set" onClose={vi.fn()}>
        <button type="button">Save</button>
      </SheetModal>,
    )
    const close = screen.getByRole('button', { name: 'Close Log a set' })
    const save = screen.getByRole('button', { name: 'Save' })

    await userEvent.tab()
    expect(save).toHaveFocus()
    await userEvent.tab()
    expect(close).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(save).toHaveFocus()
  })
})
```

### The code

`components/ui/SheetModal.tsx`:

```tsx
'use client'

import { useEffect, useId, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

import { cn } from './cn'

import type { ReactNode } from 'react'

export type SheetModalProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  className?: string
  closeDisabled?: boolean
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusables(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
}

function trapTab(event: KeyboardEvent, dialog: HTMLElement): void {
  const items = focusables(dialog)
  const first = items[0]
  const last = items.at(-1)
  if (first === undefined || last === undefined) {
    event.preventDefault()
    return
  }

  event.preventDefault()
  const at = items.findIndex((item) => item === document.activeElement)

  if (at === -1) {
    ;(event.shiftKey ? last : first).focus({ preventScroll: true })
    return
  }

  const step = event.shiftKey ? -1 : 1
  const next = items[(at + step + items.length) % items.length] ?? first
  next.focus({ preventScroll: true })
}

type HeldBodyStyle = {
  position: string
  top: string
  left: string
  right: string
  width: string
  overflow: string
}

let lockHolders = 0

let releaseBody: (() => void) | null = null

function fixBody(): () => void {
  const { style } = document.body
  const scrollY = window.scrollY
  const held: HeldBodyStyle = {
    position: style.position,
    top: style.top,
    left: style.left,
    right: style.right,
    width: style.width,
    overflow: style.overflow,
  }

  style.position = 'fixed'
  style.top = `-${String(scrollY)}px`
  style.left = '0'
  style.right = '0'
  style.width = '100%'
  style.overflow = 'hidden'

  return () => {
    Object.assign(style, held)
    window.scrollTo(0, scrollY)
  }
}

export function lockScroll(): () => void {
  lockHolders += 1

  if (lockHolders === 1) {
    releaseBody = fixBody()
  }

  let released = false

  return () => {
    if (released) {
      return
    }

    released = true
    lockHolders -= 1

    if (lockHolders === 0) {
      releaseBody?.()
      releaseBody = null
    }
  }
}

function visualViewport(): VisualViewport | null {
  return 'visualViewport' in window ? window.visualViewport : null
}

function subscribeViewport(onChange: () => void): () => void {
  const viewport = visualViewport()

  if (viewport === null) {
    return () => undefined
  }

  viewport.addEventListener('resize', onChange)
  viewport.addEventListener('scroll', onChange)

  return () => {
    viewport.removeEventListener('resize', onChange)
    viewport.removeEventListener('scroll', onChange)
  }
}

function viewportHeight(): number | null {
  return visualViewport()?.height ?? null
}

function viewportTop(): number {
  return visualViewport()?.offsetTop ?? 0
}

function noHeight(): number | null {
  return null
}

function noTop(): number {
  return 0
}

export function SheetModal({
  open,
  title,
  onClose,
  children,
  footer,
  className,
  closeDisabled = false,
}: SheetModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const closeDisabledRef = useRef(closeDisabled)
  const height = useSyncExternalStore(subscribeViewport, viewportHeight, noHeight)
  const offsetTop = useSyncExternalStore(subscribeViewport, viewportTop, noTop)

  useEffect(() => {
    onCloseRef.current = onClose
    closeDisabledRef.current = closeDisabled
  }, [onClose, closeDisabled])

  useLayoutEffect(() => {
    if (!open) {
      return
    }

    const dialog = dialogRef.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const unlock = lockScroll()

    if (dialog !== null) {
      ;(focusables(dialog)[0] ?? dialog).focus({ preventScroll: true })
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (!closeDisabledRef.current) onCloseRef.current()
        return
      }

      if (event.key === 'Tab' && dialog !== null) {
        trapTab(event, dialog)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      unlock()
      opener?.focus({ preventScroll: true })
    }
  }, [open])

  if (!open || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      data-testid="sheet-overlay"
      className="fixed inset-0 z-50 flex items-end justify-center lg:items-center"
      style={height === null ? undefined : { top: offsetTop, height, bottom: 'auto' }}
    >
      <button
        type="button"
        aria-label="Close"
        disabled={closeDisabled}
        onClick={onClose}
        className="bg-ground/70 absolute inset-0 h-full w-full"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'bg-surface border-border rounded-t-hero relative max-h-[78%] w-full border-t pt-2.5',
          'lg:rounded-hero lg:max-h-[80vh] lg:w-[520px] lg:border lg:pt-5',
          footer === undefined
            ? 'overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] lg:pb-5'
            : 'flex flex-col overflow-hidden',
          className,
        )}
      >
        <div className={footer === undefined ? undefined : 'shrink-0 px-5'}>
          <div
            data-testid="sheet-grabber"
            aria-hidden="true"
            className="bg-border mx-auto mt-1 mb-3 h-1 w-10 rounded-full lg:hidden"
          />
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 id={titleId} className="text-text text-lg font-extrabold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={closeDisabled}
              aria-label={`Close ${title}`}
              className="text-muted bg-surface-2 border-border inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-lg disabled:opacity-50"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>
        {footer === undefined ? (
          children
        ) : (
          <>
            <div
              data-testid="sheet-body"
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-1"
            >
              {children}
            </div>
            <div
              data-testid="sheet-footer"
              className="shrink-0 px-5 pt-2 pb-[calc(env(safe-area-inset-bottom)+20px)] lg:pb-5"
            >
              {footer}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
```

Why each part:

- `createPortal(…, document.body)`: the sheet leaves the `PageTransition` frame. A
  transform on that frame can no longer move it.
- `lockScroll` fixes the body at `-scrollY`. iOS cannot scroll a fixed body. On close
  it puts the old inline styles back and scrolls to the old offset. The count keeps
  the body fixed while a second sheet is still open.
- `useSyncExternalStore` reads `window.visualViewport`. When the keyboard opens, the
  visual viewport gets shorter and may move down. The overlay takes its `top` and
  `height`, so `items-end` puts the panel, and its footer, on top of the keyboard.
  `max-h-[78%]` is now 78 % of the visible part.
- With no visual viewport (an old browser, or jsdom), the overlay keeps `fixed
inset-0`, as before.
- `focus({ preventScroll: true })`: iOS does not scroll the page to the focused
  element.

### Save in the footer

Test first, in `components/workout/EditSetSheet.test.tsx`:

```tsx
it('keeps Save and Delete in the sheet footer, so they stay above the keyboard', () => {
  renderSheet()

  const footer = screen.getByTestId('sheet-footer')
  const save = within(footer).getByRole('button', { name: 'Save set' })
  expect(within(footer).getByRole('button', { name: 'Delete set' })).toBeInTheDocument()
  expect(save).toHaveAttribute('type', 'submit')
  expect(document.getElementById(save.getAttribute('form') ?? '')).toBeInstanceOf(HTMLFormElement)
})
```

`renderSheet` is the render helper already in that file.

In `components/workout/RestTimeSheet.test.tsx`. Add `within` to the
`@testing-library/react` import:

```tsx
it('keeps Save rest time in the sheet footer, so it stays above the keyboard', () => {
  renderSheet()

  const save = within(screen.getByTestId('sheet-footer')).getByRole('button', {
    name: 'Save rest time',
  })
  expect(save).toHaveAttribute('type', 'submit')
  expect(document.getElementById(save.getAttribute('form') ?? '')).toBeInstanceOf(HTMLFormElement)
})
```

Then the code. `components/workout/EditSetSheet.tsx`: add `useId` to the `react`
import. Replace `EditSetSheet` and the end of `EditSetForm`:

```tsx
export function EditSetSheet({
  editing,
  unit,
  busy = false,
  error = null,
  onSave,
  onDelete,
  onClose,
}: EditSetSheetProps) {
  const formId = useId()

  return (
    <SheetModal
      open={editing !== null}
      title={editing === null ? '' : editTitle(editing.position)}
      onClose={onClose}
      footer={
        editing === null ? undefined : (
          <div className="flex flex-col gap-3">
            <PrimaryButton type="submit" form={formId} disabled={busy}>
              Save set
            </PrimaryButton>
            <SecondaryButton tone="danger" disabled={busy} onClick={onDelete}>
              Delete set
            </SecondaryButton>
          </div>
        )
      }
    >
      {editing === null ? null : (
        <EditSetForm
          key={editing.set.id}
          id={formId}
          editing={editing}
          unit={unit}
          error={error}
          onSave={onSave}
        />
      )}
    </SheetModal>
  )
}

type EditSetFormProps = {
  id: string
  editing: EditingSet
  unit: UnitSystem
  error: string | null
  onSave: (values: SetValues) => void
}

function EditSetForm({ id, editing, unit, error, onSave }: EditSetFormProps) {
```

In `EditSetForm`, put `id={id}` on the `<form>`, and delete the `PrimaryButton` and
the `SecondaryButton` at its end. The `<p role="alert">` stays inside the form.

`components/workout/RestTimeSheet.tsx`: the same move. Add `useId`. In
`RestTimeSheet`:

```tsx
const formId = useId()

return (
  <SheetModal
    open={changing !== null}
    title={changing === null ? '' : restSheetTitle(changing.exerciseName)}
    onClose={onClose}
    footer={
      changing === null ? undefined : (
        <PrimaryButton type="submit" form={formId} disabled={busy}>
          Save rest time
        </PrimaryButton>
      )
    }
  >
    {changing === null ? null : (
      <RestTimeForm
        key={changing.exerciseId}
        id={formId}
        changing={changing}
        error={error}
        onSave={onSave}
      />
    )}
  </SheetModal>
)
```

`RestTimeFormProps` gets `id: string` and loses `busy`. The `<form>` gets `id={id}`.
The `PrimaryButton` at its end goes.

The tests in `LiveSession.test.tsx` that press "Save set" and "Save rest time" find
them `within(dialog)`. The footer is inside the dialog, so they pass with no change.

### The end to end spec

`tests/e2e/sheet.spec.ts`:

```ts
import { expect, test } from './support/signedIn'
import {
  benchCard,
  openLiveSession,
  openPicker,
  pickerDialog,
  pullOnlyThisWindow,
} from './support/workout'

import type { Locator, Page } from '@playwright/test'

const TAB_PRESSES = 12

test.use({ serviceWorkers: 'block' })

test.beforeEach(async ({ context, day }) => {
  await pullOnlyThisWindow(context, day)
})

async function openEdit(page: Page): Promise<Locator> {
  await benchCard(page)
    .getByRole('button', { name: /^Edit set 1,/ })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Edit set 1' })
  await expect(dialog).toBeVisible()
  return dialog
}

async function focusLeaks(page: Page): Promise<string[]> {
  const leaks: string[] = []
  for (let press = 0; press < TAB_PRESSES; press += 1) {
    await page.keyboard.press(press % 3 === 2 ? 'Shift+Tab' : 'Tab')
    const inside = await page.evaluate(
      () => document.activeElement?.closest('[role="dialog"]') !== null,
    )
    if (!inside) leaks.push(`press ${String(press + 1)}`)
  }
  return leaks
}

test.describe('the sheet on /workout', () => {
  test.beforeEach(async ({ page, context }) => {
    await openLiveSession(page, context)
  })

  test('renders the sheet as a child of the body, outside the page frame', async ({ page }) => {
    await openEdit(page)

    const placement = await page.evaluate(() => {
      const overlay = document.querySelector('[data-testid="sheet-overlay"]')
      return {
        onBody: overlay?.parentElement === document.body,
        inFrame: overlay?.closest('[data-testid="page-transition"]') !== null,
      }
    })

    expect(placement).toEqual({ onBody: true, inFrame: false })
  })

  test('keeps the page still behind the sheet and returns to the same place', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 500 })
    await page.evaluate(() => {
      window.scrollTo(0, 200)
    })
    const before = await page.evaluate(() => window.scrollY)
    const cardTop = (await benchCard(page).boundingBox())?.y

    await openEdit(page)
    await page.evaluate(() => {
      window.scrollBy(0, 400)
    })

    expect((await benchCard(page).boundingBox())?.y).toBe(cardTop)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(await page.evaluate(() => window.scrollY)).toBe(before)
  })

  test('keeps the footer and its Save button inside the visible area when the viewport shrinks', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const dialog = await openEdit(page)
    await dialog.getByLabel('Reps').focus()

    await page.setViewportSize({ width: 390, height: 420 })

    const save = dialog.getByRole('button', { name: 'Save set' })
    await expect(save).toBeInViewport()
    const box = await page.getByTestId('sheet-footer').boundingBox()
    const visible = await page.evaluate(() => window.visualViewport?.height ?? window.innerHeight)
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(visible + 1)
  })

  test('keeps focus inside the edit set sheet', async ({ page }) => {
    await openEdit(page)

    expect(await focusLeaks(page)).toEqual([])
  })

  test('keeps focus inside the rest time sheet', async ({ page }) => {
    await page
      .getByRole('region', { name: 'Rest timer' })
      .getByRole('button', { name: 'Change the rest time for Bench Press' })
      .click()
    await expect(page.getByRole('dialog', { name: 'Rest for Bench Press' })).toBeVisible()

    expect(await focusLeaks(page)).toEqual([])
  })

  test('keeps focus inside the exercise picker', async ({ page }) => {
    await openPicker(page)
    await expect(pickerDialog(page)).toBeVisible()

    expect(await focusLeaks(page)).toEqual([])
  })

  test('closes on Escape from inside the portal', async ({ page }) => {
    await openEdit(page)

    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})

test('keeps focus inside the style guide sheet', async ({ page }) => {
  await page.goto('/styleguide')
  await page.getByRole('button', { name: 'Open the sheet' }).click()
  await expect(page.getByRole('dialog', { name: 'Log a set' })).toBeVisible()

  expect(await focusLeaks(page)).toEqual([])
})
```

The focus return to the opener is proved by the existing unit tests, not here.
WebKit does not focus a button on a click, so the opener there is the body.

On a phone project, `setViewportSize` shrinks the visual viewport the way the
keyboard does. That is as close as Playwright gets to the iOS keyboard. The owner
checks the real keyboard at the checkpoint.

The last test needs no account, but the file's `test` is the signed-in fixture.
`/styleguide` renders with or without a session, so it runs the same.

## Acceptance criteria

- [ ] Every sheet renders as a child of `document.body`, outside the page frame.
- [ ] While a sheet is open, the body is fixed at `-scrollY`, so iOS cannot scroll the
      page behind it.
- [ ] On close, the page is back at the same scroll offset and the old body styles
      return.
- [ ] With 2 sheets open, the body stays fixed until the last one closes.
- [ ] The overlay follows `visualViewport` height and `offsetTop`. The footer and its
      Save button stay inside the visible area when the viewport shrinks.
- [ ] Both sheet bodies have `overscroll-contain`.
- [ ] `EditSetSheet` and `RestTimeSheet` hold their Save button in the footer.
- [ ] Tab and Shift Tab never leave an open sheet. Escape closes it and gives focus
      back to the opener.
- [ ] `tests/e2e/responsive.spec.ts` and `tests/e2e/workout-layout.spec.ts` still
      pass.

### The gate and the dependencies

- [ ] W0 and B2 are merged: every dependency check in "Before you start" prints `ok`.
- [ ] The overlay keeps `z-50`, and there is 1 portal only, even if B2 already added one. Test: unit "renders into document.body…".
- [ ] The `ui-reviewer` agent reports no drift on the changed files. Manual check: "Verification", item 3.
- [ ] The staged diff holds only the files in "Files touched". Manual check: `git diff --cached --stat`.
- [ ] `pnpm verify:parallel` passes. Manual check: "When the step is done", item 1.

## Tests

| Criterion | Test                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | Unit "renders into document.body…". E2E "renders the sheet as a child of the body…".                                                                    |
| 2         | Unit "fixes the body at the scroll offset…". E2E "keeps the page still behind the sheet…".                                                              |
| 3         | Unit "puts the page back at the same scroll offset on close". E2E, the same test.                                                                       |
| 4         | Unit "keeps the body fixed until the last of 2 open sheets closes".                                                                                     |
| 5         | Unit "pins the overlay…" and "follows the visual viewport…". E2E "keeps the footer and its Save button…".                                               |
| 6         | Unit "contains the overscroll…", twice.                                                                                                                 |
| 7         | Unit "keeps Save … in the sheet footer", in both sheet test files.                                                                                      |
| 8         | Unit "still closes on Escape…", "still keeps focus inside…", and the existing focus return tests. E2E "keeps focus inside…" ×4 and "closes on Escape…". |
| 9         | The 2 existing specs.                                                                                                                                   |

## Verification

1. `pnpm test -- components/ui/SheetModal.test.tsx components/workout`.
2. `node scripts/e2e-lock.mjs pnpm exec playwright test tests/e2e/sheet.spec.ts tests/e2e/responsive.spec.ts tests/e2e/workout-layout.spec.ts`.
3. The `ui-reviewer` agent on the changed files.
4. The edit set sheet and the exercise picker at 390, 768 and 1440 px, by eye.
5. `pnpm verify:parallel`.

## Files touched

- `components/ui/SheetModal.tsx` and its test
- `components/workout/EditSetSheet.tsx` and its test
- `components/workout/RestTimeSheet.tsx` and its test
- `tests/e2e/sheet.spec.ts` (new)

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer when another step runs its e2e suite. Never skip a check, and never add a design-check or test exemption to pass.
2. Stage the files from "Files touched", including the tests. Then run the `commit-report` skill. The skill reports on the staged diff, so stage first:
   ```bash
   git add components/ui/SheetModal.tsx components/ui/SheetModal.test.tsx components/workout/EditSetSheet.tsx components/workout/EditSetSheet.test.tsx components/workout/RestTimeSheet.tsx components/workout/RestTimeSheet.test.tsx tests/e2e/sheet.spec.ts
   ```
   The report needs screenshots of every changed page at 390, 768 and 1440 px, next to the matching prototype plate: the open edit set sheet and the open exercise picker on `/workout`, next to the prototype's sheet plate. Add 1 screenshot of the edit set sheet at 390 × 420 px, to show the footer above the shrunk viewport.
3. Commit on `fix/b3-sheet-portal`. This step file tells you to commit, so you commit, not the owner:
   ```bash
   git commit -m "fix(ui): render the sheet in a portal with an ios scroll lock"
   ```
   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.
4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked, and anything the owner must check on the iPhone. For this step: the page behind an open sheet does not scroll, it comes back to the same place on close, and Save stays above the real keyboard in the edit set sheet.
