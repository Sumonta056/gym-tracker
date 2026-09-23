import { expect, test } from '@playwright/test'

test('switches the target weight to pounds from the unit toggle, on the style guide sample', async ({
  page,
}) => {
  await page.goto('/styleguide')

  const profile = page.getByTestId('profile-grid-sample')

  await expect(profile.getByLabel('Target weight (kg)')).toHaveValue('71.0')
  await profile.getByRole('button', { name: 'Imperial' }).click()
  await expect(profile.getByRole('button', { name: 'Imperial' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(profile.getByLabel('Target weight (lb)')).toHaveValue('156.5')
  await expect(profile.getByText('Weight shows in pounds (lb).')).toBeVisible()
})

test('keeps the Phase 2 import card out of the profile sample', async ({ page }) => {
  await page.goto('/styleguide')

  await expect(
    page.getByTestId('profile-grid-sample').getByRole('button', { name: 'Import the Excel CSV' }),
  ).toHaveCount(0)
})

test.fixme('signs out, empties the device and lands on /sign-in (needs the signed-in fixture from step 1.16)', async ({
  page,
}) => {
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Sign out' }).click()

  await expect(page).toHaveURL(/\/sign-in$/)
})
