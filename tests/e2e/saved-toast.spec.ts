import { expect, recordDay, test } from './support/signedIn'
import { benchCard, openLiveSession, pullOnlyThisWindow } from './support/workout'

test.use({ serviceWorkers: 'block' })

test.beforeEach(async ({ context, day }) => {
  await pullOnlyThisWindow(context, day)
})

test('shows Saved after a day is saved, then hides it', async ({ page }) => {
  await page.goto('/log')
  await expect(page.getByLabel('Gym time')).toBeVisible()

  await recordDay(page, { gym: '1:00:00', steps: '9000' })

  const toast = page.getByTestId('toast-region')
  await expect(toast).toHaveText('Saved')
  await expect(toast).toBeEmpty({ timeout: 4000 })
})

test('shows Saved after a set is edited, clear of the undo toast', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openLiveSession(page, context)

  await benchCard(page)
    .getByRole('button', { name: /^Edit set 1,/ })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Edit set 1' })
  await dialog.getByLabel('Reps').fill('10')
  await dialog.getByRole('button', { name: 'Save set' }).click()

  const toast = page.getByTestId('toast-region')
  await expect(toast).toHaveText('Saved')
  const saved = await toast.getByText('Saved').boundingBox()
  const undo = await page.getByTestId('undo-region').boundingBox()
  expect((saved?.y ?? 0) + (saved?.height ?? 0)).toBeLessThanOrEqual(undo?.y ?? 0)
})

test('finishes a session and opens /workouts with no page load', async ({ page, context, day }) => {
  await openLiveSession(page, context)
  await page.evaluate(() => {
    Object.assign(window, { stayedInTheApp: true })
  })

  await page.clock.setSystemTime(new Date(day.noon().getTime() + 3_600_000))
  await page.getByRole('button', { name: 'Finish session' }).click()
  await page
    .getByRole('dialog', { name: 'Session finished' })
    .getByRole('button', { name: 'Not now' })
    .click()

  await expect(page).toHaveURL(/\/workouts$/)
  await expect(page.getByRole('button', { name: 'Start a session' })).toBeVisible()
  expect(await page.evaluate(() => 'stayedInTheApp' in window)).toBe(true)
})
