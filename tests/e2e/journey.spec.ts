import { test as anonymous } from '@playwright/test'

import { headerDate } from '../../components/dashboard/summary'

import {
  consoleErrors,
  expect,
  heroValue,
  stepsCard,
  navLink,
  openWithWeek,
  recordDay,
  test,
} from './support/signedIn'

anonymous('sends an anonymous visit to the sign in screen', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})

test('lands a signed-in visitor on the dashboard, even from the sign in screen', async ({
  page,
  day,
}) => {
  await page.goto('/sign-in')

  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/)
  await expect(
    page.getByRole('heading', { level: 1, name: headerDate(day.date).dayMonth }),
  ).toBeVisible()
  await expect(page.getByRole('region', { name: 'Today' })).toBeVisible()
})

test('changes the dashboard numbers once a day is recorded', async ({ page }) => {
  await page.goto('/')
  const grid = page.getByTestId('dashboard-grid')
  await expect(grid.getByText('Nothing logged yet today.')).toBeVisible()
  await expect(grid.getByRole('progressbar', { name: 'Steps progress' })).toHaveAttribute(
    'aria-valuenow',
    '0',
  )

  await navLink(page, 'Log the day').first().click()
  await expect(page).toHaveURL(/\/log$/)
  await recordDay(page, { gym: '1:12:05', steps: '10432' })
  await navLink(page, 'Today').click()

  await expect(heroValue(page)).toHaveText('1:12:05')
  await expect(stepsCard(page).getByText('10,432', { exact: true })).toBeVisible()
  await expect(grid.getByRole('progressbar', { name: 'Steps progress' })).toHaveAttribute(
    'aria-valuenow',
    '87',
  )
})

test('renders every analytics chart with no console error', async ({ page, account, day }) => {
  const errors = consoleErrors(page)

  await openWithWeek(page, account, day)
  await navLink(page, 'Stats').click()
  await expect(page).toHaveURL(/\/analytics$/)

  const grid = page.getByTestId('analytics-grid')
  await expect(grid.locator(':scope > *')).toHaveCount(7)
  await expect(page.locator('.chart-draw')).toHaveCount(0)
  await expect(grid.getByText('Log one more day to see a trend.')).toHaveCount(0)

  const drawn = await grid
    .locator(':scope > *')
    .evaluateAll((cards) =>
      cards.map((card) =>
        Array.from(card.querySelectorAll('svg')).some(
          (svg) =>
            svg.getBoundingClientRect().width > 0 && svg.querySelector('path, rect') !== null,
        ),
      ),
    )
  expect(drawn).toEqual([true, true, true, true, true, true, true])

  expect(errors).toEqual([])
})

test('meets the install criteria: a linked manifest, its icons and a controlling service worker', async ({
  page,
  request,
}) => {
  await page.goto('/')

  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).not.toBeNull()
  const manifest = (await (await request.get(href ?? '')).json()) as {
    name: string
    start_url: string
    display: string
    icons: { src: string; sizes: string }[]
  }

  expect(manifest).toMatchObject({ name: 'Gym Tracker', start_url: '/', display: 'standalone' })
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']),
  )
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src)
    expect(response.status(), icon.src).toBe(200)
    expect(response.headers()['content-type'], icon.src).toBe('image/png')
  }
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    /apple-touch-icon/,
  )

  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          await navigator.serviceWorker.ready
          return navigator.serviceWorker.controller?.scriptURL ?? null
        }),
      { message: 'the service worker controls the page' },
    )
    .toMatch(/\/sw\.js$/)
})
