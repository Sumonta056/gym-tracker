import AxeBuilder from '@axe-core/playwright'

import { expect, readStore, test } from './support/signedIn'
import { pullOnlyThisWindow, SUPABASE } from './support/workout'

import type { Page } from '@playwright/test'

type LocalSession = { status: string; plan_ids: string[] | null; deleted_at: string | null }

test.use({ serviceWorkers: 'block' })

test.beforeEach(async ({ context, day }) => {
  await pullOnlyThisWindow(context, day)
})

async function expectNoSeriousIssue(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze()
  expect(
    results.violations
      .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
      .map((violation) => violation.id),
  ).toEqual([])
}

async function expectTall(page: Page, name: RegExp | string, role: 'button' | 'link') {
  for (const target of await page.getByRole(role, { name }).all()) {
    const box = await target.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  }
}

function plans(page: Page) {
  return page.getByRole('list', { name: 'Plans' })
}

test('picks 2 plans on /workouts and starts them as 1 plan session', async ({ page, context }) => {
  await page.goto('/workouts')
  await expect(page.getByRole('heading', { level: 1, name: 'Workouts' })).toBeVisible()

  const hero = page.getByRole('region', { name: "Today's suggestion" })
  await expect(hero).toContainText('Chest + Triceps')
  await expect(hero.getByRole('link', { name: 'See the 9 steps →' })).toHaveAttribute(
    'href',
    '/workouts/chest-triceps',
  )
  await expect(plans(page).getByRole('button')).toHaveCount(4)
  await expect(plans(page).getByRole('button', { name: /^Legs/ })).toContainText('never done')
  await expect(page.getByRole('button', { name: 'Start a session' })).toBeVisible()
  await expectTall(page, /exercises/, 'button')
  await expectNoSeriousIssue(page)

  await context.route(SUPABASE, (route) => route.abort('internetdisconnected'))
  await plans(page)
    .getByRole('button', { name: /^Shoulders/ })
    .click()
  await expect(plans(page).getByRole('button', { name: /^Shoulders/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  const start = page.getByRole('button', { name: /^Start Chest \+ Triceps \+ Shoulders/ })
  await expect(start).toContainText('combined')
  await start.click()

  await expect(page).toHaveURL(/\/workout$/)
  await expect
    .poll(async () =>
      (await readStore<LocalSession>(page, 'workoutSessions'))
        .filter((session) => session.status === 'active' && session.deleted_at === null)
        .map((session) => session.plan_ids),
    )
    .toEqual([['chest-triceps', 'shoulders']])
})

test('previews the 9 steps of chest and triceps with a watch pill on each', async ({ page }) => {
  await page.goto('/workouts/chest-triceps')

  await expect(page.getByRole('heading', { level: 1, name: 'Chest + Triceps' })).toBeVisible()
  await expect(page.getByText('9 exercises · 27 sets · about 55 min')).toBeVisible()
  const chest = page.getByRole('region', { name: 'Chest', exact: true })
  const triceps = page.getByRole('region', { name: 'Triceps', exact: true })
  await expect(chest.getByRole('listitem')).toHaveCount(5)
  await expect(triceps.getByRole('listitem')).toHaveCount(4)
  await expect(page.getByRole('link', { name: /^Watch / })).toHaveCount(9)
  await expect(page.getByText('3 × 10–12 · first time')).toHaveCount(9)
  await expect(page.getByRole('button', { name: 'Start Chest + Triceps' })).toBeEnabled()
  await expectTall(page, /^Watch /, 'link')
  await expectNoSeriousIssue(page)

  await page.getByRole('link', { name: 'Plans' }).click()
  await expect(page).toHaveURL(/\/workouts$/)
})

test('returns the 404 page for an unknown plan', async ({ page }) => {
  const response = await page.goto('/workouts/nope')

  expect(response?.status()).toBe(404)
})
