import { expect, test } from '@playwright/test'

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

test.fixme('shows on the dashboard the value saved by the /log test (needs the signed-in fixture from step 1.16)', async ({
  page,
}) => {
  await page.goto('/log')
  await page.getByLabel('Gym time').fill('1:12:05')
  await page.getByRole('button', { name: 'Save entry' }).click()
  await page.goto('/')

  await expect(page.getByText('1:12:05')).toBeVisible()
})
