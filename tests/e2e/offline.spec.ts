import { savedCookies } from './support/account'
import {
  chip,
  expect,
  heroValue,
  stepsCard,
  navLink,
  readStore,
  recordDay,
  test,
  waitForLocalDays,
} from './support/signedIn'

import type { LocalEntry, LocalOutbox } from './support/signedIn'
import type { BrowserContext, BrowserContextOptions, Page } from '@playwright/test'

const OK_GREEN = 'rgb(74, 222, 128)'

async function localEntry(page: Page, date: string): Promise<LocalEntry | undefined> {
  const rows = await readStore<LocalEntry>(page, 'dailyEntries')
  return rows.find((row) => row.entry_date === date && row.deleted_at === null)
}

async function queuedFor(page: Page, rowId: string): Promise<number> {
  const queue = await readStore<LocalOutbox>(page, 'outbox')
  return queue.filter((entry) => entry.row_id === rowId).length
}

async function readyForOffline(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId('dashboard-grid')).toBeVisible()
  await navLink(page, 'Log the day').first().click()
  await expect(page).toHaveURL(/\/log$/)
  await expect(page.getByRole('button', { name: 'Save entry' })).toBeEnabled()
}

test('shows a second day recorded offline at once, with the chip reading OFFLINE', async ({
  page,
  context,
  account,
  day,
}) => {
  await account.seed([{ entry_date: day.date, gym_seconds: 3000, steps: 7000 }])
  await page.clock.setSystemTime(day.noon(1))
  await page.goto('/')
  await waitForLocalDays(page, [day.date])
  await navLink(page, 'Log the day').first().click()
  await expect(page).toHaveURL(/\/log$/)

  await context.setOffline(true)
  const logChip = chip(page, 'Offline')
  await expect(logChip).toBeVisible()
  expect(await logChip.innerText()).toBe('OFFLINE')

  await recordDay(page, { gym: '0:48:30', steps: '6543' })
  await navLink(page, 'Today').click()

  await expect(heroValue(page)).toHaveText('48:30')
  await expect(stepsCard(page).getByText('6,543', { exact: true })).toBeVisible()
  await expect(chip(page, 'Offline')).toBeVisible()
  expect(await chip(page, 'Offline').innerText()).toBe('OFFLINE')
  expect(await account.rowsOn(day.plus(1))).toEqual([])
})

test('sends the offline day to Supabase when the network returns, and the chip turns green', async ({
  page,
  context,
  account,
  day,
}) => {
  await readyForOffline(page)
  await context.setOffline(true)
  await recordDay(page, { gym: '1:05:10', steps: '8120' })
  await navLink(page, 'Today').click()
  await expect(chip(page, 'Offline')).toBeVisible()

  const local = await localEntry(page, day.date)
  expect(local).toBeDefined()
  const id = local?.id ?? ''
  expect(await queuedFor(page, id)).toBe(1)
  expect(await account.rowsOn(day.date)).toEqual([])

  await context.setOffline(false)

  const synced = chip(page, 'Synced')
  await expect(synced).toBeVisible()
  await expect(synced.locator('[aria-hidden="true"]').first()).toHaveCSS(
    'background-color',
    OK_GREEN,
  )
  await expect
    .poll(() => account.rowsOn(day.date), { message: 'the row reaches Supabase' })
    .toEqual([
      expect.objectContaining({
        id,
        user_id: account.userId,
        entry_date: day.date,
        gym_seconds: 3910,
        steps: 8120,
        deleted_at: null,
      }),
    ])
  expect(await queuedFor(page, id)).toBe(0)
})

type DeviceOptions = Pick<
  BrowserContextOptions,
  'viewport' | 'userAgent' | 'deviceScaleFactor' | 'isMobile' | 'hasTouch' | 'baseURL'
>

test('keeps an unsynced write through a closed browser and a cold reopen', async ({
  playwright,
  browserName,
  account,
  day,
}, testInfo) => {
  const use = testInfo.project.use
  const device: DeviceOptions = {
    viewport: use.viewport,
    userAgent: use.userAgent,
    deviceScaleFactor: use.deviceScaleFactor,
    isMobile: use.isMobile,
    hasTouch: use.hasTouch,
    baseURL: use.baseURL,
  }
  const profileDir = testInfo.outputPath('browser-profile')
  const cookies = savedCookies()
  const browserType = playwright[browserName]

  async function launch(
    offline: boolean,
    serviceWorkers: 'allow' | 'block',
  ): Promise<{ context: BrowserContext; page: Page }> {
    const context = await browserType.launchPersistentContext(profileDir, {
      ...device,
      offline,
      serviceWorkers,
    })
    await context.clock.setSystemTime(day.noon())
    const page = context.pages()[0] ?? (await context.newPage())
    return { context, page }
  }

  const reopenOffline = browserName !== 'webkit'
  const serviceWorkers = reopenOffline ? 'allow' : 'block'
  const first = await launch(false, serviceWorkers)
  await first.context.addCookies(cookies)
  await first.page.goto('/profile')
  await expect(first.page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  if (reopenOffline) {
    await expect
      .poll(() =>
        first.page.evaluate(async () => {
          await navigator.serviceWorker.ready
          return navigator.serviceWorker.controller !== null
        }),
      )
      .toBe(true)
  }
  await first.page.reload()
  await expect(first.page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  await navLink(first.page, 'Log the day').first().click()
  await expect(first.page).toHaveURL(/\/log$/)
  await first.context.setOffline(true)
  await recordDay(first.page, { gym: '0:55:00', steps: '4321' })
  const id = (await localEntry(first.page, day.date))?.id ?? ''
  expect(id).not.toBe('')
  await first.context.close()

  const second = await launch(reopenOffline, serviceWorkers)
  const supabase = /\.supabase\.co\//
  try {
    if (!reopenOffline) {
      await second.context.route(supabase, (route) => route.abort('internetdisconnected'))
    }
    await second.page.goto('/profile')
    const pending = second.page.getByRole('term').filter({ hasText: 'Pending writes' })
    await expect(pending.locator('xpath=following-sibling::dd')).toHaveText('1')
    await expect(chip(second.page, 'Offline')).toBeVisible()
    expect(await queuedFor(second.page, id)).toBe(1)
    expect(await account.rowsOn(day.date)).toEqual([])

    if (reopenOffline) {
      await second.context.setOffline(false)
    } else {
      await second.context.setOffline(true)
      await second.context.unroute(supabase)
      await second.context.setOffline(false)
    }

    await expect(pending.locator('xpath=following-sibling::dd')).toHaveText('0')
    await expect
      .poll(() => account.rowsOn(day.date), { message: 'the kept write reaches Supabase' })
      .toEqual([expect.objectContaining({ id, gym_seconds: 3300, steps: 4321 })])
  } finally {
    await second.context.close()
  }
})
