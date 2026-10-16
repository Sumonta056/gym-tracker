import { expect, test } from './support/signedIn'
import { gotoStyleGuide, openStyleGuideSheet } from './support/styleguide'
import {
  benchCard,
  openLiveSession,
  openPicker,
  pickerDialog,
  pullOnlyThisWindow,
} from './support/workout'

import type { Locator, Page } from '@playwright/test'

const TAB_PRESSES = 12

test.use({ serviceWorkers: 'block' })

test.beforeEach(async ({ context, day }) => {
  await pullOnlyThisWindow(context, day)
})

async function openEdit(page: Page): Promise<Locator> {
  await benchCard(page)
    .getByRole('button', { name: /^Edit set 1,/ })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Edit set 1' })
  await expect(dialog).toBeVisible()
  return dialog
}

async function focusLeaks(page: Page): Promise<string[]> {
  const leaks: string[] = []
  for (let press = 0; press < TAB_PRESSES; press += 1) {
    await page.keyboard.press(press % 3 === 2 ? 'Shift+Tab' : 'Tab')
    const inside = await page.evaluate(
      () => document.activeElement?.closest('[role="dialog"]') !== null,
    )
    if (!inside) leaks.push(`press ${String(press + 1)}`)
  }
  return leaks
}

test.describe('the sheet on /workout', () => {
  test.beforeEach(async ({ page, context }) => {
    await openLiveSession(page, context)
  })

  test('renders the sheet as a child of the body, outside the page frame', async ({ page }) => {
    await openEdit(page)

    const placement = await page.evaluate(() => {
      const overlay = document.querySelector('[data-testid="sheet-overlay"]')
      return {
        onBody: overlay?.parentElement === document.body,
        inFrame: overlay?.closest('[data-testid="page-transition"]') !== null,
      }
    })

    expect(placement).toEqual({ onBody: true, inFrame: false })
  })

  test('keeps the page still behind the sheet and returns to the same place', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 500 })
    await page.evaluate(() => {
      window.scrollTo(0, 200)
    })
    const before = await page.evaluate(() => window.scrollY)
    const cardTop = (await benchCard(page).boundingBox())?.y

    await openEdit(page)

    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).toBe(
      'hidden',
    )
    expect((await benchCard(page).boundingBox())?.y).toBe(cardTop)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(await page.evaluate(() => window.scrollY)).toBe(before)
  })

  test('keeps the footer and its Save button inside the visible area when the viewport shrinks', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const dialog = await openEdit(page)
    await dialog.getByLabel('Reps').focus()

    await page.setViewportSize({ width: 390, height: 420 })

    const save = dialog.getByRole('button', { name: 'Save set' })
    await expect(save).toBeInViewport()
    const box = await page.getByTestId('sheet-footer').boundingBox()
    const visible = await page.evaluate(() => window.visualViewport?.height ?? window.innerHeight)
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(visible + 1)
  })

  test('keeps focus inside the edit set sheet', async ({ page }) => {
    await openEdit(page)

    expect(await focusLeaks(page)).toEqual([])
  })

  test('keeps focus inside the rest time sheet', async ({ page }) => {
    await page
      .getByRole('region', { name: 'Rest timer' })
      .getByRole('button', { name: 'Change the rest time for Bench Press' })
      .click()
    await expect(page.getByRole('dialog', { name: 'Rest for Bench Press' })).toBeVisible()

    expect(await focusLeaks(page)).toEqual([])
  })

  test('keeps focus inside the exercise picker', async ({ page }) => {
    await openPicker(page)
    await expect(pickerDialog(page)).toBeVisible()

    expect(await focusLeaks(page)).toEqual([])
  })

  test('closes on Escape from inside the portal', async ({ page }) => {
    await openEdit(page)

    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})

test('keeps focus inside the style guide sheet', async ({ page }) => {
  await gotoStyleGuide(page)
  await openStyleGuideSheet(page)

  expect(await focusLeaks(page)).toEqual([])
})
