import AxeBuilder from '@axe-core/playwright'

import { expect, readStore, test } from './support/signedIn'
import { openLiveSession, pullOnlyThisWindow } from './support/workout'

import type { TestDay } from './support/signedIn'
import type { Page } from '@playwright/test'

type LocalSession = { id: string; deleted_at: string | null }

type LocalSet = { session_id: string; deleted_at: string | null }

const HOUR_MS = 3_600_000

test.use({ serviceWorkers: 'block' })

test.beforeEach(async ({ context, day }) => {
  await pullOnlyThisWindow(context, day)
})

async function finishOneSetSession(page: Page, day: TestDay): Promise<void> {
  await page.clock.setSystemTime(new Date(day.noon().getTime() + HOUR_MS))
  await page.getByRole('button', { name: 'Finish session' }).click()
  const done = page.getByRole('dialog', { name: 'Session done' })
  await done.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page).toHaveURL(/\/workouts$/)
}

function history(page: Page) {
  return page.getByRole('region', { name: 'History' })
}

async function expectAllDeleted(page: Page): Promise<void> {
  const sessions = await readStore<LocalSession>(page, 'workoutSessions')
  expect(sessions).toHaveLength(1)
  expect(sessions[0]?.deleted_at).not.toBeNull()
  const sets = await readStore<LocalSet>(page, 'workoutSets')
  expect(sets.length).toBeGreaterThan(0)
  expect(sets.every((set) => set.deleted_at !== null)).toBe(true)
}

test('shows a finished session in a day card and deletes it through the sheet', async ({
  page,
  context,
  day,
}) => {
  await openLiveSession(page, context)
  await finishOneSetSession(page, day)

  const card = history(page).getByTestId('day-card')
  await expect(card).toHaveCount(1)
  await expect(card.locator('[data-today="true"]')).toHaveCount(1)
  const row = card.getByRole('link', { name: /·/ })
  await expect(row).toContainText('480 kg')
  await expect(row).toContainText(/ · 1 set · Chest/)
  await expect(row.getByRole('img')).toHaveAccessibleName('100% of your biggest session')

  await card.getByRole('button', { name: /^Delete the session of / }).click()
  const sheet = page.getByRole('dialog', { name: 'Delete this session?' })
  await expect(sheet).toContainText(/ · 1 set · 480 kg/)
  await expect(sheet.getByRole('button', { name: 'Keep it' })).toBeFocused()

  const results = await new AxeBuilder({ page }).analyze()
  expect(
    results.violations
      .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
      .map((violation) => violation.id),
  ).toEqual([])

  await sheet.getByRole('button', { name: 'Delete session' }).click()
  await expect(sheet).toBeHidden()
  await expect(history(page).getByTestId('day-card')).toHaveCount(0)
  await expect(history(page)).toContainText('No finished session yet. Start one above.')
  await expectAllDeleted(page)

  await page.reload()
  await expect(history(page)).toContainText('No finished session yet. Start one above.')
})

test('deletes a session from its detail and goes back to the list', async ({
  page,
  context,
  day,
}) => {
  await openLiveSession(page, context)
  await finishOneSetSession(page, day)

  await history(page).getByRole('link', { name: /·/ }).click()
  await expect(page).toHaveURL(/\/workouts\?session=/)
  await expect(page.getByText('It goes from all your devices after the next sync.')).toBeVisible()

  await page.getByRole('button', { name: 'Delete session' }).click()
  const sheet = page.getByRole('dialog', { name: 'Delete this session?' })
  await sheet.getByRole('button', { name: 'Delete session' }).click()

  await expect(page).toHaveURL(/\/workouts$/)
  await expect(history(page)).toContainText('No finished session yet. Start one above.')
  await expect(page.getByText('That session is not on this device.')).toHaveCount(0)
  await expectAllDeleted(page)
})
