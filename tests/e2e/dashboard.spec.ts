import { expect, test } from '@playwright/test'

import {
  heroValue,
  pickPreset,
  test as signedIn,
  stepsCard,
  waitForLocalDays,
} from './support/signedIn'

test('reads the heart rate zones outside the ring, on the style guide sample', async ({ page }) => {
  await page.goto('/styleguide')

  await expect(
    page.getByRole('img', {
      name: 'Heart rate zones: Warm 8m, Fat burn 38m, Cardio 21m, Peak 5m',
    }),
  ).toBeVisible()

  for (const [name, time] of [
    ['Warm', '8m'],
    ['Fat burn', '38m'],
    ['Cardio', '21m'],
    ['Peak', '5m'],
  ] as const) {
    await expect(
      page
        .getByRole('listitem')
        .filter({ hasText: new RegExp(`^${name}.*${time}`) })
        .first(),
    ).toBeVisible()
  }
})

test('points the empty hero at the daily log, on the style guide sample', async ({ page }) => {
  await page.goto('/styleguide')

  const empty = page.getByRole('region', { name: 'Today, empty state' })

  await expect(empty.getByRole('link', { name: 'Log the day' })).toHaveAttribute('href', '/log')
})

test('shows the day control on the style guide header', async ({ page }) => {
  await page.goto('/styleguide')

  const groups = page.getByRole('group', { name: 'Choose the day' })
  await expect(groups.first().getByRole('button', { name: /^Next day,/ })).toBeDisabled()
  await expect(groups.nth(1).getByRole('button', { name: /^Next day,/ })).toBeEnabled()
})

signedIn('shows on the dashboard the value saved on /log', async ({ page }) => {
  await page.goto('/log')
  await pickPreset(page, 'Gym time', '1h')
  await page.getByRole('button', { name: 'Save entry' }).click()
  await expect(page.getByText('Saved on this device.')).toBeVisible()
  await page.goto('/')

  await expect(heroValue(page)).toHaveText('1:00:00')
})

signedIn('shows a past day in full from the address', async ({ page, account, day }) => {
  const past = day.plus(-2)
  await account.seed([{ entry_date: past, steps: 4321, gym_seconds: 1800, note: 'Legs day.' }])
  await page.goto('/')
  await waitForLocalDays(page, [past])

  await page.goto(`/?date=${past}`)

  await expect(page.getByLabel('Day', { exact: true })).toHaveValue(past)
  await expect(stepsCard(page)).toContainText('4,321')
  await expect(page.getByText('Legs day.')).toBeVisible()
  await expect(page.getByText(/^Gym time · /)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Edit this day' })).toHaveAttribute(
    'href',
    `/log?date=${past}`,
  )
  await expect(page.getByRole('button', { name: /^Next day,/ })).toBeEnabled()
})

for (const asked of ['2999-01-01', '2026-02-30', 'soon']) {
  signedIn(`shows today for ${asked} and leaves the address alone`, async ({ page, day }) => {
    await page.goto(`/?date=${asked}`)

    await expect(page.getByLabel('Day', { exact: true })).toHaveValue(day.date)
    await expect(page.getByText(/^Today · /)).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/\\?date=${asked}$`))
    await expect(page.getByRole('link', { name: 'Edit this day' })).toHaveCount(0)
  })
}

signedIn('steps one day back, and back in the browser returns', async ({ page, day }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /^Next day,/ })).toBeDisabled()

  await page.getByRole('button', { name: /^Previous day,/ }).click()

  await expect(page).toHaveURL(new RegExp(`/\\?date=${day.plus(-1)}$`))
  await expect(page.getByLabel('Day', { exact: true })).toHaveValue(day.plus(-1))
  await expect(page.getByRole('button', { name: /^Next day,/ })).toBeEnabled()

  await page.goBack()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByLabel('Day', { exact: true })).toHaveValue(day.date)
})

signedIn('jumps to the day picked in the header', async ({ page, day }) => {
  await page.goto('/')

  await page.getByLabel('Day', { exact: true }).fill(day.plus(-3))

  await expect(page).toHaveURL(new RegExp(`/\\?date=${day.plus(-3)}$`))
  await expect(page.getByLabel('Day', { exact: true })).toHaveValue(day.plus(-3))
})

signedIn(
  'opens a day on the Today screen from the workouts list',
  async ({ page, account, day }) => {
    const past = day.plus(-1)
    await account.seedFinishedSessions([
      {
        entry_date: past,
        started_at: `${past}T07:00:00.000Z`,
        ended_at: `${past}T07:45:00.000Z`,
        sets: [],
      },
    ])
    await page.goto('/workouts')
    const dayLink = page.getByRole('link', { name: /^Open / }).first()
    await expect(dayLink).toBeVisible()

    await dayLink.click()

    await expect(page).toHaveURL(new RegExp(`/\\?date=${past}$`))
    await expect(page.getByLabel('Day', { exact: true })).toHaveValue(past)
  },
)
