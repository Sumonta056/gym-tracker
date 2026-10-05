# Step B5 — Hidden scrollbars and the chip fade

**Branch:** `fix/b5-hidden-scrollbars`, in worktree `../gym-tracker-b5`, cut from `fix/feedback-fixes` · **Wave:** 3 · **Size:** S · **Depends on:** W0, B2 (and B1 through B2) · **Unlocks:** the sub-plan B checkpoint · **Skill to load:** `design-system` · **Agent to use:** `ui-reviewer`

## Before you start

### 1. The worktree

```bash
cd /Users/cefalo_1/Documents/Projects/gym-tracker
git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-b5 -b fix/b5-hidden-scrollbars fix/feedback-fixes
cd ../gym-tracker-b5
cp ../gym-tracker/.env.local ../gym-tracker/.env.test.local .
export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"
pnpm install
```

If you are already in that worktree on that branch, skip this block. Run every later
command from `../gym-tracker-b5`.

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
git grep -q "export function fadeEdge" HEAD -- components/workout/MuscleGroupChips.tsx && echo "B5 is already done"
```

If it prints that the step is already done, stop and report.

### 4. Every e2e run goes through the lock

Other steps run at the same time in other worktrees. They share port 3100 and the test
account. Start every Playwright run with `node scripts/e2e-lock.mjs`, for example
`node scripts/e2e-lock.mjs pnpm exec playwright test tests/e2e/<file>.spec.ts`. The lock
waits while another worktree runs its e2e suite.

## Names this step uses from earlier steps

- B2 fixed the `/workout` layout. `tests/e2e/workout-layout.spec.ts` passes with an empty
  `KNOWN_BREAKS`.
- B2 fix F6 may have added this rule to `app/globals.css`, inside `@layer base`. Keep it
  when you add the scrollbar rules:
  ```css
  html,
  body {
    overscroll-behavior-y: none;
  }
  ```
- B3 runs in the same wave and changes `components/ui/SheetModal.tsx`. Do not edit that
  file. The scrollbar rule in `app/globals.css` covers the sheet bodies.

## Context to read first

1. `docs/specs/2026-10-05-feedback-fixes-design.md`, item 13, and the risk "A hidden
   scrollbar hides content".
2. `.claude/skills/design-system/references/tokens.md` and
   `references/responsive.md`. Load the skill.
3. `CLAUDE.md`, the design check table. `scripts/design-check.mjs` scans `.ts` and
   `.tsx` under `app/` and `components/` only. It does not scan `app/globals.css`.
4. `app/globals.css`.
5. `components/workout/MuscleGroupChips.tsx` and its test.
6. `tests/e2e/responsive.spec.ts`, the `LIVE_ROUTES` block and the picker block.

## State before the step

- No rule hides a scrollbar. The laptop shows a bar on the page, on every sheet body
  and on the chip row.
- `MuscleGroupChips` is a row with `overflow-x-auto`. At 320 px the last chips sit off
  the edge, and nothing shows that the row scrolls.

## Goal

No scrollbar shows at any width from 320 to 2560 px. Content still scrolls by touch,
by trackpad, by wheel and by keyboard. The chip row fades at the edge that can still
scroll, and only there.

## Do

1. Load the `design-system` skill.
2. Write the unit tests for `fadeEdge` and `MuscleGroupChips`. Run them. They fail.
3. Write the code. The tests pass.
4. Add the scrollbar and the fade rules to `app/globals.css`.
5. Add the e2e assertions to `tests/e2e/responsive.spec.ts`. Run the whole spec.
6. Check the chip row in the exercise picker at 320, 390 and 1440 px by eye.

### The CSS

`app/globals.css`. Inside the existing `@layer base`, after the `:focus-visible`
rule:

```css
html,
body,
* {
  scrollbar-width: none;
}

html::-webkit-scrollbar,
body::-webkit-scrollbar,
*::-webkit-scrollbar {
  display: none;
}
```

Inside the existing `@layer components`, after the media block:

```css
[data-fade='end'] {
  -webkit-mask-image: linear-gradient(to right, var(--color-ground) calc(100% - 32px), transparent);
  mask-image: linear-gradient(to right, var(--color-ground) calc(100% - 32px), transparent);
}

