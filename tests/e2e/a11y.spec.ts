import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

import type { Page } from '@playwright/test'

const PUBLIC_ROUTES = ['/sign-in', '/styleguide', '/~offline']
const SIGNED_IN_ROUTES = ['/', '/log', '/analytics', '/profile']
const FOCUS_WIDTHS = [390, 1440]
const MOST_TAB_STOPS = 400

async function blocking(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).analyze()
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map(
      (violation) =>
        `${violation.id} (${String(violation.impact)}): ${violation.nodes
          .slice(0, 3)
          .map((node) => node.target.join(' '))
          .join(' | ')}`,
    )
}

function tabKey(browserName: string): string {
  return browserName === 'webkit' ? 'Alt+Tab' : 'Tab'
}

async function tabStopsWithNoRing(
  page: Page,
  key: string,
): Promise<{ stops: number; bare: string[] }> {
  await page.locator('body').focus()
  const bare: string[] = []
  const seen = new Set<string>()
  let stops = 0

  for (let index = 0; index < MOST_TAB_STOPS; index += 1) {
    await page.keyboard.press(key)
    const stop = await page.evaluate(() => {
      const element = document.activeElement
      if (!(element instanceof HTMLElement) || element === document.body) return null
      const path: string[] = []
      for (let node: Element | null = element; node !== null; node = node.parentElement) {
        path.unshift(String(Array.from(node.parentElement?.children ?? []).indexOf(node)))
      }
      const style = getComputedStyle(element)
      const ring =
        (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) ||
        style.boxShadow !== 'none'
      const name = (element.getAttribute('aria-label') ?? element.textContent).trim().slice(0, 30)
      return { key: path.join('.'), ring, label: `${element.tagName} "${name}"` }
    })
    if (stop === null || seen.has(stop.key)) break
    seen.add(stop.key)
    stops += 1
    if (!stop.ring) bare.push(stop.label)
  }

  return { stops, bare }
}

for (const route of PUBLIC_ROUTES) {
  test(`reports no serious or critical accessibility issue on ${route}`, async ({ page }) => {
    const response = await page.goto(route)

    expect(response?.status()).toBe(200)
    expect(await blocking(page)).toEqual([])
  })

  test(`shows a focus ring on every tab stop on ${route}`, async ({ page, browserName }) => {
    await page.goto(route)

    for (const width of FOCUS_WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      const { stops, bare } = await tabStopsWithNoRing(page, tabKey(browserName))

      expect(stops, `tab stops at ${String(width)}px`).toBeGreaterThan(0)
      expect(bare, `stops with no ring at ${String(width)}px`).toEqual([])
    }
  })
}

for (const route of SIGNED_IN_ROUTES) {
  test(`reports no serious or critical accessibility issue where ${route} sends a visitor with no session`, async ({
    page,
  }) => {
    await page.goto(route)
    await expect(page).toHaveURL(/\/sign-in$/)

    expect(await blocking(page)).toEqual([])
  })
}

test('reports no serious or critical accessibility issue with every error state shown on the style guide', async ({
  page,
}) => {
  await page.goto('/styleguide')
  for (const name of ['Show the error state', 'Show the email error', 'Show the sign-out error']) {
    await page.getByRole('button', { name }).click()
  }
  await page.getByRole('button', { name: 'Show two pending writes' }).click()

  expect(await blocking(page)).toEqual([])
})

test('reports no serious or critical accessibility issue with the sheet open', async ({ page }) => {
  await page.goto('/styleguide')
  await page.getByRole('button', { name: 'Open the sheet' }).click()
  await expect(page.getByRole('dialog', { name: 'Log a set' })).toBeVisible()

  expect(await blocking(page)).toEqual([])
})

test('moves focus into the sheet, keeps it there and returns it to the opener', async ({
  page,
  browserName,
}) => {
  await page.goto('/styleguide')
  const opener = page.getByRole('button', { name: 'Open the sheet' })
  await opener.focus()
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog', { name: 'Log a set' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Close Log a set' })).toBeFocused()

  for (let index = 0; index < 6; index += 1) {
    await page.keyboard.press(tabKey(browserName))
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true)
  }

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
})
