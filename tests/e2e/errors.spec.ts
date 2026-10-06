import { expect, test } from './support/signedIn'

test('a render error on an app route shows the Reload screen, not a blank page', async ({
  page,
}) => {
  await page.goto('/crash-test')

  await expect(page.getByRole('heading', { name: 'Something went wrong.' })).toBeVisible()
  await expect(page.getByText('Your data is safe on this device.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy error' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Today', exact: true }).first()).toBeAttached()
})

test('Reload on the error screen loads the page again', async ({ page }) => {
  await page.goto('/crash-test')
  await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible()

  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Reload' }).click(),
  ])

  await expect(page.getByRole('heading', { name: 'Something went wrong.' })).toBeVisible()
})
