import { expect, test } from '@playwright/test'

import { signIn } from './support/account'
import { readStore, test as signedIn, waitForLocalDays } from './support/signedIn'

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

signedIn.describe('with a session of its own', () => {
  signedIn.use({ storageState: { cookies: [], origins: [] } })

  signedIn(
    'signs out, empties the device and lands on /sign-in',
    async ({ page, context, account, day, baseURL }) => {
      await context.addCookies(await signIn(new URL(baseURL ?? '').hostname))
      await account.seed([{ entry_date: day.date, gym_seconds: 2400 }])
      await page.goto('/profile')
      await waitForLocalDays(page, [day.date])
      await expect(page.getByRole('term').filter({ hasText: 'Pending writes' })).toBeVisible()

      await page.getByRole('button', { name: 'Sign out' }).click()

      await expect(page).toHaveURL(/\/sign-in$/)
      expect(await readStore(page, 'dailyEntries')).toEqual([])
      expect(await readStore(page, 'profiles')).toEqual([])
      expect(await readStore(page, 'outbox')).toEqual([])
      const cookies = await context.cookies()
      expect(cookies.filter((cookie) => cookie.name.startsWith('sb-'))).toEqual([])
      await page.goto('/')
      await expect(page).toHaveURL(/\/sign-in$/)
    },
  )
})
