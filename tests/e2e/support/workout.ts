import { expect, openRoute, openWithWeek, readStore } from './signedIn'

import type { Account } from './account'
import type { TestDay } from './signedIn'
import type { BrowserContext, Page } from '@playwright/test'

export const SUPABASE = /\.supabase\.co\//

const SESSIONS = /\/rest\/v1\/workout_sessions/

const BENCH_PRESS = 'c9fca3c0-08f3-4abe-aed2-50424b8342fc'

const DEADLIFT = '2c321278-8949-45d8-9283-da4025e7b674'

const BACK_SQUAT = '5caf18b3-c913-4d5f-8470-776b5d1bd34d'

const SESSION_MS = 3_600_000

export async function pullOnlyThisWindow(context: BrowserContext, day: TestDay): Promise<void> {
  await context.route(SESSIONS, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }

    let response: Awaited<ReturnType<typeof route.fetch>>

    try {
      response = await route.fetch()
    } catch {
      await route.abort('failed')
      return
    }

    if (!response.ok()) {
      await route.fulfill({ response })
      return
    }

    const rows = (await response.json()) as { entry_date: string }[]
    await route.fulfill({
      response,
      json: rows.filter((row) => row.entry_date >= day.from && row.entry_date <= day.to),
    })
  })
}

export async function waitForExercises(page: Page): Promise<void> {
  await expect
    .poll(async () => (await readStore<{ id: string }>(page, 'exercises')).length, {
      message: 'the built-in exercises reach this device',
      timeout: 15000,
    })
    .toBeGreaterThan(0)
}

export async function startSession(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start a session' }).click()
  await expect(page).toHaveURL(/\/workout$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Session' })).toBeVisible()
}

export function pickerDialog(page: Page) {
  return page.getByRole('dialog', { name: 'Pick an exercise' })
}

export async function openPicker(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(pickerDialog(page)).toBeVisible()
}

export function benchCard(page: Page) {
  return page.getByRole('region', { name: 'Bench Press' })
}

export async function pickBench(page: Page): Promise<void> {
  await openPicker(page)
  const dialog = pickerDialog(page)
  await dialog.getByRole('searchbox', { name: 'Search exercises' }).fill('Bench Press')
  await dialog
    .getByRole('button', { name: /^Bench Press/ })
    .first()
    .click()
  await expect(benchCard(page)).toBeVisible()
}

export async function openLiveSession(page: Page, context: BrowserContext): Promise<void> {
  await page.goto('/workouts')
  await expect(page.getByRole('heading', { level: 1, name: 'Workouts' })).toBeVisible()
  await waitForExercises(page)
  await context.route(SUPABASE, (route) => route.abort('internetdisconnected'))

  await startSession(page)
  await pickBench(page)
  await benchCard(page).getByLabel('Reps').fill('8')
  await benchCard(page).getByLabel(/^Load/).fill('60')
  await benchCard(page).getByRole('button', { name: 'Add set to Bench Press' }).click()
  await expect(benchCard(page).getByRole('listitem')).toHaveCount(1)
  await expect(page.getByRole('region', { name: 'Rest timer' })).toBeVisible()
}

function liftWeek(day: TestDay) {
  return [-6, -4, -2, 0].map((offset, index) => {
    const started = day.noon(offset)

    return {
      entry_date: day.plus(offset),
      started_at: started.toISOString(),
      ended_at: new Date(started.getTime() + SESSION_MS).toISOString(),
      sets: [
        { exercise_id: BENCH_PRESS, reps: 8, weight_kg: 60 + index * 2.5 },
        { exercise_id: BENCH_PRESS, reps: 6, weight_kg: 65 + index * 2.5 },
        {
          exercise_id: index % 2 === 0 ? DEADLIFT : BACK_SQUAT,
          reps: 5,
          weight_kg: 100 + index * 5,
        },
      ],
    }
  })
}

export async function openLiftCharts(
  page: Page,
  context: BrowserContext,
  account: Account,
  day: TestDay,
): Promise<void> {
  await pullOnlyThisWindow(context, day)
  const sets = await account.seedFinishedSessions(liftWeek(day))
  await openWithWeek(page, account, day)
  await expect
    .poll(
      async () => {
        const have = new Set(
          (await readStore<{ id: string }>(page, 'workoutSets')).map((set) => set.id),
        )
        return sets.filter((set) => !have.has(set.id)).length
      },
      { message: 'the seeded sets reach this device', timeout: 15000 },
    )
    .toBe(0)

  await openRoute(page, '/analytics')
  for (const grid of ['lift-grid', 'week-grid']) {
    await expect(page.getByTestId(grid).getByRole('img').first()).toBeVisible()
  }
}
