# Step B2 — Fix the `/workout` layout

**Branch:** `fix/b2-fix-workout-layout`, in worktree `../gym-tracker-b2`, cut from `fix/feedback-fixes` · **Wave:** 2 · **Size:** M · **Depends on:** W0, B1 · **Unlocks:** B3, B5 · **Skill to load:** `design-system` · **Agent to use:** `ui-reviewer`

## Before you start

### 1. The worktree

```bash
cd /Users/cefalo_1/Documents/Projects/gym-tracker
git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-b2 -b fix/b2-fix-workout-layout fix/feedback-fixes
cd ../gym-tracker-b2
cp ../gym-tracker/.env.local ../gym-tracker/.env.test.local .
export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"
pnpm install
```

If you are already in that worktree on that branch, skip this block. Run every later
command from `../gym-tracker-b2`.

### 2. Dependency checks

Run this from the worktree. Each line prints `ok` or `FAIL` and the step it belongs to.

```bash
check() { if sh -c "$2" >/dev/null 2>&1; then echo "ok   $1"; else echo "FAIL $1: $2"; fi; }
check W0 'test -f scripts/e2e-lock.mjs'
check W0 'grep -q verify:parallel package.json'
check B1 'test -f tests/e2e/workout-layout.spec.ts'
check B1 'grep -q KNOWN_BREAKS tests/e2e/workout-layout.spec.ts'
check B1 '! grep -qE "^[|] S1 +[|] +[|] +[|]$" docs/plan/feedback/B1-reproduce-workout.md'
```

If any check fails, the step it names is not merged into `fix/feedback-fixes`. Stop. Report which check
failed. Do not do that step's work here.

### 3. Already done check

```bash
git log --oneline | grep -qF "fix(ui): keep the /workout layout inside the phone screen" && echo "B2 is already done"
```

If it prints that the step is already done, stop and report.

### 4. Every e2e run goes through the lock

Other steps run at the same time in other worktrees. They share port 3100 and the test
account. Start every Playwright run with `node scripts/e2e-lock.mjs`, for example
`node scripts/e2e-lock.mjs pnpm exec playwright test tests/e2e/<file>.spec.ts`. The lock
waits while another worktree runs its e2e suite.

## Names this step uses from earlier steps

B1 made these. The dependency checks prove they are on `fix/feedback-fixes`.

- `tests/e2e/workout-layout.spec.ts`, with:
  ```ts
  type Scenario = 'no session' | 'a new session' | 'a set logged' | 'the Resume link' | 'a reload'
  const KNOWN_BREAKS: readonly { scenario: Scenario; project: string }[] = [...]
  function probe(page: Page): Promise<Probe>
  function problems(found: Probe): string[]
  ```
  It checks 5 scenarios at 320, 375, 390 and 430 px, at the top and the foot of the page.
- `docs/plan/feedback/B1-reproduce-workout.md`, the **Findings** section: the root cause,
  each suspect S1 to S6 marked confirmed or ruled out, and "The fix B2 should apply",
  which names the fix ids F1 to F6 of this file.
- The Playwright projects are `mobile-safari`, `mobile-chrome` and `desktop`.

## Stop and ask the owner

Read **Findings** first. 2 of the candidate fixes change a choice the owner made. Before
you apply either one, stop, report, and wait for the answer. Do not choose for the owner.

1. **F2b** (the page frame moves only its opacity). Ask: "B1 found that the page
   transition transform moves fixed elements on `/workout`. Fix F2b makes every page
   fade in with no 8 px rise. This changes the motion contract. May I apply it?"
2. **F5** ("Start a session" uses `router.push`). Ask: "Start a session loads `/workout`
   as a full document today, on purpose, so it opens offline from the cache. Fix F5
   moves inside the app with `router.push`. The offline e2e test in
   `tests/e2e/workout.spec.ts` still guards it. May I apply it?"

If Findings names neither, do not ask. Apply the other fixes. If the owner says no to a
fix, leave it out and name the answer in the report under "Things to consider".

## Context to read first

1. `docs/plan/feedback/B1-reproduce-workout.md`, the **Findings** section. It names
   the cause and the candidate fixes to apply. Read it first.
2. `.claude/skills/design-system/SKILL.md` and `references/responsive.md`. Load the
   skill.
3. `.claude/rules/accessibility.md`.
4. `tests/e2e/workout-layout.spec.ts` from B1. "Names this step uses from earlier steps",
   above, lists its parts.
