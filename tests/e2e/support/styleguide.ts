import { expect } from '@playwright/test'

import type { Locator, Page } from '@playwright/test'

export async function gotoStyleGuide(page: Page): Promise<void> {
  await page.goto('/styleguide')
  await expect(page.getByTestId('duration-picker-sample')).toHaveAttribute('data-ready', 'true')
}

export async function openStyleGuideSheet(
  page: Page,
  via: 'click' | 'keyboard' = 'click',
): Promise<Locator> {
  const opener = page.getByRole('button', { name: 'Open the sheet' })
  const dialog = page.getByRole('dialog', { name: 'Log a set' })

  await expect(async () => {
    if (!(await dialog.isVisible())) {
      if (via === 'keyboard') {
        await opener.focus({ timeout: 1000 })
        await page.keyboard.press('Enter')
      } else {
        await opener.click({ timeout: 1000 })
      }
    }
    await expect(dialog).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 15000 })

  return dialog
}
