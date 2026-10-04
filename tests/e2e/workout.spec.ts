import AxeBuilder from '@axe-core/playwright'

import { expect, navLink, readStore, test, waitForServiceWorker } from './support/signedIn'
import {
  benchCard,
  pickBench,
  pullOnlyThisWindow,
  startSession,
  SUPABASE,
  waitForExercises,
} from './support/workout'

import type { BrowserContext, Page } from '@playwright/test'

type LocalSession = {
  id: string
  status: string
  ended_at: string | null
  deleted_at: string | null
}

type LocalSet = {
  id: string
  session_id: string
  reps: number
  weight_kg: number | null
  deleted_at: string | null
}

const WIDTHS = [390, 768, 1440]

const CLOCK_AHEAD_MS = 60000

const ONE_ACTIVE_SLOT_TIMEOUT_MS = 120000

test.use({
  serviceWorkers: async ({ browserName }, provide) => {
    await provide(browserName === 'webkit' ? 'block' : 'allow')
  },
})

test.beforeEach(async ({ context, day }) => {
  await pullOnlyThisWindow(context, day)
})

async function cutOffTheServer(
  page: Page,
  context: BrowserContext,
  browserName: string,
): Promise<boolean> {
  await context.route(SUPABASE, (route) => route.abort('internetdisconnected'))
  const trulyOffline = browserName !== 'webkit'

  if (trulyOffline) {
    for (const path of ['/workout', '/workouts']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }
    await waitForServiceWorker(page)
    await context.setOffline(true)
  }

  return trulyOffline
}

async function openWithExercises(page: Page): Promise<void> {
  await page.goto('/workouts')
  await expect(page.getByRole('heading', { level: 1, name: 'Workouts' })).toBeVisible()
  await waitForExercises(page)
}

async function addSet(page: Page, count: number): Promise<void> {
  await benchCard(page).getByRole('button', { name: 'Add set to Bench Press' }).click()
  await expect(benchCard(page).getByRole('listitem')).toHaveCount(count)
}

