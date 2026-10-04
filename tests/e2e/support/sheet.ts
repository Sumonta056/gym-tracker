import { readFileSync } from 'node:fs'

import { expect, openWithWeek } from './signedIn'

import type { Account } from './account'
import type { TestDay } from './signedIn'
import type { Page } from '@playwright/test'

const FIXTURE = readFileSync('tests/fixtures/gym-sheet.csv', 'utf8')

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

const FIRST_OFFSET = -15

export function sheetDates(day: TestDay): string[] {
  return Array.from({ length: 16 }, (_, index) => day.plus(FIRST_OFFSET + index))
}

function sheetDay(iso: string): string {
  return `${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ''} ${String(Number(iso.slice(8, 10)))}`
}

export function shiftedSheet(dates: string[]): string {
  const [header, ...rows] = FIXTURE.trimEnd().split('\n')

  return [
    header,
    ...rows.map((row, index) => row.replace(/^[A-Za-z]+ \d+/, sheetDay(dates[index] ?? ''))),
  ].join('\n')
}

export async function openImportReview(page: Page, account: Account, day: TestDay): Promise<void> {
  await openWithWeek(page, account, day)
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Import the old sheet' }).click()
  await page.getByLabel('The sheet as a CSV file').setInputFiles({
    name: 'gym-sheet.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(shiftedSheet(sheetDates(day))),
  })
  await expect(page.getByRole('heading', { level: 1, name: 'Import review' })).toBeVisible()
}
