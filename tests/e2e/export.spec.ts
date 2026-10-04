import { readFile } from 'node:fs/promises'

import { expect, test, waitForLocalDays } from './support/signedIn'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function sheetDay(iso: string): string {
  return `${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ''} ${String(Number(iso.slice(8, 10)))}`
}

test('exports every table as a zip with the network down', async ({
  page,
  context,
  account,
  day,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined })
  })
  await account.seed([{ entry_date: day.date, walk_seconds: 954, steps: 7531 }])
  await page.goto('/profile')
  await waitForLocalDays(page, [day.date])

  await context.setOffline(true)
  const saved = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export all data' }).click()
  const download = await saved

  expect(download.suggestedFilename()).toBe(`gym-tracker-${day.date}.zip`)
  const zip = (await readFile(await download.path())).toString('utf8')
  expect(zip.startsWith('PK')).toBe(true)
  expect(zip).toContain(`daily-entries-${day.date.slice(0, 4)}.csv`)
  expect(zip).toContain(`${sheetDay(day.date)},0:15:54,,,,,,7531,`)
  expect(zip).toContain('exercises.csv')
  expect(zip).toContain('workout-sessions.csv')
  expect(zip).toContain('workout-sets.csv')
  await expect(page.getByRole('button', { name: 'Export all data' })).toBeEnabled()
})