[data-fade='start'] {
  -webkit-mask-image: linear-gradient(to left, var(--color-ground) calc(100% - 32px), transparent);
  mask-image: linear-gradient(to left, var(--color-ground) calc(100% - 32px), transparent);
}

[data-fade='both'] {
  -webkit-mask-image: linear-gradient(
    to right,
    transparent,
    var(--color-ground) 32px,
    var(--color-ground) calc(100% - 32px),
    transparent
  );
  mask-image: linear-gradient(
    to right,
    transparent,
    var(--color-ground) 32px,
    var(--color-ground) calc(100% - 32px),
    transparent
  );
}
```

Why:

- `scrollbar-width: none` hides the bar in Firefox, Chrome 121 and later, and Safari
  18.2 and later. `::-webkit-scrollbar { display: none }` hides it in older Safari and
  Chrome. Scrolling still works. Only the bar goes.
- A mask uses only the alpha of its colour. `var(--color-ground)` is opaque, so the
  chips show fully where the gradient is the token, and fade where it turns
  `transparent`. No raw hex, no `rgb()`. The design check passes.
- The fade is 32 px wide: about half of the narrowest chip, so the user sees a chip
  cut by the fade and knows the row goes on.

### `fadeEdge`, a pure function

Test first, in `components/workout/MuscleGroupChips.test.tsx`. Add `act` and
`fireEvent` to the `@testing-library/react` import and `fadeEdge` to the
`./MuscleGroupChips` import:

```tsx
describe('fadeEdge', () => {
  it('fades nothing when the row fits', () => {
    expect(fadeEdge({ scrollLeft: 0, scrollWidth: 300, clientWidth: 300 })).toBe('none')
  })

  it('fades the end when more chips sit to the right', () => {
    expect(fadeEdge({ scrollLeft: 0, scrollWidth: 600, clientWidth: 300 })).toBe('end')
  })

  it('fades the start when the row is scrolled to its end', () => {
    expect(fadeEdge({ scrollLeft: 300, scrollWidth: 600, clientWidth: 300 })).toBe('start')
  })

  it('fades both edges in the middle of the row', () => {
    expect(fadeEdge({ scrollLeft: 150, scrollWidth: 600, clientWidth: 300 })).toBe('both')
  })

  it('ignores a scroll of less than 1 px, the rounding of a zoomed screen', () => {
    expect(fadeEdge({ scrollLeft: 0.5, scrollWidth: 600.5, clientWidth: 600 })).toBe('none')
  })
})

describe('MuscleGroupChips fade', () => {
  function sizeRow(
    row: HTMLElement,
    box: { scrollLeft: number; scrollWidth: number; clientWidth: number },
  ) {
    Object.defineProperty(row, 'scrollWidth', { configurable: true, value: box.scrollWidth })
    Object.defineProperty(row, 'clientWidth', { configurable: true, value: box.clientWidth })
    Object.defineProperty(row, 'scrollLeft', { configurable: true, value: box.scrollLeft })
  }

  it('shows no fade before the row is measured', () => {
    render(
      <MuscleGroupChips includeAll label="Muscle group" value={null} onValueChange={vi.fn()} />,
    )

    expect(screen.getByRole('group', { name: 'Muscle group' })).toHaveAttribute('data-fade', 'none')
  })

  it('fades the end, then the start, as the user scrolls the row', () => {
    render(
      <MuscleGroupChips includeAll label="Muscle group" value={null} onValueChange={vi.fn()} />,
    )
    const row = screen.getByRole('group', { name: 'Muscle group' })

    sizeRow(row, { scrollLeft: 0, scrollWidth: 600, clientWidth: 300 })
    fireEvent.scroll(row)
    expect(row).toHaveAttribute('data-fade', 'end')

    sizeRow(row, { scrollLeft: 300, scrollWidth: 600, clientWidth: 300 })
    fireEvent.scroll(row)
    expect(row).toHaveAttribute('data-fade', 'start')
  })

  it('measures again when the row changes size', () => {
    let resize: () => void = () => undefined
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback
        }
        observe() {
          return undefined
        }
        disconnect() {
          return undefined
        }
      },
    )
    render(
      <MuscleGroupChips includeAll label="Muscle group" value={null} onValueChange={vi.fn()} />,
    )
    const row = screen.getByRole('group', { name: 'Muscle group' })

    sizeRow(row, { scrollLeft: 0, scrollWidth: 600, clientWidth: 300 })
    act(() => {
      resize()
    })

    expect(row).toHaveAttribute('data-fade', 'end')
    vi.unstubAllGlobals()
  })

  it('keeps every chip a real button that the keyboard reaches under the fade', () => {
    render(
      <MuscleGroupChips includeAll label="Muscle group" value={null} onValueChange={vi.fn()} />,
    )

    const buttons = within(screen.getByRole('group', { name: 'Muscle group' })).getAllByRole(
      'button',
    )
    buttons.forEach((button) => {
      expect(button).not.toHaveAttribute('tabindex', '-1')
      expect(button).toHaveClass('min-h-11')
    })
  })
})
```

Then the code, in `components/workout/MuscleGroupChips.tsx`. Change the `react`
import line to `import { useEffect, useRef, useState } from 'react'`. Add above
`MuscleGroupChips`:

```tsx
export type FadeEdge = 'none' | 'start' | 'end' | 'both'

