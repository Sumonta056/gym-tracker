import { expect, test } from '@playwright/test'

import type { Page } from '@playwright/test'

type Box = { x: number; y: number; width: number; height: number }

async function chartBoxes(page: Page): Promise<Box[]> {
  const grid = page.getByTestId('analytics-grid')
  await grid.scrollIntoViewIfNeeded()
  await expect(grid.getByRole('img').first()).toBeVisible()

  return grid.evaluate((element) =>
    Array.from(element.children).map((child) => {
      const box = child.getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width, height: box.height }
    }),
  )
}

function rowCount(boxes: Box[], take: number): number {
  return new Set(boxes.slice(0, take).map((box) => Math.round(box.y))).size
}

test('shows two charts per row at 1440 px, on the style guide sample', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/styleguide')

  const boxes = await chartBoxes(page)

  expect(boxes).toHaveLength(7)
  expect(Math.round(boxes[0]?.y ?? 0)).toBe(Math.round(boxes[1]?.y ?? -1))
  expect(boxes[1]?.x ?? 0).toBeGreaterThan(boxes[0]?.x ?? 0)
  expect(rowCount(boxes, 6)).toBe(3)
})

test('shows one chart per row at 390 px, on the style guide sample', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/styleguide')

  const boxes = await chartBoxes(page)

  expect(rowCount(boxes, 7)).toBe(7)
  for (const box of boxes) {
    expect(Math.round(box.x)).toBe(Math.round(boxes[0]?.x ?? 0))
  }
})

test('draws every chart to the width of its card at 320 px, with no sideways scroll', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/styleguide')
  await chartBoxes(page)

  const charts = page.getByTestId('analytics-grid').locator('[role="img"] svg')
  await expect(charts.first()).toBeVisible()

  const widths = await charts.evaluateAll((elements) =>
    elements.map((element) => ({
      svg: element.getBoundingClientRect().width,
      card: element.closest('[role="img"]')?.getBoundingClientRect().width ?? 0,
    })),
  )

  for (const width of widths) {
    expect(width.svg).toBeGreaterThan(0)
    expect(Math.abs(width.svg - width.card)).toBeLessThanOrEqual(1)
  }

  const box = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth)
})

test('reads the weight trend outside the canvas, on the style guide sample', async ({ page }) => {
  await page.goto('/styleguide')

  await expect(
    page.getByRole('img', {
      name: 'Weight per day: 74.1, 73.9, 74.2, 73.7, 73.6, 73.5, 73.4 kilograms. Seven day average falling, 73.8 on the last day.',
    }),
  ).toBeAttached()
})

const LABEL_CHECKS = [
  { width: 320, grids: ['analytics-grid', 'analytics-grid-one-day'] },
  { width: 390, grids: ['analytics-grid', 'analytics-grid-one-day', 'analytics-grid-heavy'] },
  { width: 430, grids: ['analytics-grid', 'analytics-grid-one-day', 'analytics-grid-heavy'] },
]

async function labelProblems(page: Page, grids: readonly string[]): Promise<string[]> {
  return page.evaluate((ids) => {
    const found: string[] = []
    const selector = ids.map((id) => `[data-testid="${id}"] [role="img"] svg`).join(', ')
    for (const svg of document.querySelectorAll(selector)) {
      const texts = Array.from(svg.querySelectorAll('text'))
        .filter((node) => node.textContent.trim() !== '')
        .map((node) => ({ text: node.textContent, box: node.getBoundingClientRect() }))
      const frame = svg.getBoundingClientRect()
      texts.forEach((one, index) => {
        if (one.box.right > frame.right + 0.5 || one.box.left < frame.left - 0.5) {
          found.push(`clipped ${one.text}`)
        }
        for (const other of texts.slice(index + 1)) {
          const apart =
            one.box.right <= other.box.left + 0.5 ||
            other.box.right <= one.box.left + 0.5 ||
            one.box.bottom <= other.box.top + 0.5 ||
            other.box.bottom <= one.box.top + 0.5
          if (!apart) {
            found.push(`${one.text} overlaps ${other.text}`)
          }
        }
      })
    }
    return found
  }, grids)
}

for (const { width, grids } of LABEL_CHECKS) {
  test(`keeps every chart label apart and inside its chart at ${String(width)} px, on ${grids.join(', ')}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/styleguide')
    await chartBoxes(page)

    expect(await labelProblems(page, grids)).toEqual([])
  })
}

test('keeps the five character step labels of a heavy week apart at 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/styleguide')
  await chartBoxes(page)

  expect(await labelProblems(page, ['analytics-grid-heavy'])).toEqual([])
})

test('shows the not enough data state on the one logged day sample', async ({ page }) => {
  await page.goto('/styleguide')

  const grid = page.getByTestId('analytics-grid-one-day')

  await expect(grid.getByText('Log one more day to see a trend.')).toHaveCount(2)
})

test.fixme('switches the /analytics range from week to month (needs the signed-in fixture from step 1.16)', async ({
  page,
}) => {
  await page.goto('/analytics')
  await page.getByRole('button', { name: 'Month' }).click()

  await expect(page.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
})
