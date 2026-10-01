import { expect, test } from '@playwright/test'

import { navLink, openWithWeek, test as signedIn } from './support/signedIn'

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

async function liftBoxes(page: Page): Promise<Box[]> {
  const grid = page.getByTestId('lift-grid')
  await grid.scrollIntoViewIfNeeded()
  await expect(grid.getByRole('img').first()).toBeVisible()

  return grid.evaluate((element) =>
    Array.from(element.children).map((child) => {
      const box = child.getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width, height: box.height }
    }),
  )
}

test('shows two lifting cards per row at 1440 px, on the style guide sample', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/styleguide')

  const boxes = await liftBoxes(page)

  expect(boxes).toHaveLength(3)
  expect(Math.round(boxes[0]?.y ?? 0)).toBe(Math.round(boxes[1]?.y ?? -1))
  expect(boxes[1]?.x ?? 0).toBeGreaterThan(boxes[0]?.x ?? 0)
  expect(rowCount(boxes, 3)).toBe(2)
})

test('shows one lifting card per row at 390 px, on the style guide sample', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/styleguide')

  const boxes = await liftBoxes(page)

  expect(rowCount(boxes, 3)).toBe(3)
  for (const box of boxes) {
    expect(Math.round(box.x)).toBe(Math.round(boxes[0]?.x ?? 0))
  }
})

const LIFT_GRIDS = ['lift-grid', 'lift-grid-heavy', 'lift-grid-one-session']

for (const width of [320, 390, 430]) {
  test(`keeps every lifting chart label apart and inside its chart at ${String(width)} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/styleguide')
    await liftBoxes(page)

    expect(await labelProblems(page, LIFT_GRIDS)).toEqual([])
  })
}

test('keeps every lifting chart label apart on the month range at 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/styleguide')
  await page
    .locator('section', { has: page.getByRole('heading', { level: 2, name: 'Analytics' }) })
    .getByRole('button', { name: 'Month' })
    .click()
  await liftBoxes(page)

  expect(await labelProblems(page, LIFT_GRIDS)).toEqual([])
})

async function lineCrossings(page: Page, grids: readonly string[]): Promise<string[]> {
  return page.evaluate((ids) => {
    const found: string[] = []
    const selector = ids.map((id) => `[data-testid="${id}"] [role="img"] svg`).join(', ')
    for (const svg of document.querySelectorAll(selector)) {
      const labels = Array.from(svg.querySelectorAll('.recharts-label-list text'))
        .filter((node) => node.textContent.trim() !== '')
        .map((node) => ({ text: node.textContent, box: node.getBoundingClientRect() }))
      for (const line of svg.querySelectorAll('.recharts-reference-line line')) {
        const y = line.getBoundingClientRect().top
        for (const label of labels) {
          if (y >= label.box.top - 1 && y <= label.box.bottom + 1) {
            found.push(`the average line touches ${label.text}`)
          }
        }
      }
    }
    return found
  }, grids)
}

const LINE_CHECKS = [320, 390, 768, 1440].flatMap((width) =>
  ['Day', 'Week', 'Month'].map((range) => ({ width, range })),
)

for (const { width, range } of LINE_CHECKS) {
  test(`keeps the average line off every value label on the ${range} range at ${String(width)} px`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/styleguide')
    await page
      .locator('section', { has: page.getByRole('heading', { level: 2, name: 'Analytics' }) })
      .getByRole('button', { name: range })
      .click()
    await page.getByTestId('lift-grid').scrollIntoViewIfNeeded()

    expect(await lineCrossings(page, LIFT_GRIDS)).toEqual([])
  })
}

test('draws the lifting charts to the width of their cards at 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/styleguide')
  await liftBoxes(page)

  const widths = await page
    .getByTestId('lift-grid')
    .locator('[role="img"] svg')
    .evaluateAll((elements) =>
      elements.map((element) => ({
        svg: element.getBoundingClientRect().width,
        card: element.closest('[role="img"]')?.getBoundingClientRect().width ?? 0,
      })),
    )

  expect(widths).toHaveLength(2)
  for (const width of widths) {
    expect(width.svg).toBeGreaterThan(0)
    expect(Math.abs(width.svg - width.card)).toBeLessThanOrEqual(1)
  }
})

test('shows the not enough data state on the one session sample', async ({ page }) => {
  await page.goto('/styleguide')

  const grid = page.getByTestId('lift-grid-one-session')

  await expect(grid.getByText('Log one more session to see a trend.')).toHaveCount(1)
  await expect(grid.locator('[role="img"]')).toHaveCount(1)
})

signedIn('switches the /analytics range from week to month', async ({ page, account, day }) => {
  await openWithWeek(page, account, day)
  await navLink(page, 'Stats').click()
  await expect(page.getByTestId('analytics-grid')).toBeVisible()

  await page.getByRole('button', { name: 'Month' }).click()

  await expect(page.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'false')
})