export type RowBox = { scrollLeft: number; scrollWidth: number; clientWidth: number }

export function fadeEdge({ scrollLeft, scrollWidth, clientWidth }: RowBox): FadeEdge {
  const before = scrollLeft > 1
  const after = scrollLeft + clientWidth < scrollWidth - 1

  if (before && after) return 'both'
  if (before) return 'start'
  if (after) return 'end'
  return 'none'
}
```

Inside `MuscleGroupChips`, before `const options`:

```tsx
const rowRef = useRef<HTMLDivElement>(null)
const [fade, setFade] = useState<FadeEdge>('none')

useEffect(() => {
  const row = rowRef.current

  if (row === null) {
    return
  }

  const measure = () => {
    setFade(fadeEdge(row))
  }

  measure()
  row.addEventListener('scroll', measure, { passive: true })
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
  observer?.observe(row)

  return () => {
    row.removeEventListener('scroll', measure)
    observer?.disconnect()
  }
}, [])
```

On the row `div`, add the ref and the attribute:

```tsx
    <div
      ref={rowRef}
      role="group"
      aria-label={label}
      aria-labelledby={labelledBy}
      data-fade={fade}
      className={cn('-mx-1 flex gap-2 overflow-x-auto p-1', className)}
    >
```

The fade carries no meaning on its own. It only hints that the row scrolls. Every chip
stays a real button with its text, so a screen reader and the keyboard reach all of
them. Rule 4 of `.claude/rules/accessibility.md` holds.

### The end to end assertions

In `tests/e2e/responsive.spec.ts`, add a helper beside `clippedText`:

```ts
function visibleScrollbars(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = []
    const elements = [document.documentElement, ...document.body.querySelectorAll<HTMLElement>('*')]
    for (const element of elements) {
      const style = getComputedStyle(element)
      const scrolls =
        element === document.documentElement ||
        ['auto', 'scroll'].includes(style.overflowX) ||
        ['auto', 'scroll'].includes(style.overflowY)
      const width = style.getPropertyValue('scrollbar-width')
      if (scrolls && width !== 'none') {
        out.push(`${element.tagName.toLowerCase()} scrollbar-width ${width}`)
      }
    }
    return out
  })
}
```

Add a public test after the `PUBLIC_ROUTES` loop:

```ts
test('shows no scrollbar on /styleguide at 1440 px, with the sheet open', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/styleguide')

  expect(await visibleScrollbars(page)).toEqual([])
  await page.getByRole('button', { name: 'Open the sheet' }).click()
  await expect(page.getByRole('dialog', { name: 'Log a set' })).toBeVisible()
  expect(await visibleScrollbars(page)).toEqual([])
})
```

Inside the `LIVE_ROUTES` loop, in the `signedIn.describe`:

```ts
signedIn('shows no scrollbar at 1440 px', async ({ page }) => {
  await resizeAndSettle(page, 1440)

  expect(await visibleScrollbars(page)).toEqual([])
})
```

Inside `signedIn.describe('signed in on /workout with the exercise picker open')`:

```ts
signedIn('shows no scrollbar at 1440 px, the chip row included', async ({ page }) => {
  await resizeAndSettle(page, 1440)

  expect(await visibleScrollbars(page)).toEqual([])
})

