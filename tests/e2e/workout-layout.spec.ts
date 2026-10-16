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
