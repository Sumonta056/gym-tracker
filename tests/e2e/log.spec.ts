import { expect, test } from '@playwright/test'

test('keeps the daily log behind the session guard', async ({ page }) => {
  await page.goto('/log')

  await expect(page).toHaveURL(/\/sign-in$/)
})

test('sets a duration with taps in the browser, with no network', async ({ page, context }) => {
  await page.goto('/styleguide')
  await context.setOffline(true)

  const sample = page.getByTestId('duration-picker-sample')
  await expect(sample).toHaveAttribute('data-ready', 'true')
  const gym = sample.getByRole('group', { name: 'Gym time' })
  await gym.getByRole('button', { name: '45m', exact: true }).click()
  await gym.getByRole('button', { name: 'Increase Gym time by 15 seconds' }).click()

  await expect(sample.getByText('Rest seconds: 90 · Gym seconds: 2715')).toBeVisible()
  await expect(gym.getByRole('status')).toHaveText('45:15')

  await context.setOffline(false)
})