test('keeps every set of a session logged offline through a finish and a reload', async ({
  page,
  context,
  browserName,
  account,
  day,
}) => {
  await openWithExercises(page)
  const trulyOffline = await cutOffTheServer(page, context, browserName)
  if (trulyOffline) {
    await page.goto('/workouts')
  }

  await startSession(page)
  await pickBench(page)
  await benchCard(page).getByLabel('Reps').fill('8')
  await benchCard(page).getByLabel(/^Load/).fill('60')
  await addSet(page, 1)
  await addSet(page, 2)
  await addSet(page, 3)
  await expect(page.getByTestId('session-summary')).toHaveText(
    'Volume 1,440 kg · 3 sets · 1 exercise',
  )

  await page.clock.setSystemTime(new Date(day.noon().getTime() + 3_600_000))
  await page.getByRole('button', { name: 'Finish session' }).click()
  const finished = page.getByRole('dialog', { name: 'Session finished' })
  await expect(finished).toContainText('as gym time for')
  await finished.getByRole('button', { name: 'Not now' }).click()
  await expect(page).toHaveURL(/\/workouts$/)
  await expect(page.getByRole('button', { name: 'Start a session' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Workouts' })).toBeVisible()

  const sessions = await readStore<LocalSession>(page, 'workoutSessions')
  expect(sessions).toHaveLength(1)
  const [session] = sessions
  expect(session).toMatchObject({ status: 'finished', deleted_at: null })
  expect(session?.ended_at).not.toBeNull()

  const sets = await readStore<LocalSet>(page, 'workoutSets')
  expect(
    sets
      .filter((set) => set.session_id === session?.id && set.deleted_at === null)
      .map((set) => [set.reps, set.weight_kg]),
  ).toEqual([
    [8, 60],
    [8, 60],
    [8, 60],
  ])
  expect(await account.sessionsBetween(day.from, day.to)).toEqual([])
})

test('marks the Workouts tab current on the live screen, with one h1 and no serious axe issue', async ({
  page,
  context,
  browserName,
}) => {
  await openWithExercises(page)
  const trulyOffline = await cutOffTheServer(page, context, browserName)
  if (trulyOffline) {
    await page.goto('/workouts')
  }
  await startSession(page)
  await pickBench(page)
  await benchCard(page).getByLabel('Reps').fill('8')
  await benchCard(page).getByLabel(/^Load/).fill('60')
  await addSet(page, 1)

  const current = page.locator('a[aria-current="page"]:visible')
  await expect(current).toHaveCount(1)
  await expect(current).toHaveAccessibleName('Workouts')
  await expect(navLink(page, 'Workouts').first()).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)

  const results = await new AxeBuilder({ page }).analyze()
  expect(
    results.violations
      .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
      .map((violation) => violation.id),
  ).toEqual([])

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    const problems = await page.evaluate(() => {
      const found: string[] = []
      if (document.documentElement.scrollWidth > document.documentElement.clientWidth) {
        found.push('sideways scroll')
      }
      for (const element of document.querySelectorAll<HTMLElement>('button, a, input')) {
        const box = element.getBoundingClientRect()
        if (box.width > 0 && box.height > 0 && box.height < 44) {
          found.push(
            `${element.tagName} "${(element.getAttribute('aria-label') ?? element.textContent).trim()}" ${String(box.height)}px`,
          )
        }
      }
      return found
    })
    expect(problems, `${String(width)}px`).toEqual([])
  }
})

test('finishes a pulled session whose start is ahead of this device clock', async ({
  page,
  account,
  day,
}) => {
  test.setTimeout(ONE_ACTIVE_SLOT_TIMEOUT_MS)
  const seeded = await account.seedActiveSession({
    entry_date: day.date,
    started_at: new Date(day.noon().getTime() + CLOCK_AHEAD_MS).toISOString(),
  })

  await page.goto('/workout')
  await expect
    .poll(
      async () =>
        (await readStore<LocalSession>(page, 'workoutSessions')).map((session) => session.id),
      { message: 'the seeded session reaches this device', timeout: 15000 },
    )
    .toEqual([seeded.id])
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Session' })).toBeVisible()

  await page.getByRole('button', { name: 'Finish session' }).click()
  await expect(page).toHaveURL(/\/workouts$/)
  await expect(page.getByRole('button', { name: 'Start a session' })).toBeVisible()

  const [local] = await readStore<LocalSession>(page, 'workoutSessions')
  expect(local).toMatchObject({ id: seeded.id, status: 'finished', deleted_at: null })
  expect(Date.parse(local?.ended_at ?? '')).toBeGreaterThanOrEqual(Date.parse(seeded.started_at))
})

async function offlineSessionWithOneSet(
  page: Page,
  context: BrowserContext,
  browserName: string,
): Promise<void> {
  await openWithExercises(page)
  const trulyOffline = await cutOffTheServer(page, context, browserName)
  if (trulyOffline) {
    await page.goto('/workouts')
  }
  await startSession(page)
  await pickBench(page)
  await benchCard(page).getByLabel('Reps').fill('8')
  await benchCard(page).getByLabel(/^Load/).fill('60')
  await addSet(page, 1)
}

test('edits a set, deletes it, and brings it back with Undo under the same id', async ({
  page,
  context,
  browserName,
}) => {
  await offlineSessionWithOneSet(page, context, browserName)
  const summary = page.getByTestId('session-summary')
  await expect(summary).toHaveText('Volume 480 kg · 1 set · 1 exercise')

  await benchCard(page)
    .getByRole('button', { name: /^Edit set 1,/ })
    .click()
  const edit = page.getByRole('dialog', { name: 'Edit set 1' })
  await edit.getByLabel('Reps').fill('10')
  await edit.getByRole('button', { name: 'Save set' }).click()
  await expect(edit).toBeHidden()
  await expect(summary).toHaveText('Volume 600 kg · 1 set · 1 exercise')

  const [before] = (await readStore<LocalSet>(page, 'workoutSets')).filter(
    (set) => set.deleted_at === null,
  )

  await benchCard(page)
    .getByRole('button', { name: /^Edit set 1,/ })
    .focus()
  await page.keyboard.press('Enter')
  const remove = page.getByRole('dialog', { name: 'Edit set 1' }).getByRole('button', {
    name: 'Delete set',
  })
  await remove.focus()
  await page.keyboard.press('Enter')

  const toast = page.getByRole('status').filter({ hasText: 'Set 1 deleted.' })
  await expect(toast).toBeVisible()
  await expect(summary).toHaveText('Volume 0 kg · 0 sets · 0 exercises')

  await toast.getByRole('button', { name: 'Undo' }).click()
  await expect(summary).toHaveText('Volume 600 kg · 1 set · 1 exercise')

  const after = (await readStore<LocalSet>(page, 'workoutSets')).filter(
    (set) => set.deleted_at === null,
  )
  expect(after.map((set) => [set.id, set.reps])).toEqual([[before?.id, 10]])
})

test('offers Resume and Discard when the app opens with an active session', async ({
  page,
  context,
  browserName,
}) => {
  await offlineSessionWithOneSet(page, context, browserName)

  await page.goto('/workouts')
  const prompt = page.getByRole('dialog', { name: 'Session running' })
  await expect(prompt).toBeVisible()
  await prompt.getByRole('link', { name: 'Resume' }).click()
  await expect(page).toHaveURL(/\/workout$/)
  await expect(benchCard(page)).toBeVisible()

  await page.goto('/workouts')
  await expect(prompt).toBeVisible()
  await prompt.getByRole('button', { name: 'Discard' }).click()
  const confirm = page.getByRole('dialog', { name: 'Discard the session?' })
  await expect(confirm).toContainText('The session and its 1 set are removed')
  await confirm.getByRole('button', { name: 'Discard session' }).click()

  await expect(page.getByRole('button', { name: 'Start a session' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  const sessions = await readStore<LocalSession>(page, 'workoutSessions')
  expect(sessions).toHaveLength(1)
  expect(sessions[0]?.deleted_at).not.toBeNull()
  const sets = await readStore<LocalSet>(page, 'workoutSets')
  expect(sets).toHaveLength(1)
  expect(sets.every((set) => set.deleted_at !== null)).toBe(true)
})

test('puts the exercise list beside the active exercise at 1440 px and stacks them at 390 px', async ({
  page,
  context,
  browserName,
}) => {
  await offlineSessionWithOneSet(page, context, browserName)
  const list = page.getByRole('region', { name: 'Exercises' })
  const active = page.getByTestId('live-active')

  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(list).toBeVisible()
  await expect(list.getByRole('button', { name: /Bench Press/ })).toHaveAttribute(
    'aria-current',
    'true',
  )
  const listBox = await list.boundingBox()
  const activeBox = await active.boundingBox()
  const heroBox = await page.getByRole('region', { name: 'Session' }).boundingBox()
  expect(listBox && activeBox && listBox.x + listBox.width <= activeBox.x).toBe(true)
  expect(heroBox && activeBox && Math.abs(heroBox.y - activeBox.y) < 1).toBe(true)

  await page.setViewportSize({ width: 390, height: 900 })
  await expect(list).toBeHidden()
  const stackedActive = await active.boundingBox()
  const stackedHero = await page.getByRole('region', { name: 'Session' }).boundingBox()
  expect(
    stackedActive && stackedHero && stackedActive.y >= stackedHero.y + stackedHero.height,
  ).toBe(true)
  expect(stackedActive && stackedHero && Math.abs(stackedActive.x - stackedHero.x) < 1).toBe(true)

  for (const width of [320, 390, 768, 1024, 1440, 2560]) {
    await page.setViewportSize({ width, height: 900 })
    const sideways = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(sideways, `${String(width)}px`).toBe(false)
  }
})

test('runs the rest timer after a set, keeps its time across a reload, and takes +30 s and Skip', async ({
  page,
  context,
  browserName,
}) => {
  await offlineSessionWithOneSet(page, context, browserName)
  const rest = page.getByRole('region', { name: 'Rest timer' })
  const remaining = rest.getByRole('timer', { name: 'Rest remaining' })

  await expect(rest).toBeVisible()
  await expect(rest.getByText('of 1:30')).toBeVisible()
  await expect(remaining).toHaveText(/^1:[0-2]\d$|^1:30$/)

  await page.reload()
  await expect(rest).toBeVisible()
  await expect(remaining).toHaveText(/^1:[0-2]\d$|^0:[3-5]\d$/)

  await rest.getByRole('button', { name: '+30 s more rest' }).click()
  await expect(rest.getByText('of 2:00')).toBeVisible()

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    for (const name of ['Skip rest', '+30 s more rest', 'Change the rest time for Bench Press']) {
      const box = await rest.getByRole('button', { name }).boundingBox()
      expect(box && box.height >= 44, `${name} at ${String(width)}px`).toBe(true)
    }
  }

  const axe = await new AxeBuilder({ page }).include('[aria-label="Rest timer"]').analyze()
  expect(
    axe.violations.filter((issue) => issue.impact === 'serious' || issue.impact === 'critical'),
  ).toEqual([])

  await rest.getByRole('button', { name: 'Skip rest' }).click()
  await expect(rest).toBeHidden()
})

test('keeps the typed Reps and Load with no reload when the network comes back', async ({
  page,
  context,
  browserName,
}) => {
  await openWithExercises(page)
  const trulyOffline = await cutOffTheServer(page, context, browserName)
  if (trulyOffline) {
    await page.goto('/workouts')
  }
  await startSession(page)
  await pickBench(page)
  const reps = benchCard(page).getByRole('textbox', { name: 'Reps', exact: true })
  const load = benchCard(page).getByRole('textbox', { name: /^Load/ })
  await reps.fill('8')
  await load.fill('60')

  const navigations: string[] = []
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations.push(frame.url())
  })

  if (!trulyOffline) {
    await context.setOffline(true)
  }
  await context.unroute(SUPABASE)
  await context.setOffline(false)

  await expect
    .poll(async () => (await readStore<{ row_id: string }>(page, 'outbox')).length, {
      message: 'the outbox drains after the network returns',
      timeout: 15000,
    })
    .toBe(0)

  expect(navigations).toEqual([])
  await expect(reps).toHaveValue('8')
  await expect(load).toHaveValue('60')
})
