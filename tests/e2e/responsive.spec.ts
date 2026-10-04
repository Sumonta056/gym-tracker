import { expect, test } from '@playwright/test'

import { openImportReview } from './support/sheet'
import {
  openRoute,
  openWithWeek,
  SIGNED_IN_ROUTES as LIVE_ROUTES,
  test as signedIn,
} from './support/signedIn'
import { openLiftCharts, openLiveSession, openPicker } from './support/workout'

import type { Page } from '@playwright/test'

const PUBLIC_ROUTES = ['/sign-in', '/styleguide', '/~offline']
const SIGNED_IN_ROUTES = ['/', '/log', '/analytics', '/profile']
const SHELL_ROUTES = ['/styleguide']
const STEP_WIDTHS = [320, 390, 430, 768, 1024, 1440, 2560]
const SCROLL_WIDTHS = [...new Set([...STEP_WIDTHS, 360, 414, 640, 834, 1280, 1920])].sort(
  (a, b) => a - b,
)
const MINIMUM_TAP_TARGET = 44
const SIDEBAR_BREAKPOINT = 1024

const CONTROL_SELECTOR = 'a, button, input, select, textarea, [role="button"], [role="tab"]'

function staleCharts(page: Page): Promise<number> {
  return page.evaluate(async () => {
    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve)
      })
    })
    return Array.from(document.querySelectorAll('.recharts-responsive-container')).filter(
      (container) => {
        const surface = container.querySelector('.recharts-wrapper')
        if (surface === null) return false
        const inner = surface.getBoundingClientRect().width
        return Math.abs(inner - container.getBoundingClientRect().width) > 1
      },
    ).length
  })
}

async function resizeAndSettle(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 })
  await expect
    .poll(() => staleCharts(page), { message: `charts settle at ${String(width)}px` })
    .toBe(0)
}

async function atEachWidth(
  page: Page,
  widths: readonly number[],
  check: () => Promise<string[]>,
): Promise<string[]> {
  const found: string[] = []
  for (const width of widths) {
    await resizeAndSettle(page, width)
    found.push(...(await check()).map((entry) => `${String(width)}px: ${entry}`))
  }
  return found
}

function sideways(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const root = document.documentElement
    const out: string[] = []
    if (root.scrollWidth > root.clientWidth) {
      out.push(`page ${String(root.scrollWidth)} > ${String(root.clientWidth)}`)
    }
    for (const element of document.body.querySelectorAll('*')) {
      const box = element.getBoundingClientRect()
      if (box.width === 0 || box.right <= root.clientWidth + 0.5) continue
      let parent = element.parentElement
      let contained = false
      while (parent !== null && parent !== document.body) {
        const overflow = getComputedStyle(parent).overflowX
        if (overflow !== 'visible') {
          contained = true
          break
        }
        parent = parent.parentElement
      }
      if (!contained) {
        out.push(`${element.tagName.toLowerCase()} ends at ${String(Math.round(box.right))}`)
      }
    }
    return out
  })
}

function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(
    ({ selector, minimum }) => {
      const out: string[] = []
      for (const element of document.querySelectorAll(selector)) {
        const box = element.getBoundingClientRect()
        if (box.width === 0 && box.height === 0) continue
        if (box.height < minimum) {
          const label = element.textContent.trim().slice(0, 30)
          out.push(`${element.tagName} "${label}" ${String(Math.round(box.height))}px`)
        }
      }
      return out
    },
    { selector: CONTROL_SELECTOR, minimum: MINIMUM_TAP_TARGET },
  )
}

function clippedText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = []
    for (const element of document.body.querySelectorAll<HTMLElement>('*')) {
      if (element.closest('svg, .sr-only') !== null) continue
      if (element.textContent.trim() === '') continue
      const style = getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      const hides =
        style.overflowX === 'hidden' || style.overflowX === 'clip' || style.textOverflow !== 'clip'
      const hidesDown = style.overflowY === 'hidden' || style.overflowY === 'clip'
      const wide = hides && element.scrollWidth > element.clientWidth + 1
      const tall = hidesDown && element.scrollHeight > element.clientHeight + 1
      if (wide || tall) {
        out.push(`${element.tagName.toLowerCase()} "${element.textContent.trim().slice(0, 30)}"`)
      }
    }
    return out
  })
}

for (const route of PUBLIC_ROUTES) {
  test(`never scrolls sideways on ${route}, from 320 px to 2560 px`, async ({ page }) => {
    await page.goto(route)

    expect(await atEachWidth(page, SCROLL_WIDTHS, () => sideways(page))).toEqual([])
  })

  test(`keeps every tap target 44 px or taller on ${route}, at all seven widths`, async ({
    page,
  }) => {
    await page.goto(route)

    expect(await atEachWidth(page, STEP_WIDTHS, () => smallTargets(page))).toEqual([])
  })

  test(`clips no text on ${route}, at all seven widths`, async ({ page }) => {
    await page.goto(route)

    expect(await atEachWidth(page, STEP_WIDTHS, () => clippedText(page))).toEqual([])
  })
}

