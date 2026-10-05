# Step B1 — Reproduce the `/workout` break on the iPhone

**Branch:** `fix/b1-reproduce-workout`, in worktree `../gym-tracker-b1`, cut from `fix/feedback-fixes` · **Wave:** 1 · **Size:** S · **Depends on:** W0 · **Unlocks:** B2 · **Skill to load:** `superpowers:systematic-debugging` · **Agent to use:** none

## Before you start

### 1. The worktree

```bash
cd /Users/cefalo_1/Documents/Projects/gym-tracker
git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-b1 -b fix/b1-reproduce-workout fix/feedback-fixes
cd ../gym-tracker-b1
cp ../gym-tracker/.env.local ../gym-tracker/.env.test.local .
export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"
pnpm install
```

If you are already in that worktree on that branch, skip this block. Run every later
command from `../gym-tracker-b1`.

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
git cat-file -e HEAD:tests/e2e/workout-layout.spec.ts 2>/dev/null && echo "B1 is already done"
```

If it prints that the step is already done, stop and report.

### 4. Every e2e run goes through the lock

Other steps run at the same time in other worktrees. They share port 3100 and the test
account. Start every Playwright run with `node scripts/e2e-lock.mjs`, for example
`node scripts/e2e-lock.mjs pnpm exec playwright test tests/e2e/<file>.spec.ts`. The lock
waits while another worktree runs its e2e suite.

## Context to read first

1. `docs/specs/2026-10-05-feedback-fixes-design.md`, item 5 and the risk "The F2 cause
   is not where the investigation looked".
2. `.claude/rules/testing.md`, the section "End to end".
3. `app/(app)/workout/page.tsx` and `components/workout/LiveSession.tsx`.
4. `app/(app)/layout.tsx`, `components/AppNav.tsx`, `components/ui/AppShell.tsx`,
   `components/motion/PageTransition.tsx`.
5. `components/workout/ResumePrompt.tsx`, `components/workout/UndoToast.tsx`,
   `components/ui/SheetModal.tsx`.
6. `tests/e2e/responsive.spec.ts`, the `sideways` helper and the 2 `/workout` blocks.
7. `tests/e2e/support/signedIn.ts` and `tests/e2e/support/workout.ts`.

## State before the step

The owner wrote: "Page breaks bottom bar in workout". On the iPhone, `/workout` breaks
as soon as it opens. No input, no sheet. The cause is not known.

`tests/e2e/responsive.spec.ts` already checks `/workout` with a set logged, and it
passes. That check sets the width with `setViewportSize`, measures only
`scrollWidth > clientWidth`, and never checks where the bottom bar sits. It also never
opens `/workout` with no session, through the Resume link, or after a reload.

## Goal

A written root cause in the **Findings** section below, and an end to end test that
fails for that cause. No product file changes in this step.

## Suspects

Read the code before you run anything. These are the suspects the code shows today.
Each one has the measure that proves or clears it.

| Id  | Suspect                                                                                                                                                                                                                                                                                                                   | Where                                                                       | The measure                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| S1  | The Resume prompt opens over `/workout`. `ResumePrompt` checks the path only once, at mount (`openedOn`). A read that ends after a move to `/workout` still opens the sheet there. The sheet locks only `body.style.overflow`, which iOS ignores.                                                                         | `components/workout/ResumePrompt.tsx`, the effect that calls `read()`       | `dialogs` is above 0 on `/workout`.                                               |
| S2  | A fixed element sits inside a transformed parent. `PageTransition` animates `y` on a `motion.div`. Every sheet of `LiveSession` and the fixed `UndoToast` region render inside it. While the frame has a transform or `will-change: transform`, `position: fixed` follows the frame, not the screen.                      | `components/motion/PageTransition.tsx`, `components/workout/UndoToast.tsx`  | `frame.transform` is not `none`, or `frame.willChange` holds `transform`.         |
| S3  | One element is wider than the screen, so iOS lets the page pan sideways and the fixed bar looks cut. The candidates at 320 px: the header row with `SyncChip` `shrink-0`; the "Done so far" `<strong>` with `shrink-0`; the `MicroLabel` beside a long exercise name in `ExerciseCard`; the 48 px timer in the hero card. | `components/workout/LiveSession.tsx`, `components/workout/ExerciseCard.tsx` | `spills` names the element. `scrollX` is above 0 after a sideways scroll attempt. |
| S4  | Focus moves and scrolls the page. `SheetModal` focuses the first control on open and calls `opener?.focus()` on close, with no `preventScroll`. iOS scrolls a focused element into view.                                                                                                                                  | `components/ui/SheetModal.tsx`, the layout effect                           | `window.scrollY` is not 0 right after the page opens.                             |
| S5  | The full document load. "Start a session" calls `window.location.assign('/workout')`. A document load in the standalone app can keep a stale scroll or zoom. The Resume link is a client move, so the 2 paths can differ.                                                                                                 | `app/(app)/workouts/page.tsx`, `goToWorkout`                                | The "a new session" scenario fails and "the Resume link" scenario passes.         |
| S6  | The bar is not at the foot of the screen. Its `bottom` differs from the visual viewport height, or the page is zoomed (`visualViewport.scale` is not 1).                                                                                                                                                                  | `components/ui/AppShell.tsx`, the bottom `nav`                              | `bar.bottom` differs from `viewportHeight` by more than 1 px. `scale` is not 1.   |

Ruled out by reading:

- iOS zoom on input focus. `FIELD_INPUT_CLASS` in `components/ui/Field.tsx` sets
  `text-base`, which is 16 px. iOS zooms only below 16 px.
- `w-screen`, `min-w-[...]` or a fixed pixel width under `components/workout/`. A
  search finds none. Confirm with
  `grep -rnE "w-screen|min-w-\[|w-\[[0-9]+px\]" components/workout app/\(app\)/workout`.

## Do

1. Work in the worktree from "Before you start", on `fix/b1-reproduce-workout`.
2. Load the `superpowers:systematic-debugging` skill. Follow its order: reproduce,
   measure, find the cause, and only then write the test that fails for it.
3. Stop any `next dev`. Playwright builds the app and starts it on port 3100 itself.
   Set the PATH from `.nvmrc`:
   ```
   export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"
   ```
4. Write `tests/e2e/workout-layout.spec.ts` as below, with `KNOWN_BREAKS` empty.
5. Run it on all 3 projects:
   ```
   node scripts/e2e-lock.mjs pnpm exec playwright test tests/e2e/workout-layout.spec.ts
   ```
6. Read every failure. Open the screenshots in `test-results/`. Fill in **Findings**:
   one row per failing scenario, project and width, then the root cause, then the
   state of each suspect S1 to S6.
7. If one or more scenarios fail: add 1 entry to `KNOWN_BREAKS` for each failing
   scenario and project pair. Run the spec again. Every entry now reports as an
   expected failure, and the run is green.
8. If no scenario fails in Playwright: the break needs a real iPhone. Ask the owner to
   open the installed app, attach Safari Web Inspector (Mac Safari → Develop → the
   iPhone → the Gym Tracker web app), open `/workout`, and paste the probe below into
   the console. Write the result into **Findings**. Then add the condition that the
   probe shows to `problems()` in the spec, so the spec fails for it. If Playwright
   still cannot fail for it, follow "Stop and ask the owner" below.
9. Change no file under `app/`, `components/` or `lib/`.

### The probe for the real iPhone

```js
;(() => {
  const root = document.documentElement
  window.scrollBy(400, 0)
  const scrollX = window.scrollX
  window.scrollTo(0, window.scrollY)
  const nav = document.querySelector('nav[aria-label="Bottom navigation"]')
  const frame = document.querySelector('[data-testid="page-transition"]')
  const spills = [...document.body.querySelectorAll('*')]
    .filter((element) => {
      const box = element.getBoundingClientRect()
      return box.width > 0 && (box.right > root.clientWidth + 0.5 || box.left < -0.5)
    })
    .map((element) => `${element.tagName} ${element.className}`.slice(0, 120))
  return {
    standalone: navigator.standalone,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    clientWidth: root.clientWidth,
    scrollWidth: root.scrollWidth,
    scrollX,
    scrollY: window.scrollY,
    scale: window.visualViewport?.scale,
    viewportHeight: window.visualViewport?.height,
    bar: nav?.getBoundingClientRect().toJSON(),
    dialogs: document.querySelectorAll('[role="dialog"]').length,
    frameTransform: frame === null ? null : getComputedStyle(frame).transform,
    frameWillChange: frame === null ? null : getComputedStyle(frame).willChange,
    bodyStyle: document.body.getAttribute('style'),
    spills,
  }
})()
```

### The spec

`tests/e2e/workout-layout.spec.ts`:

```ts
import { expect, test } from './support/signedIn'
import {
  openLiveSession,
  pullOnlyThisWindow,
  startSession,
  SUPABASE,
  waitForExercises,
} from './support/workout'

