import AxeBuilder from '@axe-core/playwright'
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
  await page.getByLabel('Password').fill('secret')
  await page.getByRole('button', { name: 'Sign in' }).click()

  const field = page.getByLabel('Email')
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Enter an email address like you@example.com.')).toBeVisible()
  await expect(page).toHaveURL(/\/sign-in$/)
})

test('refuses an empty password without leaving the screen', async ({ page }) => {
  await page.goto('/sign-in')

  await page.getByLabel('Email').fill('you@example.com')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByLabel('Password')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Enter your password.')).toBeVisible()
  await expect(page).toHaveURL(/\/sign-in$/)
})

test('switches to the magic link form and back', async ({ page }) => {
  await page.goto('/sign-in')

  await page.getByRole('button', { name: 'Email me a link instead' }).click()
  await expect(page.getByRole('button', { name: 'Send magic link' })).toBeVisible()
  await expect(page.getByLabel('Password')).toHaveCount(0)

  await page.getByRole('button', { name: 'Use password instead' }).click()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})

test('lets an anonymous visitor reach the sign up screen directly', async ({ page }) => {
  const response = await page.goto('/sign-up')

  expect(response?.status()).toBe(200)
  await expect(page).toHaveURL(/\/sign-up$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Gym Tracker' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
})

test('shows every field error on an empty sign up without leaving the screen', async ({ page }) => {
  await page.goto('/sign-up')

  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByLabel('Name')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel('Password')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Enter your name.')).toBeVisible()
  await expect(page.getByText('Enter an email address like you@example.com.')).toBeVisible()
  await expect(page.getByText('Use 8 or more characters.')).toBeVisible()
  await expect(page).toHaveURL(/\/sign-up$/)
})

test('reports no serious or critical axe issue on the sign up screen with its errors shown', async ({
  page,
}) => {
  await page.goto('/sign-up')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByLabel('Password')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Use 8 or more characters.')).toBeVisible()

  const results = await new AxeBuilder({ page }).analyze()
  const blocking = results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => violation.id)
  expect(blocking).toEqual([])
})

test('goes from sign in to sign up and back by the links', async ({ page }) => {
  await page.goto('/sign-in')

  await page.getByRole('link', { name: 'Create an account' }).click()
  await expect(page).toHaveURL(/\/sign-up$/)
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()

  await page.getByRole('link', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})