5. Only the source files that the chosen fixes below name.

## State before the step

`tests/e2e/workout-layout.spec.ts` fails for the cause in B1's **Findings**. Each
failing scenario and project pair is in `KNOWN_BREAKS`, so it reports as an expected
failure.

## Goal

`/workout` stays inside the phone screen in every B1 scenario. The bottom bar stays
fixed at the foot of the screen. `KNOWN_BREAKS` is empty and the spec passes.

## Do

1. Load the `design-system` skill.
2. Empty `KNOWN_BREAKS` in `tests/e2e/workout-layout.spec.ts`:
   ```ts
   const KNOWN_BREAKS: readonly { scenario: Scenario; project: string }[] = []
   ```
   Run the spec. It now fails for real. This is the red test.
3. Apply only the candidate fixes that B1's **Findings** names, below. Each fix
   starts with its unit test. Write the test, watch it fail, then change the code.
4. If **Findings** names a cause that no candidate covers, write the fix that
   **Findings** gives, with a unit test of the same shape. Follow the rules at the end
   of this section.
5. Run the spec again. It passes on all 3 projects.
6. Run `tests/e2e/responsive.spec.ts`. It passes with no change to it.
7. Check `/workout` at 390, 768 and 1440 px by eye, with a set logged.

Rules for any fix:

- Mobile first. Change the base class. Add `md:` and `lg:` only upward.
- Never hide an overflow with `overflow-hidden` on a text box. The `clippedText` check
  in `responsive.spec.ts` fails on it, and it hides a value the user must read.
- A flex child that holds text gets `min-w-0`, and its text gets `break-words`. Never a
  fixed pixel width.
- No raw hex, no `rgb()`, a `type` on every `<button>`, 44 px targets.

### Fix F1 — the Resume prompt never shows on `/workout` (suspect S1)

Test first, in `components/workout/ResumePrompt.test.tsx`. Add `act` to the
`@testing-library/react` import.

```tsx
describe('ResumePrompt on the live session', () => {
  it('closes the prompt when the page moves to the live session', async () => {
    await runningSession()
    const onDiscarded = vi.fn()
    const { rerender } = render(<ResumePrompt onDiscarded={onDiscarded} />)
    await prompt()

    navigation.pathname = WORKOUT_PATH
    rerender(<ResumePrompt onDiscarded={onDiscarded} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('never opens on the live session when the read ends after the move', async () => {
    await runningSession()
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const source: ResumeSource = {
      ...REPOSITORY_RESUME_SOURCE,
      getActiveSession: async () => {
        await gate
        return getActiveSession()
      },
    }
    const onDiscarded = vi.fn()
    const { rerender } = render(<ResumePrompt source={source} onDiscarded={onDiscarded} />)

    navigation.pathname = WORKOUT_PATH
    rerender(<ResumePrompt source={source} onDiscarded={onDiscarded} />)
    await act(async () => {
      release()
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
    })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('stays closed after the user leaves the live session again', async () => {
    await runningSession()
    const onDiscarded = vi.fn()
    const { rerender } = render(<ResumePrompt onDiscarded={onDiscarded} />)
    await prompt()

    navigation.pathname = WORKOUT_PATH
    rerender(<ResumePrompt onDiscarded={onDiscarded} />)
    navigation.pathname = '/'
    rerender(<ResumePrompt onDiscarded={onDiscarded} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

Then the code, in `components/workout/ResumePrompt.tsx`. Put this block right after
the line `const step = prompt.step`. It is the React pattern "adjust state while
rendering", so the sheet never reaches the screen on `/workout`:

```tsx
if (pathname === WORKOUT_PATH && prompt.step !== 'closed') {
  setPrompt({ step: 'closed' })
}
```

### Fix F2 — no fixed element inside the page transform (suspect S2)

Apply F2a when the measure shows a fixed element inside the frame. Apply F2b as well
when the frame keeps a transform or `will-change: transform` at rest.

**F2a — the undo toast renders through a portal.** Test first, in
`components/workout/UndoToast.test.tsx`:

```tsx
it('renders its region into document.body, outside the page frame', () => {
  render(
    <div data-testid="frame">
      <UndoToast toast={null} onUndo={vi.fn()} onDismiss={vi.fn()} />
    </div>,
  )

  expect(screen.getByTestId('frame')).not.toContainElement(screen.getByRole('status'))
  expect(screen.getByRole('status').parentElement).toBe(document.body)
})
```

Then the code, in `components/workout/UndoToast.tsx`. Add the import:

```tsx
import { createPortal } from 'react-dom'
```

Wrap the returned region:

```tsx
if (typeof document === 'undefined') {
  return null
}

