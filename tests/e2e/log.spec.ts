import { expect, test } from '@playwright/test'

test('keeps the daily log behind the session guard', async ({ page }) => {
  await page.goto('/log')

  await expect(page).toHaveURL(/\/sign-in$/)
})

test('parses a duration in the browser, with no network and no server round trip', async ({
  page,
  context,
}) => {
  await page.goto('/styleguide')
  await context.setOffline(true)

  const sample = page.getByTestId('duration-sample')
  const field = sample.getByLabel('Gym time')
  await field.fill('72m')

  await expect(sample.getByText('Stored seconds: 4320')).toBeVisible()
  await expect(sample.getByText('1:12:00 · 1h 12m')).toBeVisible()

  await context.setOffline(false)
})