import type { BrowserContext, Page, TestInfo } from '@playwright/test'

const PHONE_WIDTHS = [320, 375, 390, 430]

const PHONE_HEIGHT = 844

const SETTLE_MS = 400

type Scenario = 'no session' | 'a new session' | 'a set logged' | 'the Resume link' | 'a reload'

const KNOWN_BREAKS: readonly { scenario: Scenario; project: string }[] = []

type Probe = {
  scrollWidth: number
  clientWidth: number
  scrollX: number
  scrollY: number
  scale: number
  viewportHeight: number
  bar: { left: number; right: number; bottom: number } | null
  dialogs: number
  frame: { transform: string; willChange: string } | null
  spills: string[]
}

function probe(page: Page): Promise<Probe> {
  return page.evaluate(() => {
    const root = document.documentElement
    const scrollY = window.scrollY
    window.scrollBy(400, 0)
    const scrollX = window.scrollX
    window.scrollTo(0, scrollY)
    const spills: string[] = []
    for (const element of document.body.querySelectorAll<HTMLElement>('*')) {
      const box = element.getBoundingClientRect()
      if (box.width === 0 || (box.right <= root.clientWidth + 0.5 && box.left >= -0.5)) continue
      let parent = element.parentElement
      let contained = false
      while (parent !== null && parent !== document.body) {
        if (getComputedStyle(parent).overflowX !== 'visible') {
          contained = true
          break
        }
        parent = parent.parentElement
      }
      if (!contained) {
        const id = element.dataset.testid === undefined ? '' : `[${element.dataset.testid}]`
        spills.push(
          `${element.tagName.toLowerCase()}${id} "${element.textContent.trim().slice(0, 30)}" ${String(Math.round(box.left))} to ${String(Math.round(box.right))}`,
        )
      }
    }
    const nav = document.querySelector('nav[aria-label="Bottom navigation"]')
    const bar = nav === null ? null : nav.getBoundingClientRect()
    const frame = document.querySelector('[data-testid="page-transition"]')
    const frameStyle = frame === null ? null : getComputedStyle(frame)

    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      scrollX,
      scrollY,
      scale: window.visualViewport?.scale ?? 1,
      viewportHeight: window.visualViewport?.height ?? window.innerHeight,
      bar: bar === null ? null : { left: bar.left, right: bar.right, bottom: bar.bottom },
      dialogs: document.querySelectorAll('[role="dialog"]').length,
      frame:
        frameStyle === null
          ? null
          : { transform: frameStyle.transform, willChange: frameStyle.willChange },
      spills,
    }
  })
}