return createPortal(
  <div
    role="status"
    className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-40 flex justify-center px-5 md:px-7 lg:bottom-6 lg:left-60"
  >
    {toast === null ? null : (
      <div
        data-testid="undo-toast"
        className="bg-surface-2 border-border rounded-card pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 border py-1.5 pr-1.5 pl-4"
      >
        <p className="text-text min-w-0 text-sm font-semibold break-words">{toast.message}</p>
        <button
          ref={undoButton}
          type="button"
          onFocus={() => {
            if (movedHere.current) {
              movedHere.current = false
              return
            }

            setHeld((now) => ({ ...now, focus: true }))
          }}
          onBlur={() => {
            setHeld((now) => ({ ...now, focus: false }))
          }}
          onPointerEnter={() => {
            setHeld((now) => ({ ...now, pointer: true }))
          }}
          onPointerLeave={() => {
            setHeld((now) => ({ ...now, pointer: false }))
          }}
          onClick={onUndo}
          className="text-accent inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-bold"
        >
          Undo
        </button>
      </div>
    )}
  </div>,
  document.body,
)
```

If a sheet is the fixed element, the sheet moves into a portal in B3. Pull B3's
`createPortal` change of `SheetModal` into this step, and say so in the report.

**F2b — the page frame moves only its opacity.** This changes the motion contract:
the page fades in, it no longer rises 8 px. Ask the owner before you apply it.

Test first, in `components/motion/PageTransition.test.tsx`. Replace the test "fades
the next page in from below after a navigation" and the test "moves only opacity and
transform, so the layout never shifts":

```tsx
it('fades the next page in after a navigation, with no transform', () => {
  setReducedMotion(false)
  const { rerender } = render(page('/'))
  rerender(page('/log'))
  expect(screen.getByText('Page /log')).toBeInTheDocument()
  expect(frame().style.opacity).toBe('0')
  expect(frame().style.transform).toBe('')
})

it('moves only opacity, so a fixed child never follows the frame', () => {
  expect(Object.keys(PAGE_ENTER)).toEqual(['opacity'])
  expect(Object.keys(PAGE_REST)).toEqual(['opacity'])
})
```

Then the code, in `components/motion/PageTransition.tsx`:

```tsx
export const PAGE_ENTER = { opacity: 0 }

