import { sheetDates, shiftedSheet } from './support/sheet'
import { expect, heroValue, test, waitForLocalDays } from './support/signedIn'

const REVIEW_CELLS = 11

test('imports the sheet, merges a logged date and fills the dashboard', async ({
  page,
  account,
  day,
}) => {
  test.setTimeout(60000)

  const dates = sheetDates(day)
  const first = dates[0] ?? ''
  const last = dates.at(-1) ?? ''

  test.skip(
    first.slice(0, 4) !== last.slice(0, 4),
    'The sheet names no year, so 16 dates across a new year cannot be read as one year.',
  )

  await account.clear(first, first)

  try {
    await account.seed([{ entry_date: day.date, steps: 500 }])
    await page.goto('/profile')
    await waitForLocalDays(page, [day.date])

    await page.getByRole('button', { name: 'Import the old sheet' }).click()
    await expect(page.getByLabel('Year of the sheet')).toHaveValue(first.slice(0, 4))
    await page.getByLabel('The sheet as a CSV file').setInputFiles({
      name: 'gym-sheet.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(shiftedSheet(dates)),
    })

    await expect(page.getByRole('heading', { level: 1, name: 'Import review' })).toBeVisible()
    await expect(page.getByTestId('import-count')).toHaveText('12 of 12 to check: 11 cells, 1 date')

    const readings = page.getByRole('group', { name: /reads two ways\. Pick one\.$/ })
    await expect(readings).toHaveCount(REVIEW_CELLS)
    for (let index = 0; index < REVIEW_CELLS; index += 1) {
      await readings.nth(index).getByRole('button').first().click()
    }

    const apply = page.getByRole('button', { name: 'Apply import' })
    await expect(apply).toBeDisabled()

    await page
      .getByRole('group', { name: /^Row 16, .+, already logged$/ })
      .getByRole('button', { name: 'Merge' })
      .click()
    await expect(page.getByTestId('import-count')).toHaveText('0 of 12 to check: 11 cells, 1 date')

    expect(await account.rowsBetween(first, last)).toHaveLength(1)

    await expect(apply).toBeEnabled()
    await apply.click()
    const dialog = page.getByRole('dialog', { name: 'Apply the import?' })
    await expect(dialog.getByTestId('confirm-created')).toHaveText('15')
    await expect(dialog.getByTestId('confirm-merged')).toHaveText('1')
    await expect(dialog.getByTestId('confirm-overwritten')).toHaveText('0')
    await expect(dialog.getByTestId('confirm-skipped')).toHaveText('0')
    await dialog.getByRole('button', { name: 'Import 16 days' }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByTestId('import-notice')).toHaveText(
      'The sheet is imported: 15 new, 0 overwritten, 1 merged, 0 skipped, 0 left out.',
    )
    await expect(heroValue(page)).toHaveText('1:11:52')

    await expect
      .poll(async () => (await account.rowsBetween(first, last)).map((row) => row.entry_date), {
        message: 'the 16 imported days reach Supabase, one row each',
        timeout: 20000,
      })
      .toEqual(dates)

    const merged = await account.rowsOn(day.date)
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ steps: 500, gym_seconds: 4312, weight_kg: 79.45 })
  } finally {
    await account.clear(first, first)
  }
})
