import { combinePlans, listPlans } from '../../lib/plans'

import { expect, readStore, test, waitForServiceWorker } from './support/signedIn'
import {
  openPlanSession,
  PLAN_FIRST_STEP,
  pullOnlyThisWindow,
  stepCount,
  SUPABASE,
} from './support/workout'

import type { PlanStep } from '../../lib/schema/plan'
import type { Page } from '@playwright/test'

type LocalSet = { exercise_id: string; reps: number; weight_kg: number | null }
type LocalCursor = { sessionId: string; stepIndex: number; skipped: string[] }

const CHEST = combinePlans(['chest-triceps']).steps.length

const SHOULDERS_LEGS = combinePlans(['shoulders', 'legs'])

const BOTH = SHOULDERS_LEGS.steps.length

test.use({ serviceWorkers: 'block' })

test.beforeEach(async ({ context, day }) => {
  await pullOnlyThisWindow(context, day)
})

test('starts a plan, logs a set, moves on, shows the muscles and resumes after a reload', async ({
  page,
  context,
}) => {
  await openPlanSession(page, context)

  await expect(stepCount(page, 1, CHEST)).toBeVisible()
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
  await expect(stepCount(page, 2, CHEST)).toBeVisible()
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

  await page
    .getByRole('button', { name: new RegExp(`^Step 1 of ${String(CHEST)}, elapsed `) })
    .click()
  const sheet = page.getByRole('dialog', { name: 'Chest + Triceps' })
  await expect(sheet.getByText(`0 done · 0 skipped · ${String(CHEST)} to go`)).toBeVisible()
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
  await expect(
    page.getByRole('button', { name: new RegExp(`^Step 7 of ${String(CHEST)}, elapsed `) }),
  ).toBeVisible()
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
  await expect(confirm.getByText(`${String(CHEST - 1)} steps not done.`)).toBeVisible()
  await expect(confirm.getByRole('button', { name: 'Keep going' })).toBeFocused()
  await confirm.getByRole('button', { name: 'Keep going' }).click()
  await expect(confirm).toBeHidden()

  await page.getByRole('button', { name: 'Finish', exact: true }).click()
  await confirm.getByRole('button', { name: 'Finish anyway' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Session done' })).toBeVisible()
  await expect(page.getByText(`Volume 110 kg · 1 set · 1 of ${String(CHEST)} steps`)).toBeVisible()
  await expect(
    page
      .getByRole('region', { name: 'Steps' })
      .getByRole('listitem')
      .filter({ hasText: 'Not done' }),
  ).toHaveCount(CHEST - 1)
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
  await expect(stepCount(page, 1, BOTH)).toBeVisible()
  await expect(page.getByRole('list', { name: 'Steps' }).getByRole('listitem')).toHaveCount(BOTH)

  await page.getByRole('combobox', { name: 'Set 1 weight' }).selectOption('10')
  await page.getByLabel('Set 1 reps').fill('10')
  await page.getByRole('button', { name: 'Set 1 done' }).click()
  await expect.poll(async () => (await readStore<LocalSet>(page, 'workoutSets')).length).toBe(1)

  await page.getByRole('button', { name: 'Finish', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: 'Finish the session?' })
  await expect(confirm.getByText(`${String(BOTH - 1)} steps not done.`)).toBeVisible()
  await confirm.getByRole('button', { name: 'Finish anyway' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Session done' })).toBeVisible()
  await expect(page.getByText('Shoulders + Legs', { exact: true })).toBeVisible()
  await expect(page.getByText(`Volume 100 kg · 1 set · 1 of ${String(BOTH)} steps`)).toBeVisible()
  const rows = page.getByRole('region', { name: 'Steps' }).getByRole('listitem')
  await expect(rows).toHaveCount(BOTH)
  await expect(rows.first()).toContainText('Shoulder Press')
  await expect(rows.first()).toContainText('1 × 10 kg')
  await expect(rows.nth(combinePlans(['shoulders']).steps.length)).toContainText('Squat')
})

test('opens a step from the list beside it at 1440 px, with the sidebar and no bottom bar', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openPlanSession(page, context)

  await expect(page.getByRole('navigation', { name: 'Sidebar' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Bottom navigation' })).toBeHidden()
  await expect(stepCount(page, 1, CHEST)).toBeVisible()
  await expect(
    page.getByRole('button', { name: new RegExp(`^Step 1 of ${String(CHEST)}, elapsed `) }),
  ).toBeHidden()

  const list = page.getByRole('region', { name: 'Steps' })
  await expect(list.getByText(`0 done · 0 skipped · ${String(CHEST)} to go`)).toBeVisible()
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
  await expect(stepCount(page, 7, CHEST)).toBeVisible()
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

const WEBKIT_NO_WORKER =
  'Playwright WebKit runs these suites with service workers blocked, so nothing is cached: on iPhone 14 the network down is Supabase only'

function bothStep(index: number): PlanStep {
  const step = SHOULDERS_LEGS.steps[index]
  if (step === undefined) throw new Error(`no step ${String(index + 1)} in Shoulders + Legs`)
  return step
}

async function logFirstSet(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await page.getByRole('combobox', { name: 'Set 1 weight' }).selectOption('20')
  await page.getByLabel('Set 1 reps').fill('10')
  await page.getByRole('button', { name: 'Set 1 done' }).click()
  await expect(page.getByRole('button', { name: 'Set 1 done' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
}

test.describe('the offline plan session', () => {
  test.use({
    serviceWorkers: async ({ browserName }, provide) => {
      await provide(browserName === 'webkit' ? 'block' : 'allow')
    },
  })

  test('runs Shoulders and Legs offline, resumes after a reload, and syncs every set with its plans', async ({
    page,
    context,
    account,
    day,
    browserName,
  }) => {
    const worker = browserName !== 'webkit'
    const sixth = bothStep(5)
    const second = bothStep(1)

    if (worker) {
      await page.goto('/')
      await waitForServiceWorker(page)
    } else {
      test.info().annotations.push({ type: 'skip', description: WEBKIT_NO_WORKER })
    }

    await page.goto('/workouts')
    await expect(page.getByRole('heading', { level: 1, name: 'Workouts' })).toBeVisible()
    await expect(page.getByRole('region', { name: "Today's suggestion" })).toContainText(
      listPlans()[0]?.title ?? '',
    )

    const list = page.getByRole('list', { name: 'Plans' })
    await list.getByRole('button', { name: /^Chest \+ Triceps/ }).click()
    await list.getByRole('button', { name: /^Shoulders/ }).click()
    await list.getByRole('button', { name: /^Legs/ }).click()
    await page.getByRole('button', { name: /^Start Shoulders \+ Legs/ }).click()
    await expect(page).toHaveURL(/\/workout$/)
    await expect(page.getByText(SHOULDERS_LEGS.title, { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: bothStep(0).name })).toBeVisible()

    if (worker) {
      await page.reload()
      await expect(page.getByRole('heading', { level: 1, name: bothStep(0).name })).toBeVisible()
      await context.setOffline(true)
    } else {
      await context.route(SUPABASE, (route) => route.abort('internetdisconnected'))
    }

    await logFirstSet(page, bothStep(0).name)
    await page.getByRole('button', { name: /^Next step/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: second.name })).toBeVisible()
    await page.getByRole('button', { name: /^Skip( this step)?$/ }).click()
    for (let index = 2; index < 5; index += 1) {
      await expect(
        page.getByRole('heading', { level: 1, name: bothStep(index).name }),
      ).toBeVisible()
      await page.getByRole('button', { name: /^Next step/ }).click()
    }
    await logFirstSet(page, sixth.name)
    await expect(page.getByRole('region', { name: 'Rest timer' })).toBeVisible()

    const viewport = page.viewportSize()
    if (viewport !== null && viewport.width >= 1280) {
      const skip = await page.getByRole('button', { name: 'Skip this step' }).boundingBox()
      expect(skip, 'Skip this step is on the screen').not.toBeNull()
      expect((skip?.y ?? Infinity) + (skip?.height ?? 0)).toBeLessThanOrEqual(viewport.height)
    }

    await expect.poll(async () => (await readStore<LocalSet>(page, 'workoutSets')).length).toBe(2)
    await expect
      .poll(async () =>
        (await readStore<LocalCursor>(page, 'planCursors')).map((cursor) => [
          cursor.stepIndex,
          cursor.skipped,
        ]),
      )
      .toEqual([[5, [second.slug]]])

    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: sixth.name })).toBeVisible()
    await expect(stepCount(page, 6, BOTH)).toBeVisible()
    await expect(page.getByText(`Step 2, ${second.name}: skipped`)).toBeAttached()
    await expect(page.getByText(`Step 1, ${bothStep(0).name}: done`)).toBeAttached()

    if (worker) {
      const images = page.locator('img').filter({ visible: true })
      await expect(images.first()).toBeVisible()
      for (const image of await images.all()) {
        await image.scrollIntoViewIfNeeded()
        await expect
          .poll(() =>
            image.evaluate(
              (element: HTMLImageElement) => element.complete && element.naturalWidth > 0,
            ),
          )
          .toBe(true)
      }
    }

    await page.getByRole('button', { name: 'Muscles' }).click()
    await expect(page.getByRole('button', { name: 'Muscles' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByRole('figure').getByRole('img')).toBeVisible()

    await page.getByRole('button', { name: 'Finish', exact: true }).click()
    await page
      .getByRole('dialog', { name: 'Finish the session?' })
      .getByRole('button', { name: 'Finish anyway' })
      .click()
    await expect(page.getByRole('heading', { level: 1, name: 'Session done' })).toBeVisible()
    await expect(page.getByTestId('done-foot')).toHaveText(
      new RegExp(`· 2 of ${String(BOTH)} steps$`),
    )

    if (worker) {
      await context.setOffline(false)
    } else {
      await context.unroute(SUPABASE)
      await page.evaluate(() => {
        window.dispatchEvent(new Event('online'))
      })
    }

    let sessionId = ''
    await expect
      .poll(
        async () => {
          const sessions = await account.sessionsBetween(day.from, day.to)
          sessionId = sessions[0]?.id ?? ''
          return sessions.map((session) => [session.status, session.plan_ids])
        },
        { message: 'the finished session reaches Supabase', timeout: 60000 },
      )
      .toEqual([['finished', ['shoulders', 'legs']]])
    await expect
      .poll(
        async () =>
          (await account.setsOf(sessionId)).map((set) => [
            set.exercise_id,
            set.reps,
            set.weight_kg,
          ]),
        { message: 'every set reaches Supabase', timeout: 60000 },
      )
      .toEqual([
        [bothStep(0).exerciseId, 10, 20],
        [sixth.exerciseId, 10, 20],
      ])
  })
})