export const PAGE_REST = { opacity: 1 }
```

### Fix F3 — no element wider than the screen (suspect S3)

Apply only the lines for the elements that `spills` named in B1.

Test first. In `components/workout/LiveSession.test.tsx`, inside
`describe('LiveSession acceptance')`:

```tsx
it('lets the done so far summary wrap beside a long name, so nothing leaves the card', async () => {
  const session = await startSession('2026-09-01')
  await addSet({ session_id: session.id, exercise_id: SQUAT_ID, reps: 5, weight_kg: 100 })
  await addSet({ session_id: session.id, exercise_id: BENCH_ID, reps: 8, weight_kg: 60 })
  await renderLive()

  const summary = within(screen.getByTestId('done-so-far'))
    .getByRole('button', { name: /Back Squat/ })
    .querySelector('strong')
  expect(summary).toHaveClass('min-w-0', 'text-right')
  expect(summary).not.toHaveClass('shrink-0')
})
```

In `components/workout/ExerciseCard.test.tsx`:

```tsx
it('keeps the muscle label whole beside a long exercise name', () => {
  render(
    <ExerciseCard
      exercise={{ name: 'Single Arm Dumbbell Romanian Deadlift With Pause', muscle_group: 'legs' }}
      sets={[]}
      records={new Set()}
      unit="metric"
      source={undefined}
      sourceKey="a"
      onAddSet={vi.fn()}
      onEditSet={vi.fn()}
      onDeleteSet={vi.fn()}
    />,
  )

  expect(screen.getByText('Legs')).toHaveClass('shrink-0')
  expect(
    screen.getByRole('heading', { name: 'Single Arm Dumbbell Romanian Deadlift With Pause' }),
  ).toHaveClass('min-w-0', 'break-words')
})
```

In `components/workout/LiveSession.test.tsx`, for the hero timer:

```tsx
it('scales the elapsed clock to the phone width, from 38 px up to 48 px', async () => {
  await startSession('2026-09-01')
  await renderLive()

  expect(screen.getByRole('timer', { name: 'Elapsed time' })).toHaveClass(
    'text-[clamp(38px,13vw,48px)]',
  )
})
```

Then the code:

- `components/workout/LiveSession.tsx`, the "Done so far" summary. From
  `className="text-text shrink-0 text-sm"` to:
  ```tsx
  <strong className="text-text min-w-0 text-right text-sm">
  ```
- `components/workout/ExerciseCard.tsx`, the label beside the name:
  ```tsx
  <MicroLabel className="shrink-0">{MUSCLE_GROUP_LABEL[exercise.muscle_group]}</MicroLabel>
  ```
- `components/workout/LiveSession.tsx`, the `SessionTimer` in the hero card. From
  `text-[48px]` to `text-[clamp(38px,13vw,48px)]`:
  ```tsx
  className =
    'mt-2.5 mb-1.5 text-[clamp(38px,13vw,48px)] leading-none font-extrabold tracking-[-2.4px]'
  ```
- `components/workout/LiveSession.tsx`, the header. If the sync chip spills, let the
  row wrap:
  ```tsx
  <header className="flex flex-wrap items-center justify-between gap-3">
  ```
  Its test, in `LiveSession.test.tsx`:
  ```tsx
  it('lets the header wrap the sync chip under the title on a narrow phone', async () => {
    await startSession('2026-09-01')
    await renderLive()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Session' }).closest('header'),
    ).toHaveClass('flex-wrap')
  })
  ```

### Fix F4 — focus never scrolls the page (suspect S4)

Test first, in `components/ui/SheetModal.test.tsx`:

```tsx
it('moves focus in and back out with no scroll of the page', () => {
  const focus = vi.spyOn(HTMLElement.prototype, 'focus')
  const opener = document.createElement('button')
  document.body.append(opener)
  opener.focus()
  focus.mockClear()

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

  expect(focus.mock.calls).toEqual([[{ preventScroll: true }], [{ preventScroll: true }]])
  opener.remove()
  focus.mockRestore()
})
```

Then the code, in the layout effect of `components/ui/SheetModal.tsx`:

```tsx
if (dialog !== null) {
  ;(focusables(dialog)[0] ?? dialog).focus({ preventScroll: true })
}
```

and in its cleanup:

```tsx
opener?.focus({ preventScroll: true })
```

### Fix F5 — Start moves inside the app, with no document load (suspect S5)

Apply when only the "a new session" and "a reload" scenarios fail.

Test first, in `app/(app)/workouts/page.test.tsx`. Add a router mock at the top of the
file, beside the existing `vi.mock`:

```tsx
const router = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}))
```

Add `router.push.mockClear()` to the existing `beforeEach`. Then change every test
that reads `push` (the `location.assign` stub) to read `router.push`, and add:

```tsx
it('opens the live session inside the app, with no document load', async () => {
  render(<WorkoutsPage />)

  await userEvent.click(await screen.findByRole('button', { name: 'Start a session' }))

  await waitFor(() => {
    expect(router.push).toHaveBeenCalledWith('/workout')
  })
  expect(push).not.toHaveBeenCalled()
})
```

Then the code, in `app/(app)/workouts/page.tsx`. Import `useRouter` from
`next/navigation`, delete `goToWorkout`, and inside `SessionLauncher`:

```tsx
const router = useRouter()

