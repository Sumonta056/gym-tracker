import { expect, test } from '@playwright/test'

import { heroValue, test as signedIn } from './support/signedIn'

test('reads the heart rate zones outside the bar, on the style guide sample', async ({ page }) => {
  await page.goto('/styleguide')

  await expect(
    page.getByRole('img', {
      name: 'Heart rate zones: Warm 8m, Fat burn 38m, Cardio 21m, Peak 5m',
    }),
  ).toBeVisible()

  for (const text of ['Warm 8m', 'Fat burn 38m', 'Cardio 21m', 'Peak 5m']) {
    await expect(page.getByText(text, { exact: true })).toBeVisible()
  }
})

test('points the empty hero at the daily log, on the style guide sample', async ({ page }) => {
  await page.goto('/styleguide')

  const empty = page.getByRole('region', { name: 'Today, empty state' })

  await expect(empty.getByRole('link', { name: 'Log the day' })).toHaveAttribute('href', '/log')
})

signedIn('shows on the dashboard the value saved on /log', async ({ page }) => {
  await page.goto('/log')
  await page.getByLabel('Gym time').fill('1:12:05')
  await page.getByRole('button', { name: 'Save entry' }).click()
  await expect(page.getByText('Saved on this device.')).toBeVisible()
  await page.goto('/')

  await expect(heroValue(page)).toHaveText('1:12:05')
})