function problems(found: Probe): string[] {
  const out: string[] = []
  if (found.scrollWidth > found.clientWidth) {
    out.push(`page ${String(found.scrollWidth)} > ${String(found.clientWidth)}`)
  }
  if (found.scrollX !== 0) {
    out.push(`page pans sideways by ${String(found.scrollX)} px`)
  }
  if (found.scale !== 1) {
    out.push(`page zoomed to ${String(found.scale)}`)
  }
  if (found.bar === null) {
    out.push('no bottom bar')
  } else {
    if (Math.abs(found.bar.left) > 1 || Math.abs(found.bar.right - found.clientWidth) > 1) {
      out.push(`bar spans ${String(found.bar.left)} to ${String(found.bar.right)}`)
    }
    if (Math.abs(found.bar.bottom - found.viewportHeight) > 1) {
      out.push(
        `bar ends at ${String(found.bar.bottom)} in a ${String(found.viewportHeight)} px viewport`,
      )
    }
  }
  if (found.dialogs > 0) {
    out.push(`${String(found.dialogs)} dialog open`)
  }
  if (
    found.frame !== null &&
    (found.frame.transform !== 'none' || found.frame.willChange.includes('transform'))
  ) {
    out.push(
      `page frame keeps transform ${found.frame.transform} and will-change ${found.frame.willChange}`,
    )
  }
  out.push(...found.spills)
  return out
}