test('never scrolls sideways on the import review sample at 320 px, with the year form open', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/styleguide')
  const sample = page.getByTestId('import-review-sample')
  await sample.getByRole('button', { name: 'Change year' }).click()
  await expect(sample.getByLabel('Year of the sheet')).toBeVisible()

  expect(await sideways(page)).toEqual([])
  expect(await smallTargets(page)).toEqual([])
})

test('fits the three import choices at 14 px inside their card at 320 px, each 44 px tall', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/styleguide')
  const groups = page.getByRole('group', { name: /already logged$|^Apply to all duplicates$/ })
  await expect(groups).not.toHaveCount(0)

  const problems: string[] = []
  for (const group of await groups.all()) {
    await group.scrollIntoViewIfNeeded()
    problems.push(
      ...(await group.evaluate((element) => {
        const out: string[] = []
        const name = element.getAttribute('aria-label') ?? ''
        const card = element.closest('[data-testid], li, td') ?? element.parentElement
        const limit = card === null ? Infinity : card.getBoundingClientRect().right + 0.5
        if (element.getBoundingClientRect().right > limit)
          out.push(`${name}: group spills its card`)
        for (const button of element.querySelectorAll('button')) {
          const box = button.getBoundingClientRect()
          const size = getComputedStyle(button).fontSize
          if (size !== '14px') out.push(`${name} ${button.textContent}: ${size}`)
          if (box.height < 44)
            out.push(`${name} ${button.textContent}: ${String(box.height)}px tall`)
          if (button.scrollWidth > button.clientWidth) {
            out.push(
              `${name} ${button.textContent}: text ${String(button.scrollWidth)} > ${String(button.clientWidth)}`,
            )
          }
        }
        return out
      })),
    )
  }

  expect(problems).toEqual([])
  expect(await sideways(page)).toEqual([])
})

test('fits every import table heading inside its cell at 1024 px and 1440 px', async ({ page }) => {
  await page.goto('/styleguide')

  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const table = page.getByTestId('import-review-sample').getByRole('table')
    await table.scrollIntoViewIfNeeded()
    await expect(table).toBeVisible()

    const spills = await table.evaluate((element) =>
      Array.from(element.querySelectorAll('th')).flatMap((cell) => {
        const style = getComputedStyle(cell)
        const inner =
          cell.getBoundingClientRect().right - Number.parseFloat(style.paddingRight) + 0.5
        const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT)
        let right = 0
        for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
          const range = document.createRange()
          range.selectNodeContents(node)
          right = Math.max(right, range.getBoundingClientRect().right)
        }
        const overflow = cell.scrollWidth > cell.clientWidth || right > inner
        return overflow ? [`${cell.textContent.trim()} ${String(cell.clientWidth)}px`] : []
      }),
    )

    expect(spills, `${String(width)}px`).toEqual([])
  }
})

test('keeps every tap target 44 px or taller inside the open sheet, at all seven widths', async ({
  page,
}) => {
  await page.goto('/styleguide')
  await page.getByRole('button', { name: 'Open the sheet' }).click()
  await expect(page.getByRole('dialog', { name: 'Log a set' })).toBeVisible()

  expect(await atEachWidth(page, STEP_WIDTHS, () => smallTargets(page))).toEqual([])
  expect(await atEachWidth(page, STEP_WIDTHS, () => sideways(page))).toEqual([])
})

test('keeps the dashboard, log, profile and import review samples inside the page at 320 px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/styleguide')

  for (const id of [
    'dashboard-sample',
    'log-sample',
    'profile-grid-sample',
    'import-review-sample',
  ]) {
    const sample = page.getByTestId(id)
    await sample.scrollIntoViewIfNeeded()
    const box = await sample.boundingBox()
    expect(box, id).not.toBeNull()
    expect((box?.x ?? 0) + (box?.width ?? 0), id).toBeLessThanOrEqual(320)
  }
})

for (const route of SIGNED_IN_ROUTES) {
  test(`sends a visitor with no session from ${route} to a sign in screen that fits every width`, async ({
    page,
  }) => {
    await page.goto(route)
    await expect(page).toHaveURL(/\/sign-in$/)

    expect(await atEachWidth(page, STEP_WIDTHS, () => sideways(page))).toEqual([])
  })
}

async function navigationProblems(page: Page): Promise<string[]> {
  const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
  const bottomBar = page.getByRole('navigation', { name: 'Bottom navigation' })
  const found: string[] = []

  for (const width of SCROLL_WIDTHS) {
    await resizeAndSettle(page, width)
    const sidebarVisible = await sidebar.isVisible()
    const bottomBarVisible = await bottomBar.isVisible()

    if (sidebarVisible !== width >= SIDEBAR_BREAKPOINT) {
      found.push(`${String(width)}px: sidebar ${sidebarVisible ? 'shown' : 'hidden'}`)
    }
    if (bottomBarVisible !== width < SIDEBAR_BREAKPOINT) {
      found.push(`${String(width)}px: bottom bar ${bottomBarVisible ? 'shown' : 'hidden'}`)
    }
  }

  return found
}

