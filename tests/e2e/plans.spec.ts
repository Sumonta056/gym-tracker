import { expect, readStore, test } from './support/signedIn'
import { openPlanSession, PLAN_FIRST_STEP, pullOnlyThisWindow, stepCount } from './support/workout'

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

  await expect(stepCount(page, 1, 9)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Leave to Workouts' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'How to' })).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('combobox', { name: 'Set 1 weight' }).selectOption('10')
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
  await expect(stepCount(page, 2, 9)).toBeVisible()
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
  await expect(page.getByRole('button', { name: 'How to' })).toHaveAttribute('aria-pressed', 'true')
})

test('jumps to any step from the step list and holds it after a reload', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openPlanSession(page, context)

  await page.getByRole('button', { name: /^Step 1 of 9, elapsed / }).click()
  const sheet = page.getByRole('dialog', { name: 'Chest + Triceps' })
  await expect(sheet.getByText('0 done · 0 skipped · 9 to go')).toBeVisible()
  await expect(sheet.getByRole('button', { name: /^1\. .+, Now$/ })).toHaveAttribute(
    'aria-current',
    'step',
  )
  await sheet.getByRole('button', { name: /^7\. Rope Pushdown, / }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Rope Pushdown' })).toBeVisible()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('combobox', { name: 'Set 1 weight' })).toContainText('100 kg')
  await expect
    .poll(async () =>
      (await readStore<LocalCursor>(page, 'planCursors')).map((cursor) => cursor.stepIndex),
    )
    .toEqual([6])

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Rope Pushdown' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Step 7 of 9, elapsed / })).toBeVisible()
})

