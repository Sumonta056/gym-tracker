import { expect, test } from '@playwright/test'

import { gotoStyleGuide } from './support/styleguide'

test('reorders and hides a card with the keyboard alone, on the style guide sample', async ({
  page,
}) => {
  await gotoStyleGuide(page)

  const sample = page.getByTestId('stats-layout-sample')
  const up = sample.getByRole('button', { name: 'Move Steps up' })

  await up.focus()
  await page.keyboard.press('Enter')
  await expect(up).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(sample.getByRole('button', { name: 'Move Steps down' })).toBeFocused()
  await expect(sample.getByRole('listitem').first()).toHaveAttribute('data-card-id', 'steps')

  const show = sample.getByRole('switch', { name: 'Show Weight' })
  await show.focus()
  await page.keyboard.press('Space')
  await expect(show).toHaveAttribute('aria-checked', 'false')
})
