import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const UNAUTHENTICATED_ROUTES = ['/sign-in', '/styleguide']

for (const route of UNAUTHENTICATED_ROUTES) {
  test(`reports no serious or critical accessibility issue on ${route}`, async ({ page }) => {
    const response = await page.goto(route)

    expect(response?.status()).toBe(200)

    const results = await new AxeBuilder({ page }).analyze()
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    )

    expect(blocking.map((violation) => `${violation.id} (${String(violation.impact)})`)).toEqual([])
  })
}