test('takes a typed weight through Other… and asks before finishing with steps not done', async ({
  page,
}) => {
  await openPlanSession(page, page.context())

  await page.getByRole('combobox', { name: 'Set 1 weight' }).selectOption('other')
  const typed = page.getByRole('textbox', { name: 'Set 1 weight' })
  await expect(typed).toBeFocused()
  await typed.fill('11')
  await page.getByLabel('Set 1 reps').fill('10')
  await page.getByRole('button', { name: 'Set 1 done' }).click()
  await expect
    .poll(async () =>
      (await readStore<LocalSet>(page, 'workoutSets')).map((set) => [set.reps, set.weight_kg]),
    )
    .toContainEqual([10, 11])

  await page.getByRole('button', { name: 'Finish', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: 'Finish the session?' })
  await expect(confirm.getByText('8 steps not done.')).toBeVisible()
  await expect(confirm.getByRole('button', { name: 'Keep going' })).toBeFocused()
  await confirm.getByRole('button', { name: 'Keep going' }).click()
  await expect(confirm).toBeHidden()

  await page.getByRole('button', { name: 'Finish', exact: true }).click()
  await confirm.getByRole('button', { name: 'Finish anyway' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Session done' })).toBeVisible()
  await expect(page.getByText('Volume 110 kg · 1 set · 1 of 9 steps')).toBeVisible()
  await expect(
    page
      .getByRole('region', { name: 'Steps' })
      .getByRole('listitem')
      .filter({ hasText: 'Not done' }),
  ).toHaveCount(8)
  await expect(page.getByRole('link', { name: 'Back to Workouts' })).toHaveAttribute(
    'href',
    '/workouts',
  )
})

test('runs Shoulders and Legs as 1 session and counts the steps on the Done screen', async ({
  page,
  context,
}) => {
  await openPlanSession(page, context, ['Shoulders', 'Legs'], 'Shoulder Press')

  await expect(page.getByText('Shoulders + Legs', { exact: true })).toBeVisible()
  await expect(stepCount(page, 1, 8)).toBeVisible()
  await expect(page.getByRole('list', { name: 'Steps' }).getByRole('listitem')).toHaveCount(8)

  await page.getByRole('combobox', { name: 'Set 1 weight' }).selectOption('10')
  await page.getByLabel('Set 1 reps').fill('10')
  await page.getByRole('button', { name: 'Set 1 done' }).click()
  await expect.poll(async () => (await readStore<LocalSet>(page, 'workoutSets')).length).toBe(1)

  await page.getByRole('button', { name: 'Finish', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: 'Finish the session?' })
  await expect(confirm.getByText('7 steps not done.')).toBeVisible()
  await confirm.getByRole('button', { name: 'Finish anyway' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Session done' })).toBeVisible()
  await expect(page.getByText('Shoulders + Legs', { exact: true })).toBeVisible()
  await expect(page.getByText('Volume 100 kg · 1 set · 1 of 8 steps')).toBeVisible()
  const rows = page.getByRole('region', { name: 'Steps' }).getByRole('listitem')
  await expect(rows).toHaveCount(8)
  await expect(rows.first()).toContainText('Shoulder Press')
  await expect(rows.first()).toContainText('1 × 10 kg')
  await expect(rows.nth(5)).toContainText('Squat')
})

test('opens a step from the list beside it at 1440 px, with the sidebar and no bottom bar', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openPlanSession(page, context)

  await expect(page.getByRole('navigation', { name: 'Sidebar' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Bottom navigation' })).toBeHidden()
  await expect(stepCount(page, 1, 9)).toBeVisible()
  await expect(page.getByRole('button', { name: /^Step 1 of 9, elapsed / })).toBeHidden()

  const list = page.getByRole('region', { name: 'Steps' })
  await expect(list.getByText('0 done · 0 skipped · 9 to go')).toBeVisible()
  await expect(list.getByRole('button', { name: /^1\. .+, Now$/ })).toHaveAttribute(
    'aria-current',
    'step',
  )
  await list.getByRole('button', { name: /^7\. Rope Pushdown, / }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Rope Pushdown' })).toBeVisible()
  await expect(list.getByRole('button', { name: /^7\. Rope Pushdown, .+, Now$/ })).toHaveAttribute(
    'aria-current',
    'step',
  )
  await expect(stepCount(page, 7, 9)).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect
    .poll(async () =>
      (await readStore<LocalCursor>(page, 'planCursors')).map((cursor) => cursor.stepIndex),
    )
    .toEqual([6])
  await expect(page.getByRole('button', { name: 'Skip this step' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Next step/ })).toBeVisible()
})

test('fits every weight label and two digit reps in the set row at 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await openPlanSession(page, page.context())

  const select = page.getByRole('combobox', { name: 'Set 1 weight' })
  const reps = page.getByLabel('Set 1 reps')

  const pickRoom = await select.evaluate((element: HTMLSelectElement) => {
    const style = getComputedStyle(element)
    const room =
      element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    const context = document.createElement('canvas').getContext('2d')
    if (context === null) return { room, widest: Infinity }
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    return { room, widest: context.measureText(element.selectedOptions[0]?.text ?? '').width }
  })
  expect(pickRoom.widest).toBeLessThanOrEqual(pickRoom.room)

  await select.selectOption('12.5')
  await reps.fill('12')

  const weight = await select.evaluate((element: HTMLSelectElement) => {
    const style = getComputedStyle(element)
    const room =
      element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    const context = document.createElement('canvas').getContext('2d')
    if (context === null) return { selected: '', room, widest: Infinity }
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    const labels = Array.from(element.options, (option) => option.text)
    for (const [from, to, step] of [
      [2.5, 50, 2.5],
      [5, 100, 5],
      [20, 150, 2.5],
    ] as const) {
      for (let kg = from; kg <= to + 1e-9; kg += step) {
        labels.push(`${String(Math.round(kg * 100) / 100)} kg`)
        labels.push(`${String(Math.round((kg / 0.45359237) * 10) / 10)} lb`)
      }
    }
    return {
      selected: element.selectedOptions[0]?.text ?? '',
      room,
      widest: Math.max(...labels.map((label) => context.measureText(label).width)),
    }
  })
  expect(weight.selected).toBe('12.5 kg')
  expect(weight.widest).toBeLessThanOrEqual(weight.room)

  const field = await reps.evaluate((element: HTMLInputElement) => {
    const suffix = element.parentElement?.querySelector('span')
    const style = getComputedStyle(element)
    const textEnd =
      element.getBoundingClientRect().right -
      parseFloat(style.borderRightWidth) -
      parseFloat(style.paddingRight)
    return {
      scroll: element.scrollWidth,
      client: element.clientWidth,
      textEnd,
      suffixStart: suffix?.getBoundingClientRect().left ?? 0,
    }
  })
  expect(field.scroll).toBeLessThanOrEqual(field.client)
  expect(field.textEnd).toBeLessThanOrEqual(field.suffixStart)

  await page.getByRole('button', { name: 'Set 1 done' }).click()
  const logged = page
    .getByRole('list', { name: /sets$/ })
    .getByRole('listitem')
    .first()
    .getByRole('button')
    .first()
    .locator('span')
  await expect(logged).toHaveText(['12.5 kg', '12 reps'])
  const cells = await logged.evaluateAll((elements) =>
    elements.map((element) => ({
      scroll: element.scrollWidth,
      client: element.clientWidth,
      height: element.getBoundingClientRect().height,
    })),
  )
  for (const cell of cells) {
    expect(cell.scroll).toBeLessThanOrEqual(cell.client)
    expect(cell.height).toBeLessThanOrEqual(46)
  }
})