async function navigationOutOfView(page: Page): Promise<string[]> {
  const found: string[] = []

  for (const width of STEP_WIDTHS) {
    await resizeAndSettle(page, width)
    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight)
    })
    const name = width >= SIDEBAR_BREAKPOINT ? 'Sidebar' : 'Bottom navigation'
    const box = await page.getByRole('navigation', { name }).boundingBox()

    if (box === null || box.y < -1 || box.y >= 900) {
      found.push(`${String(width)}px: ${name} top at ${box === null ? 'none' : String(box.y)}`)
    }
  }

  return found
}

for (const route of SHELL_ROUTES) {
  test(`shows exactly one navigation at every width on ${route}`, async ({ page }) => {
    await page.goto(route)

    expect(await navigationProblems(page)).toEqual([])
  })

  test(`keeps the navigation in view at the foot of a long page on ${route}`, async ({ page }) => {
    await page.goto(route)

    expect(await navigationOutOfView(page)).toEqual([])
  })
}

for (const route of LIVE_ROUTES) {
  signedIn.describe(`signed in on ${route}`, () => {
    signedIn.beforeEach(async ({ page, account, day }) => {
      await openWithWeek(page, account, day)
      await openRoute(page, route)
    })

    signedIn('never scrolls sideways, from 320 px to 2560 px', async ({ page }) => {
      expect(await atEachWidth(page, SCROLL_WIDTHS, () => sideways(page))).toEqual([])
    })

    signedIn('keeps every tap target 44 px or taller, at all seven widths', async ({ page }) => {
      expect(await atEachWidth(page, STEP_WIDTHS, () => smallTargets(page))).toEqual([])
    })

    signedIn('clips no text, at all seven widths', async ({ page }) => {
      expect(await atEachWidth(page, STEP_WIDTHS, () => clippedText(page))).toEqual([])
    })

    signedIn('shows exactly one navigation at every width', async ({ page }) => {
      expect(await navigationProblems(page)).toEqual([])
    })

    signedIn(
      'keeps the navigation in view at the foot of the page, at all seven widths',
      async ({ page }) => {
        expect(await navigationOutOfView(page)).toEqual([])
      },
    )
  })
}

signedIn.describe('signed in on /workout with a set logged', () => {
  signedIn.use({ serviceWorkers: 'block' })

  signedIn.beforeEach(async ({ page, context }) => {
    await openLiveSession(page, context)
  })

  signedIn('never scrolls sideways, from 320 px to 2560 px', async ({ page }) => {
    expect(await atEachWidth(page, SCROLL_WIDTHS, () => sideways(page))).toEqual([])
  })

  signedIn('keeps every tap target 44 px or taller, at all seven widths', async ({ page }) => {
    expect(await atEachWidth(page, STEP_WIDTHS, () => smallTargets(page))).toEqual([])
  })

  signedIn('shows exactly one navigation at every width', async ({ page }) => {
    expect(await navigationProblems(page)).toEqual([])
  })
})

signedIn.describe('signed in on /workout with the exercise picker open', () => {
  signedIn.use({ serviceWorkers: 'block' })

  signedIn.beforeEach(async ({ page, context }) => {
    await openLiveSession(page, context)
    await openPicker(page)
  })

  signedIn('never scrolls sideways, from 320 px to 2560 px', async ({ page }) => {
    expect(await atEachWidth(page, SCROLL_WIDTHS, () => sideways(page))).toEqual([])
  })

  signedIn('keeps every tap target 44 px or taller, at all seven widths', async ({ page }) => {
    expect(await atEachWidth(page, STEP_WIDTHS, () => smallTargets(page))).toEqual([])
  })
})

signedIn.describe('signed in on the import review, with the sheet fixture open', () => {
  signedIn.beforeEach(async ({ page, account, day }) => {
    await openImportReview(page, account, day)
  })

  signedIn('never scrolls sideways, from 320 px to 2560 px', async ({ page }) => {
    expect(await atEachWidth(page, SCROLL_WIDTHS, () => sideways(page))).toEqual([])
  })

  signedIn('keeps every tap target 44 px or taller, at all seven widths', async ({ page }) => {
    expect(await atEachWidth(page, STEP_WIDTHS, () => smallTargets(page))).toEqual([])
  })

  signedIn('shows exactly one navigation at every width', async ({ page }) => {
    expect(await navigationProblems(page)).toEqual([])
  })
})

signedIn.describe('signed in on /analytics with lift and week charts', () => {
  signedIn.beforeEach(async ({ page, context, account, day }) => {
    await openLiftCharts(page, context, account, day)
  })

  signedIn('never scrolls sideways, from 320 px to 2560 px', async ({ page }) => {
    expect(await atEachWidth(page, SCROLL_WIDTHS, () => sideways(page))).toEqual([])
  })

  signedIn('keeps every tap target 44 px or taller, at all seven widths', async ({ page }) => {
    expect(await atEachWidth(page, STEP_WIDTHS, () => smallTargets(page))).toEqual([])
  })

  signedIn('shows exactly one navigation at every width', async ({ page }) => {
    expect(await navigationProblems(page)).toEqual([])
  })
})