const start = () => {
  if (starting) return

  setStarting(true)
  setError(null)
  startSession(localDate()).then(
    () => {
      router.push(WORKOUT_PATH)
    },
    (cause: unknown) => {
      if (cause instanceof SessionAlreadyActive) {
        router.push(WORKOUT_PATH)
        return
      }

      setStarting(false)
      setError(cause instanceof SignedOutOnThisDevice ? cause.message : START_FAILED)
    },
  )
}
```

Offline, a client move fetches the route payload. The service worker serves it from
its cache. When that fetch fails, Next.js falls back to a document load, which the
service worker answers from its page cache. `tests/e2e/workout.spec.ts` "keeps every
set of a session logged offline" proves it still works offline.

### Fix F6 — the bar stays at the foot (suspect S6)

A zoom (`scale` not 1) or a bar below the viewport comes from a page wider than the
screen. Apply F3 first. If the bar is still off with no spill, the page rubber-bands
and drags the bar in the standalone app. Then stop the root overscroll.

Test first, an e2e assertion in `tests/e2e/workout-layout.spec.ts`, inside the
describe:

```ts
test('stops the page from rubber-banding the bottom bar', async ({ page }) => {
  await page.goto('/workout')
  await expect(page.getByText('No session is running on this device.')).toBeVisible()

  const behaviour = await page.evaluate(() => [
    getComputedStyle(document.documentElement).overscrollBehaviorY,
    getComputedStyle(document.body).overscrollBehaviorY,
  ])

  expect(behaviour).toEqual(['none', 'none'])
})
```

Then the code, in `app/globals.css`, inside `@layer base`:

```css
html,
body {
  overscroll-behavior-y: none;
}
```

This also turns off pull to refresh in the Safari tab. The installed app has none.
Say so in the report.

## Acceptance criteria

- [ ] `KNOWN_BREAKS` is empty, and `tests/e2e/workout-layout.spec.ts` passes on
      `mobile-safari`, `mobile-chrome` and `desktop`.
- [ ] `/workout` has no sideways overflow at 320, 375, 390 and 430 px, in all 5
      scenarios, at the top and the foot of the page.
- [ ] The bottom bar spans the width and ends at the foot of the viewport, in all 5
      scenarios.
- [ ] No dialog is open on `/workout` after the Resume link.
- [ ] Every applied fix has its unit test, and each test failed before the fix.
- [ ] `tests/e2e/responsive.spec.ts` passes with no change to it.

### The gate and the dependencies

- [ ] W0 and B1 are merged, and B1's **Findings** is filled in: every dependency check in "Before you start" prints `ok`.
- [ ] Only the fixes that **Findings** names are applied. F2b and F5 are applied only after a yes from the owner. Manual check: the report names each applied fix and each owner answer.
- [ ] If F5 is applied: `tests/e2e/workout.spec.ts` "keeps every set of a session logged offline" passes.
- [ ] If F2a is applied and a sheet is the fixed element: `SheetModal` renders through `createPortal`, and the report says that B3's portal change moved into this step. Test: `components/ui/SheetModal.test.tsx`.
- [ ] The `ui-reviewer` agent reports no drift on each changed file. Manual check: "Verification", item 2.
- [ ] The staged diff holds only the files in "Files touched". Manual check: `git diff --cached --stat`.
- [ ] `pnpm verify:parallel` passes. Manual check: "When the step is done", item 1.

## Tests

- `tests/e2e/workout-layout.spec.ts`: criteria 1 to 4.
- The unit tests of each applied fix: criterion 5.
- `tests/e2e/responsive.spec.ts`: criterion 6.

## Verification

1. `node scripts/e2e-lock.mjs pnpm exec playwright test tests/e2e/workout-layout.spec.ts tests/e2e/responsive.spec.ts`.
2. The `ui-reviewer` agent on every changed file under `components/` and `app/`.
3. `/workout` with a set logged at 390, 768 and 1440 px, by eye.
4. `pnpm verify:parallel`.

## Files touched

Only the files of the applied fixes:

- `tests/e2e/workout-layout.spec.ts`
- F1: `components/workout/ResumePrompt.tsx` and its test
- F2a: `components/workout/UndoToast.tsx` and its test
- F2b: `components/motion/PageTransition.tsx` and its test
- F3: `components/workout/LiveSession.tsx`, `components/workout/ExerciseCard.tsx` and
  their tests
- F4: `components/ui/SheetModal.tsx` and its test
- F5: `app/(app)/workouts/page.tsx` and its test
- F6: `app/globals.css`

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer when another step runs its e2e suite. Never skip a check, and never add a design-check or test exemption to pass.
2. Stage the files from "Files touched", including the tests. Then run the `commit-report` skill. The skill reports on the staged diff, so stage first:
   ```bash
   git add tests/e2e/workout-layout.spec.ts <each source file and test of the applied fixes, from "Files touched">
   ```
   The report needs screenshots of every changed page at 390, 768 and 1440 px, next to the matching prototype plate: `/workout` with a set logged, next to the prototype's Session screen. Add the B1 failure screenshot beside the same width after the fix. If F6 is applied, say that pull to refresh is off in the Safari tab. Name the owner answers from "Stop and ask the owner".
3. Commit on `fix/b2-fix-workout-layout`. This step file tells you to commit, so you commit, not the owner:
   ```bash
   git commit -m "fix(ui): keep the /workout layout inside the phone screen"
   ```
   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.
4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked, and anything the owner must check on the iPhone. For this step: open `/workout` in the installed app: no sideways pan, and the bottom bar stays at the foot, in each B1 scenario.
