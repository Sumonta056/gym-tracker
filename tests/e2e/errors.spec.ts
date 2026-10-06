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

test('a newer database version in another tab shows the reload banner', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('dashboard-grid')).toBeVisible()

  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('gym-tracker', 10000)
        request.onsuccess = () => {
          request.result.close()
          resolve()
        }
        request.onerror = () => {
          reject(new Error(String(request.error)))
        }
      }),
  )

  const banner = page.getByRole('alert').filter({ hasText: 'A new version is ready.' })
  await expect(banner).toBeVisible()
  await expect(banner.getByRole('button', { name: 'Reload' })).toBeVisible()
})
