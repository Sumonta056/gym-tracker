import { expect, test } from '@playwright/test'

test('sends an anonymous visitor from the dashboard to the sign in screen', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Gym Tracker' })).toBeVisible()
})

test('lets an anonymous visitor reach the sign in screen directly', async ({ page }) => {
  const response = await page.goto('/sign-in')

  expect(response?.status()).toBe(200)
  await expect(page).toHaveURL(/\/sign-in$/)
})

test('keeps the styleguide reachable without a session', async ({ page }) => {
  const response = await page.goto('/styleguide')

  expect(response?.status()).toBe(200)
  await expect(page).toHaveURL(/\/styleguide$/)
})

test('refuses an invalid email without leaving the screen', async ({ page }) => {
  await page.goto('/sign-in')

  await page.getByLabel('Email').fill('not-an-email')
  await page.getByRole('button', { name: 'Send magic link' }).click()

  const field = page.getByLabel('Email')
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Enter an email address like you@example.com.')).toBeVisible()
  await expect(page).toHaveURL(/\/sign-in$/)
})
