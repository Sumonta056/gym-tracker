import { expect, test } from '@playwright/test'

test('the home page loads with no console error', async ({ page }, testInfo) => {
  const errors: string[] = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  const response = await page.goto('/')

  expect(response?.status()).toBe(200)
  await page.waitForLoadState('load')
  await expect(page.locator('html')).toBeAttached()
  await testInfo.attach('home', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })

  expect(errors).toEqual([])
})
