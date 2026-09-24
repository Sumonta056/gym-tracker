import { expect, test as base } from '@playwright/test'

import { Account, AUTH_FILE, savedCookies } from './account'

import type { SeedRow } from './account'
import type { Page, TestInfo } from '@playwright/test'

export const PROJECTS = ['mobile-safari', 'mobile-chrome', 'desktop'] as const

export const MOST_WORKERS = 32

const UNIT_DAYS = 35

const WINDOW_DAYS = 14

const FIRST_DAY = Date.UTC(1990, 0, 1)

const MS_PER_DAY = 86400000

export class TestDay {
  readonly date: string

  constructor(private readonly day: number) {
    this.date = TestDay.iso(day)
  }

  static iso(day: number): string {
    return new Date(day * MS_PER_DAY).toISOString().slice(0, 10)
  }

  plus(days: number): string {
    return TestDay.iso(this.day + days)
  }

  noon(days = 0): Date {
    const [year, month, date] = this.plus(days).split('-').map(Number)

    return new Date(year ?? 0, (month ?? 1) - 1, date ?? 1, 12, 0, 0)
  }

  get from(): string {
    return this.plus(-WINDOW_DAYS)
  }

  get to(): string {
    return this.plus(WINDOW_DAYS)
  }
}

export function dayFor(testInfo: TestInfo): TestDay {
  const project = PROJECTS.indexOf(testInfo.project.name as (typeof PROJECTS)[number])

  if (project < 0) {
    throw new Error(`No date band for the project ${testInfo.project.name}.`)
  }

  if (testInfo.parallelIndex >= MOST_WORKERS) {
    throw new Error(`The signed-in tests allow at most ${String(MOST_WORKERS)} workers.`)
  }

  const band = process.env.CI ? 0 : 1
  const unit = (band * PROJECTS.length + project) * MOST_WORKERS + testInfo.parallelIndex

  return new TestDay(FIRST_DAY / MS_PER_DAY + unit * UNIT_DAYS + WINDOW_DAYS + 3)
}

export function weekOfRows(day: TestDay): SeedRow[] {
  return [-6, -5, -4, -3, -2, -1, 0].map((offset, index) => ({
    entry_date: day.plus(offset),
    walk_seconds: 2400 + index * 120,
    gym_seconds: 3600 + index * 180,
    avg_heart_rate: 112 + index,
    max_heart_rate: 160 + index * 2,
    weight_kg: (742 - index) / 10,
    calories_burnt: 820 + index * 25,
    steps: 9000 + index * 450,
    note: null,
  }))
}

type Fixtures = {
  account: Account
  day: TestDay
}

export const test = base.extend<Fixtures>({
  storageState: AUTH_FILE,
  account: async ({}, provide) => {
    await provide(new Account(savedCookies()))
  },
  day: async ({ account }, provide, testInfo) => {
    const day = dayFor(testInfo)

    await account.clear(day.from, day.to)
    await provide(day)
    await account.clear(day.from, day.to)
  },
  page: async ({ page, day }, provide) => {
    await page.clock.setSystemTime(day.noon())
    await provide(page)
  },
})

export { expect }

type StoreName = 'dailyEntries' | 'outbox' | 'deadLetters' | 'profiles' | 'syncMeta'

export function readStore<Row>(page: Page, store: StoreName): Promise<Row[]> {
  return page.evaluate(
    (name) =>
      new Promise<Row[]>((resolve, reject) => {
        const open = indexedDB.open('gym-tracker')
        open.onerror = () => {
          reject(new Error(String(open.error)))
        }
        open.onsuccess = () => {
          const database = open.result
          if (!database.objectStoreNames.contains(name)) {
            database.close()
            resolve([])
            return
          }
          const request = database.transaction(name, 'readonly').objectStore(name).getAll()
          request.onsuccess = () => {
            database.close()
            resolve(request.result as Row[])
          }
          request.onerror = () => {
            database.close()
            reject(new Error(String(request.error)))
          }
        }
      }),
    store,
  )
}

export type LocalEntry = {
  id: string
  entry_date: string
  gym_seconds: number | null
  steps: number | null
  deleted_at: string | null
}

export type LocalOutbox = { row_id: string; table_name: string }

export async function waitForLocalDays(page: Page, dates: readonly string[]): Promise<void> {
  await expect
    .poll(
      async () => {
        const rows = await readStore<LocalEntry>(page, 'dailyEntries')
        const have = new Set(rows.map((row) => row.entry_date))
        return dates.filter((date) => !have.has(date))
      },
      { message: 'the seeded days reach this device', timeout: 15000 },
    )
    .toEqual([])
}

export async function openWithWeek(page: Page, account: Account, day: TestDay): Promise<void> {
  const rows = await account.seed(weekOfRows(day))
  await page.goto('/')
  await waitForLocalDays(
    page,
    rows.map((row) => row.entry_date),
  )
}

export function navLink(page: Page, name: string) {
  return page.getByRole('link', { name, exact: true })
}

const IGNORED_CONSOLE_ERRORS = [
  'Viewport argument key "interactive-widget" not recognized and ignored.',
]

export function consoleErrors(page: Page): string[] {
  const errors: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error' && !IGNORED_CONSOLE_ERRORS.includes(message.text())) {
      errors.push(message.text())
    }
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  return errors
}

export const SIGNED_IN_ROUTES = ['/', '/log', '/analytics', '/profile'] as const

export type SignedInRoute = (typeof SIGNED_IN_ROUTES)[number]

export async function openRoute(page: Page, route: SignedInRoute): Promise<void> {
  await page.goto(route)
  await expect(page).toHaveURL(new RegExp(`${route === '/' ? '' : route}/?$`))

  if (route === '/') {
    await expect(page.getByTestId('dashboard-grid')).toBeVisible()
  } else if (route === '/log') {
    await expect(page.getByLabel('Gym time')).not.toHaveValue('')
  } else if (route === '/analytics') {
    await expect(page.getByTestId('analytics-grid').getByRole('img').first()).toBeVisible()
  } else {
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  }
}

export function heroValue(page: Page) {
  return page.getByRole('region', { name: 'Today' }).getByTestId('count-up-value')
}

export function chip(page: Page, label: 'Offline' | 'Synced' | 'Pending' | 'Syncing') {
  return page.getByRole('status').filter({ hasText: new RegExp(`^${label}$`) })
}

export async function recordDay(page: Page, values: { gym: string; steps: string }): Promise<void> {
  await page.getByLabel('Gym time').fill(values.gym)
  await page.getByLabel('Steps').fill(values.steps)
  await page.getByRole('button', { name: 'Save entry' }).click()
  await expect(page.getByText('Saved on this device.')).toBeVisible()
}

export function stepsCard(page: Page) {
  return page.getByRole('progressbar', { name: 'Steps progress' }).locator('..')
}
