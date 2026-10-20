import { expect, readStore, test } from './support/signedIn'
import { openPlanSession, PLAN_FIRST_STEP, pullOnlyThisWindow } from './support/workout'

type LocalSet = { exercise_id: string; reps: number; weight_kg: number | null }
type LocalCursor = { sessionId: string; stepIndex: number; skipped: string[] }

test.use({ serviceWorkers: 'block' })

test.beforeEach(async ({ context, day }) => {
  await pullOnlyThisWindow(context, day)
})

test('starts a plan, logs a set, moves on, shows the muscles and resumes after a reload', async ({
  page,
  context,
}) => {
  await openPlanSession(page, context)

  await expect(page.getByText('Step 1 of 9 · Chest')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Leave to Workouts' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play' })).toHaveAttribute('aria-pressed', 'true')

  await page.getByLabel('Set 1 load').fill('10')
  await page.getByLabel('Set 1 reps').fill('12')
  await page.getByRole('button', { name: 'Set 1 done' }).click()
  await expect(page.getByRole('button', { name: 'Set 1 done' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('region', { name: 'Rest timer' })).toBeVisible()
  await expect
    .poll(async () =>
      (await readStore<LocalSet>(page, 'workoutSets')).map((set) => [set.reps, set.weight_kg]),
    )
    .toContainEqual([12, 10])

  await page.getByRole('button', { name: /^Next step/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Flat Dumbbell Press' })).toBeVisible()
  await expect(page.getByText('Step 2 of 9 · Chest')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Previous step' })).toBeVisible()

  await page.getByRole('button', { name: 'Muscles' }).click()
  await expect(page.getByRole('button', { name: 'Muscles' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(
    page.getByRole('img', { name: 'Main: Chest. Helpers: Shoulders, Triceps.' }),
  ).toBeVisible()

  await expect
    .poll(async () =>
      (await readStore<LocalCursor>(page, 'planCursors')).map((cursor) => cursor.stepIndex),
    )
    .toEqual([1])

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Flat Dumbbell Press' })).toBeVisible()
  await expect(page.getByText(`Step 1, ${PLAN_FIRST_STEP}: done`)).toBeAttached()
  await expect(page.getByRole('button', { name: 'Play' })).toHaveAttribute('aria-pressed', 'true')
})
