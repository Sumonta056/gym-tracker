import { expect, test } from './support/signedIn'

test('saves a swim time on the log, reads it after a reload and syncs it', async ({
  page,
  account,
  day,
}) => {
  await page.goto('/log')
  const swim = page.getByRole('group', { name: 'Swim time' })
  await swim.getByRole('button', { name: '30m', exact: true }).click()
  await page.getByRole('button', { name: 'Save entry' }).click()
  await expect(page.getByText('Saved on this device.')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('group', { name: 'Swim time' }).getByRole('status')).toHaveText(
    '30:00',
  )
  await expect
    .poll(() => account.rowsOn(day.date), { message: 'the swim time reaches Supabase' })
    .toEqual([expect.objectContaining({ entry_date: day.date, swim_seconds: 1800 })])
})
