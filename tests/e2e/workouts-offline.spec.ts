import { expect, test, waitForServiceWorker } from './support/signedIn'

import type { Page } from '@playwright/test'

test.use({
  serviceWorkers: async ({ browserName }, provide) => {
    await provide(browserName === 'webkit' ? 'block' : 'allow')
  },
})

async function openWorkouts(page: Page): Promise<void> {
  await page.goto('/workouts')
  await expect(page.getByRole('heading', { level: 1, name: 'Workouts' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Plans' }).getByRole('button')).toHaveCount(4)
}

async function openPreview(page: Page): Promise<void> {
  await page.goto('/workouts/chest-triceps')
  await expect(page.getByRole('heading', { level: 1, name: 'Chest + Triceps' })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Tutorial on YouTube: / })).toHaveCount(9)
}

test('renders /workouts and the plan preview with the network down after the first visit', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit',
    'Playwright WebKit runs these suites with service workers blocked, so nothing is cached.',
  )

  await page.goto('/')
  await waitForServiceWorker(page)
  await openWorkouts(page)
  await openPreview(page)

  await context.setOffline(true)

  await openWorkouts(page)
  await expect(page.getByRole('region', { name: "Today's suggestion" })).toContainText(
    'Chest + Triceps',
  )
  await openPreview(page)
  await expect(page.getByText('3 × 10–12 · first time')).toHaveCount(8)
  await expect(page.getByText('3 × 10–12 · body')).toHaveCount(1)
})
