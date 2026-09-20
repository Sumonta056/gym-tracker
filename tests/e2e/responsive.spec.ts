import { expect, test } from '@playwright/test'

const ROUTES = ['/', '/styleguide']
const WIDTHS = [320, 360, 390, 414, 640, 768, 834, 1024, 1280, 1440, 1920, 2560]
const TAP_TARGET_WIDTHS = [390, 768, 1440]
const MINIMUM_TAP_TARGET = 44
const SIDEBAR_BREAKPOINT = 1024

const CONTROL_SELECTOR = 'a, button, input, select, textarea, [role="button"], [role="tab"]'

for (const route of ROUTES) {
  test(`never scrolls sideways on ${route}, from 320 px to 2560 px`, async ({ page }) => {
    await page.goto(route)

    const overflowing: string[] = []

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      const box = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      if (box.scrollWidth > box.clientWidth) {
        overflowing.push(
          `${String(width)}px: ${String(box.scrollWidth)} > ${String(box.clientWidth)}`,
        )
      }
    }

    expect(overflowing).toEqual([])
  })

  test(`keeps every tap target 44 px or taller on ${route}`, async ({ page }) => {
    await page.goto(route)

    const small: string[] = []

    for (const width of TAP_TARGET_WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      const found = await page.evaluate(
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
      small.push(...found.map((entry) => `${String(width)}px: ${entry}`))
    }

    expect(small).toEqual([])
  })

  test(`shows exactly one navigation at every width on ${route}`, async ({ page }) => {
    await page.goto(route)

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    const bottomBar = page.getByRole('navigation', { name: 'Bottom navigation' })

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
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
}
