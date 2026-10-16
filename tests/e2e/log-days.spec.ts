import {
  expect,
  navLink,
  openWithWeek,
  test,
  waitForLocalDays,
  waitForServiceWorker,
} from './support/signedIn'

import type { Locator, Page } from '@playwright/test'

test('opens a past day from the address', async ({ page, account, day }) => {
  await account.seed([{ entry_date: day.plus(-2), steps: 4321 }])
  await page.goto('/')
  await waitForLocalDays(page, [day.plus(-2)])

  await page.goto(`/log?date=${day.plus(-2)}`)

  await expect(page.getByLabel('Day', { exact: true })).toHaveValue(day.plus(-2))
  await expect(page.getByLabel('Steps')).toHaveValue('4321')
})

for (const asked of ['2999-01-01', '2026-02-30', 'soon']) {
  test(`opens today for ${asked}`, async ({ page, day }) => {
    await page.goto(`/log?date=${asked}`)

    await expect(page.getByLabel('Day', { exact: true })).toHaveValue(day.date)
    await expect(page).toHaveURL(new RegExp(`/log\\?date=${day.date}$`))
  })
}

test('moves a day back and forth, and never past today', async ({ page, day }) => {
  await page.goto('/log')
  await expect(page.getByRole('button', { name: /^Next day,/ })).toBeDisabled()

  await page.getByRole('button', { name: /^Previous day,/ }).click()

  await expect(page.getByLabel('Day', { exact: true })).toHaveValue(day.plus(-1))
  await expect(page).toHaveURL(new RegExp(`/log\\?date=${day.plus(-1)}$`))
  await page.getByRole('button', { name: /^Next day,/ }).click()
  await expect(page.getByLabel('Day', { exact: true })).toHaveValue(day.date)
})

test('opens a past day with no network, from a cold load', async ({
  page,
  context,
  day,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit',
    'Playwright WebKit fails any navigation while offline, even one a service worker can answer.',
  )

  await page.goto('/')
  await waitForServiceWorker(page)
  await context.setOffline(true)

  await page.goto(`/log?date=${day.plus(-3)}`)

  await expect(page.getByLabel('Day', { exact: true })).toHaveValue(day.plus(-3))
  await context.setOffline(false)
})

test('opens a day from the heat map', async ({ page, account, day }) => {
  await openWithWeek(page, account, day)
  await navLink(page, 'Stats').first().click()
  const links = page.getByRole('list', { name: 'Open a day' }).getByRole('link')
  await expect(links).toHaveCount(7)

  await links.first().click()

  await expect(page).toHaveURL(new RegExp(`/log\\?date=${day.plus(-6)}$`))
  await expect(page.getByLabel('Day', { exact: true })).toHaveValue(day.plus(-6))
})

test('asks before a day change drops an unsaved edit', async ({ page, day }) => {
  await page.goto('/log')
  await page.getByLabel('Steps').fill('4321')

  await page.getByRole('button', { name: /^Previous day,/ }).click()

  const question = page.getByRole('dialog', { name: /^Discard the changes to / })
  await expect(question).toBeVisible()
  await question.getByRole('button', { name: 'Keep editing' }).click()
  await expect(question).toBeHidden()
  await expect(page.getByLabel('Day', { exact: true })).toHaveValue(day.date)
  await expect(page.getByLabel('Steps')).toHaveValue('4321')

  await page.getByRole('button', { name: /^Previous day,/ }).click()
  await question.getByRole('button', { name: 'Discard', exact: true }).click()
  await expect(page.getByLabel('Day', { exact: true })).toHaveValue(day.plus(-1))
  await expect(page.getByLabel('Steps')).toHaveValue('')
})

type DatePart = 'year' | 'month' | 'day'

const PART_SLICE: Record<DatePart, [number, number]> = {
  year: [0, 4],
  month: [5, 7],
  day: [8, 10],
}

async function segmentOrder(page: Page, field: Locator): Promise<DatePart[]> {
  const order: DatePart[] = []
  await field.focus()

  for (let index = 0; index < 3; index += 1) {
    const before = await field.inputValue()
    await page.keyboard.press('ArrowUp')
    const after = await field.inputValue()
    const part = (Object.keys(PART_SLICE) as DatePart[]).find(
      (name) => before.slice(...PART_SLICE[name]) !== after.slice(...PART_SLICE[name]),
    )
    order.push(part ?? 'year')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowRight')
  }

  return order
}

function isFocused(field: Locator): Promise<boolean> {
  return field.evaluate((element) => element === document.activeElement)
}

test.describe('the Day field typed with the keyboard', () => {
  for (const commit of ['Enter', 'Tab'] as const) {
    test(`changes the day only on ${commit === 'Enter' ? 'Enter' : 'blur'}`, async ({
      page,
      day,
      browserName,
    }) => {
      test.skip(browserName !== 'chromium', 'Typing date segments is a Chromium keyboard path.')
      const target = day.plus(-5)
      await page.goto('/log')
      const field = page.getByLabel('Day', { exact: true })
      await expect(field).toHaveValue(day.date)
      const order = await segmentOrder(page, field)
      await expect(field).toHaveValue(day.date)

      await page.keyboard.press('ArrowLeft')
      await page.keyboard.press('ArrowLeft')
      await page.keyboard.press('ArrowLeft')
      for (const part of order) {
        await page.keyboard.type(target.slice(...PART_SLICE[part]), { delay: 50 })
      }

      await expect(field).toHaveValue(target)
      await expect(page).not.toHaveURL(new RegExp(`date=${target}`))
      await expect(page.getByRole('button', { name: /^Next day,/ })).toBeDisabled()

      if (commit === 'Enter') {
        await page.keyboard.press('Enter')
      } else {
        while (await isFocused(field)) {
          await expect(page).not.toHaveURL(new RegExp(`date=${target}`))
          await page.keyboard.press('Tab')
          await page.waitForTimeout(100)
          if (page.url().includes(`date=${target}`)) break
        }
      }

      await expect(page).toHaveURL(new RegExp(`/log\\?date=${target}$`))
      await expect(page.getByLabel('Day', { exact: true })).toHaveValue(target)
      await expect(page.getByRole('button', { name: /^Next day,/ })).toBeEnabled()
    })
  }
})