async function checkPhoneWidths(
  page: Page,
  testInfo: TestInfo,
  scenario: Scenario,
): Promise<string[]> {
  const found: string[] = []
  const slug = scenario.replaceAll(' ', '-')

  for (const width of PHONE_WIDTHS) {
    await page.setViewportSize({ width, height: PHONE_HEIGHT })
    await page.waitForTimeout(SETTLE_MS)
    const shot = testInfo.outputPath(`${slug}-${String(width)}.png`)
    await page.screenshot({ path: shot })
    await testInfo.attach(`${scenario} at ${String(width)} px`, { path: shot })
    found.push(...problems(await probe(page)).map((entry) => `${String(width)}px top: ${entry}`))

    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight)
    })
    await page.waitForTimeout(SETTLE_MS)
    found.push(...problems(await probe(page)).map((entry) => `${String(width)}px foot: ${entry}`))
    await page.evaluate(() => {
      window.scrollTo(0, 0)
    })
  }

  return found
}

function expectKnownBreak(testInfo: TestInfo, scenario: Scenario): void {
  testInfo.fail(
    KNOWN_BREAKS.some(
      (entry) => entry.scenario === scenario && entry.project === testInfo.project.name,
    ),
    'B1 reproduces the /workout break. B2 fixes it.',
  )
}

async function newSession(page: Page, context: BrowserContext): Promise<void> {
  await page.goto('/workouts')
  await expect(page.getByRole('heading', { level: 1, name: 'Workouts' })).toBeVisible()
  await waitForExercises(page)
  await context.route(SUPABASE, (route) => route.abort('internetdisconnected'))
  await startSession(page)
}

test.use({ serviceWorkers: 'block' })

test.beforeEach(async ({ context, day }) => {
  await pullOnlyThisWindow(context, day)
})