signedIn('fades the chip row at the edge that can still scroll, at 320 px', async ({ page }) => {
  await resizeAndSettle(page, 320)
  const chips = page.getByRole('group', { name: 'Muscle group' })

  await expect(chips).toHaveAttribute('data-fade', 'end')
  await chips.evaluate((element) => {
    element.scrollLeft = element.scrollWidth
  })
  await expect(chips).toHaveAttribute('data-fade', 'start')
})
```

At 320 px the 8 chips are wider than the row, so the row scrolls. The fade check
runs on all 3 projects.

## Acceptance criteria

- [ ] `html`, `body` and every scroll container compute `scrollbar-width: none`.
- [ ] No scrollbar shows on `/styleguide`, `/`, `/log`, `/analytics`, `/profile` and
      the open exercise picker at 1440 px.
- [ ] Content still scrolls: `tests/e2e/responsive.spec.ts` "keeps the navigation in
      view at the foot of a long page" still passes.
- [ ] `fadeEdge` returns `none`, `end`, `start` or `both` from the scroll position,
      with a 1 px tolerance.
- [ ] The chip row fades only at an edge that can still scroll, and updates on scroll
      and on resize.
- [ ] Every chip stays a real, reachable button, 44 px tall.
- [ ] The fade uses `var(--color-ground)` and `transparent`. `pnpm design:check`
      passes.
- [ ] `tests/e2e/responsive.spec.ts` passes in full.

### The gate and the dependencies

- [ ] W0 and B2 are merged: every dependency check in "Before you start" prints `ok`.
- [ ] `tests/e2e/workout-layout.spec.ts` still passes. Manual check: `node scripts/e2e-lock.mjs pnpm exec playwright test tests/e2e/workout-layout.spec.ts`.
- [ ] The `ui-reviewer` agent reports no drift on the changed files. Manual check: "Verification", item 3.
- [ ] The staged diff holds only the files in "Files touched". Manual check: `git diff --cached --stat`.
- [ ] `pnpm verify:parallel` passes. Manual check: "When the step is done", item 1.

## Tests

| Criterion | Test                                                                                |
| --------- | ----------------------------------------------------------------------------------- |
| 1, 2      | E2E "shows no scrollbar…" on `/styleguide`, each signed-in route, and the picker    |
| 3         | The existing e2e "keeps the navigation in view at the foot…"                        |
| 4         | Unit `describe('fadeEdge')`, 5 tests                                                |
| 5         | Unit "fades the end, then the start…", "measures again…". E2E "fades the chip row…" |
| 6         | Unit "keeps every chip a real button…". The existing e2e tap target checks          |
| 7         | `pnpm design:check`, inside `pnpm static`                                           |
| 8         | `node scripts/e2e-lock.mjs pnpm exec playwright test tests/e2e/responsive.spec.ts`  |

## Verification

1. `pnpm test -- components/workout/MuscleGroupChips.test.tsx`.
2. `node scripts/e2e-lock.mjs pnpm exec playwright test tests/e2e/responsive.spec.ts`.
3. The `ui-reviewer` agent on the changed files.
4. The exercise picker at 320, 390, 768 and 1440 px, by eye. Scroll the chip row both
   ways. Use a trackpad and the Tab key at 1440 px.
5. `pnpm verify:parallel`.

## Files touched

- `app/globals.css`
- `components/workout/MuscleGroupChips.tsx` and its test
- `tests/e2e/responsive.spec.ts`

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer when another step runs its e2e suite. Never skip a check, and never add a design-check or test exemption to pass.
2. Stage the files from "Files touched", including the tests. Then run the `commit-report` skill. The skill reports on the staged diff, so stage first:
   ```bash
   git add app/globals.css components/workout/MuscleGroupChips.tsx components/workout/MuscleGroupChips.test.tsx tests/e2e/responsive.spec.ts
   ```
   The report needs screenshots of every changed page at 390, 768 and 1440 px, next to the matching prototype plate: the open exercise picker next to the prototype's picker plate, and 1 screenshot of `/analytics` at 1440 px to show no scrollbar.
3. Commit on `fix/b5-hidden-scrollbars`. This step file tells you to commit, so you commit, not the owner:
   ```bash
   git commit -m "fix(design): hide every scrollbar and fade the chip row edge"
   ```
   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.
4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked, and anything the owner must check on the iPhone. For this step: no scrollbar shows on the iPhone or the laptop, and the chip row in the exercise picker still scrolls and fades at the edge.
