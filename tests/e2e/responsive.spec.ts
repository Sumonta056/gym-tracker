import { expect, test } from '@playwright/test'

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

test('keeps every tap target 44 px or taller inside the open sheet, at all seven widths', async ({
  page,
}) => {
  await page.goto('/styleguide')
  await page.getByRole('button', { name: 'Open the sheet' }).click()
  await expect(page.getByRole('dialog', { name: 'Log a set' })).toBeVisible()

  expect(await atEachWidth(page, STEP_WIDTHS, () => smallTargets(page))).toEqual([])
  expect(await atEachWidth(page, STEP_WIDTHS, () => sideways(page))).toEqual([])
})

test('keeps the dashboard, log and profile samples inside the page at 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/styleguide')

  for (const id of ['dashboard-sample', 'log-sample', 'profile-grid-sample']) {
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

for (const route of SHELL_ROUTES) {
  test(`shows exactly one navigation at every width on ${route}`, async ({ page }) => {
    await page.goto(route)

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    const bottomBar = page.getByRole('navigation', { name: 'Bottom navigation' })

    for (const width of SCROLL_WIDTHS) {
      await resizeAndSettle(page, width)
      const sidebarVisible = await sidebar.isVisible()
      const bottomBarVisible = await bottomBar.isVisible()

      expect(
        { width, sidebarVisible, bottomBarVisible },
        `at ${String(width)}px exactly one navigation must be visible`,
      ).toEqual({
        width,
        sidebarVisible: width >= SIDEBAR_BREAKPOINT,
        bottomBarVisible: width < SIDEBAR_BREAKPOINT,
      })
    }
  })

  test(`keeps the navigation in view at the foot of a long page on ${route}`, async ({ page }) => {
    await page.goto(route)

    for (const width of STEP_WIDTHS) {
      await resizeAndSettle(page, width)
      await page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight)
      })
      const name = width >= SIDEBAR_BREAKPOINT ? 'Sidebar' : 'Bottom navigation'
      const box = await page.getByRole('navigation', { name }).boundingBox()

      expect(box, `${name} at ${String(width)}px`).not.toBeNull()
      expect(box?.y ?? -2, `${name} top at ${String(width)}px`).toBeGreaterThanOrEqual(-1)
      expect(box?.y ?? 901, `${name} top at ${String(width)}px`).toBeLessThan(900)
    }
  })
}
