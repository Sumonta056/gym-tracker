import { expect, test } from '@playwright/test'

import type { Page } from '@playwright/test'

type Box = { x: number; y: number; width: number; height: number }

const HERO_VALUE = '1:12:05'

const CHART_LABELS = '[data-testid^="analytics-grid"] [role="img"] .recharts-label-list'

async function labelOpacities(page: Page): Promise<string[]> {
  await expect(page.locator(CHART_LABELS).first()).toBeAttached()
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll(
        '[data-testid^="analytics-grid"] [role="img"] .recharts-label-list, [data-testid^="analytics-grid"] [role="img"] .recharts-reference-line',
      ),
    ).map((node) => getComputedStyle(node).opacity),
  )
}

async function boxes(page: Page): Promise<Box[]> {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll(
        '[data-testid^="analytics-grid"] [role="img"] text, [data-testid^="analytics-grid"] > *, [data-testid="count-up-value"]',
      ),
    ).map((node) => {
      const box = node.getBoundingClientRect()
      return {
        x: Math.round(box.x + window.scrollX),
        y: Math.round(box.y + window.scrollY),
        width: Math.round(box.width),
        height: Math.round(box.height),
      }
    }),
  )
}

async function runningAnimations(page: Page): Promise<number> {
  return page.evaluate(
    () => document.getAnimations().filter((animation) => animation.playState === 'running').length,
  )
}

test.describe('with reduced motion set', () => {
  test.use({ reducedMotion: 'reduce' })

  test('runs no animation on the style guide', async ({ page }) => {
    await page.goto('/styleguide')
    await expect(page.locator(CHART_LABELS).first()).toBeAttached()

    expect(await runningAnimations(page)).toBe(0)
    await expect(page.locator('.chart-draw')).toHaveCount(0)
  })

  test('shows the final hero value at once', async ({ page }) => {
    await page.goto('/styleguide')

    const hero = page.getByTestId('count-up-value').first()
    await expect(hero).toHaveText(HERO_VALUE)
    await expect(hero).toHaveCSS('opacity', '1')
    await expect(page.getByTestId('count-up-display')).toHaveCount(0)
  })

  test('shows every chart label at once', async ({ page }) => {
    await page.goto('/styleguide')

    const opacities = await labelOpacities(page)

    expect(opacities.length).toBeGreaterThan(0)
    expect(opacities.every((value) => value === '1')).toBe(true)
  })
})

test.describe('with motion allowed', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('ends the line draw and shows every chart label', async ({ page }) => {
    await page.goto('/styleguide')

    await expect(page.locator('.chart-draw')).toHaveCount(0)
    const opacities = await labelOpacities(page)

    expect(opacities.every((value) => value === '1')).toBe(true)
  })

  test('ends the hero count-up on the final value', async ({ page }) => {
    await page.goto('/styleguide')

    await expect(page.getByTestId('count-up-display')).toHaveCount(0)
    const hero = page.getByTestId('count-up-value').first()
    await expect(hero).toHaveText(HERO_VALUE)
    await expect(hero).toHaveCSS('opacity', '1')
  })

  test('moves no label, no chart card and no hero value while it animates', async ({ page }) => {
    await page.goto('/styleguide')
    await expect(page.locator(CHART_LABELS).first()).toBeAttached()
    const before = await boxes(page)

    await expect(page.locator('.chart-draw')).toHaveCount(0)
    await expect(page.getByTestId('count-up-display')).toHaveCount(0)
    const after = await boxes(page)

    expect(before.length).toBeGreaterThan(0)
    expect(after).toEqual(before)
  })
})