test.describe('the /workout layout on a phone', () => {
  test('stays inside the screen with no session', async ({ page }, testInfo) => {
    expectKnownBreak(testInfo, 'no session')
    await page.goto('/workout')
    await expect(page.getByText('No session is running on this device.')).toBeVisible()

    expect(await checkPhoneWidths(page, testInfo, 'no session')).toEqual([])
  })

  test('stays inside the screen when Start opens a new session', async ({
    page,
    context,
  }, testInfo) => {
    expectKnownBreak(testInfo, 'a new session')
    await newSession(page, context)

    expect(await checkPhoneWidths(page, testInfo, 'a new session')).toEqual([])
  })

  test('stays inside the screen with a set logged and the rest timer running', async ({
    page,
    context,
  }, testInfo) => {
    expectKnownBreak(testInfo, 'a set logged')
    await openLiveSession(page, context)

    expect(await checkPhoneWidths(page, testInfo, 'a set logged')).toEqual([])
  })

  test('stays inside the screen after the Resume link of the prompt', async ({
    page,
    context,
  }, testInfo) => {
    expectKnownBreak(testInfo, 'the Resume link')
    await newSession(page, context)
    await page.goto('/')
    const prompt = page.getByRole('dialog', { name: 'Session running' })
    await expect(prompt).toBeVisible()
    await prompt.getByRole('link', { name: 'Resume' }).click()
    await expect(page).toHaveURL(/\/workout$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Session' })).toBeVisible()

    expect(await checkPhoneWidths(page, testInfo, 'the Resume link')).toEqual([])
  })

  test('stays inside the screen after a reload of a running session', async ({
    page,
    context,
  }, testInfo) => {
    expectKnownBreak(testInfo, 'a reload')
    await newSession(page, context)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Session' })).toBeVisible()

    expect(await checkPhoneWidths(page, testInfo, 'a reload')).toEqual([])
  })
})
```

`day` is not read in the test bodies, but the `day` fixture must run. It sets the
clock and clears the test account's rows. `pullOnlyThisWindow` in `beforeEach` asks
for it, so every test gets it.

## Stop and ask the owner

Only when no scenario fails in Playwright (Do, item 8). You cannot run the iPhone probe
yourself. Stop and report:

- "No scenario of `tests/e2e/workout-layout.spec.ts` fails in Playwright. Please open the
  installed app on the iPhone, attach Safari Web Inspector (Mac Safari → Develop → the
  iPhone → the Gym Tracker web app), open `/workout`, paste the probe from 'The probe for
  the real iPhone' into the console, and send me the output."

Then wait for the output. Do not guess the cause and do not commit. When the output
arrives, write it into **Findings** and add its condition to `problems()`. If Playwright
still cannot fail for it, stop again and report the probe output. Do not start B2.

## Findings

Filled in by the executor. Keep the numbers exactly as measured.

### Failures

| Scenario | Project | Width | Top or foot | Problem, as the spec printed it | Screenshot |
| -------- | ------- | ----- | ----------- | ------------------------------- | ---------- |
|          |         |       |             |                                 |            |

### The real iPhone probe

Paste the probe output here, or write "Not needed: Playwright reproduced it."

### Root cause

1 paragraph. Name the element, the file and line, the CSS rule, and why the iPhone
shows it. Name the scenario where it starts.

### The suspects

| Id  | Confirmed or ruled out | Evidence |
| --- | ---------------------- | -------- |
| S1  |                        |          |
| S2  |                        |          |
| S3  |                        |          |
| S4  |                        |          |
| S5  |                        |          |
| S6  |                        |          |

### The fix B2 should apply

Name the candidate fix ids from `B2-fix-workout-layout.md`. Add a new one if the
cause is none of S1 to S6, with the exact code change.

## Acceptance criteria

- [ ] `tests/e2e/workout-layout.spec.ts` covers 5 scenarios at 320, 375, 390 and
      430 px, at the top and the foot of the page.
- [ ] Each scenario attaches 1 screenshot per width.
- [ ] At least 1 scenario fails on at least 1 project for the cause in **Findings**.
      Each failing pair is in `KNOWN_BREAKS`, so it reports as an expected failure.
- [ ] **Findings** names the root cause with the element, the file and line, and the
      measured numbers.
- [ ] **Findings** marks each suspect S1 to S6 as confirmed or ruled out, with
      evidence.
- [ ] No file under `app/`, `components/` or `lib/` changes.

### The gate and the dependencies

- [ ] W0 is merged: every dependency check in "Before you start" prints `ok`.
- [ ] Every e2e run went through `node scripts/e2e-lock.mjs`. Manual check: the commands in the report's "Evidence".
- [ ] The staged diff holds only `tests/e2e/workout-layout.spec.ts` and this step file. Manual check: `git diff --cached --stat`.
- [ ] `pnpm verify:parallel` passes, with the known breaks shown as expected failures. Manual check: "When the step is done", item 1.

## Tests

The 5 tests in `tests/e2e/workout-layout.spec.ts` map to the first 3 criteria. The
other 3 criteria are checked by reading the step file and `git diff --cached --stat`.

## Verification

1. `node scripts/e2e-lock.mjs pnpm exec playwright test tests/e2e/workout-layout.spec.ts` passes, with the
   expected failures shown as expected.
2. `git diff --cached --stat` lists only the spec and this step file.
3. `pnpm verify:parallel`.

## Files touched

- `tests/e2e/workout-layout.spec.ts` (new)
- `docs/plan/feedback/B1-reproduce-workout.md` (the **Findings** section)

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer when another step runs its e2e suite. Never skip a check, and never add a design-check or test exemption to pass.
2. Stage the files from "Files touched", including the tests. Then run the `commit-report` skill. The skill reports on the staged diff, so stage first:
   ```bash
   git add tests/e2e/workout-layout.spec.ts docs/plan/feedback/B1-reproduce-workout.md
   ```
   This is not a UI change, but put the failing screenshots from the spec into the report's evidence, beside the probe output.
3. Commit on `fix/b1-reproduce-workout`. This step file tells you to commit, so you commit, not the owner:
   ```bash
   git commit -m "test(test): reproduce the /workout layout break on a phone"
   ```
   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.
4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked, and anything the owner must check on the iPhone. For this step: the root cause from **Findings**, and whether the owner ran the iPhone probe.
