import { expect, test } from '@playwright/test'

import { heroValue, navLink, test as signedIn, waitForLocalDays } from './support/signedIn'

import type { Account } from './support/account'
import type { TestDay } from './support/signedIn'
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

type Sample = { at: number; path: string; opacity: number }

async function sampleTransition(page: Page): Promise<void> {
  await page.evaluate(() => {
    const samples: Sample[] = []
    Object.assign(window, { transitionSamples: samples })
    const tick = (): void => {
      const frame = document.querySelector('[data-testid="page-transition"]')
      if (frame !== null) {
        samples.push({
          at: performance.now(),
          path: location.pathname,
          opacity: Number(getComputedStyle(frame).opacity),
        })
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

function transitionSamples(page: Page, path: string): Promise<Sample[]> {
  return page.evaluate(
    (at) =>
      (window as unknown as { transitionSamples: Sample[] }).transitionSamples.filter(
        (sample) => sample.path === at,
      ),
    path,
  )
}

async function watchCountUp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: { added: number; counts: string[] } = { added: 0, counts: [] }
    const displays = new WeakSet<Element>()
    Object.assign(window, { countUp: seen })
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'attributes' && record.target instanceof Element) {
          seen.counts.push(record.target.getAttribute('data-count') ?? '')
        }
        for (const node of record.addedNodes) {
          if (node instanceof Element) {
            const display = node.matches('[data-testid="count-up-display"]')
              ? node
              : node.querySelector('[data-testid="count-up-display"]')
            if (display !== null && !displays.has(display)) {
              displays.add(display)
              seen.added += 1
              seen.counts.push(display.getAttribute('data-count') ?? '')
            }
          }
        }
      }
    }).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-count'],
    })
  })
}

function countUpSeen(page: Page): Promise<{ added: number; counts: string[] }> {
  return page.evaluate(
    () => (window as unknown as { countUp: { added: number; counts: string[] } }).countUp,
  )
}

function clockSeconds(text: string): number {
  return text.split(':').reduce((total, part) => total * 60 + Number(part), 0)
}

async function dashboardWithDay(page: Page, account: Account, day: TestDay): Promise<void> {
  await account.seed([{ entry_date: day.date, gym_seconds: 4325 }])
  await page.goto('/')
  await waitForLocalDays(page, [day.date])
  await page.reload()
}

signedIn.describe('on the live signed-in routes, with motion allowed', () => {
  signedIn.use({ reducedMotion: 'no-preference' })

  signedIn('fades the next page in over 180 ms on a real navigation', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('dashboard-grid')).toBeVisible()
    await sampleTransition(page)

    await navLink(page, 'Stats').click()
    await expect(page).toHaveURL(/\/analytics$/)
    await expect
      .poll(async () => (await transitionSamples(page, '/analytics')).some((s) => s.opacity === 1))
      .toBe(true)

    const samples = await transitionSamples(page, '/analytics')
    const start = samples[0]
    const end = samples.find((sample) => sample.opacity === 1)

    expect(start?.opacity ?? 1).toBeLessThan(0.5)
    const took = (end?.at ?? 0) - (start?.at ?? 0)
    expect(took).toBeGreaterThanOrEqual(120)
    expect(took).toBeLessThanOrEqual(600)
  })

  signedIn(
    'counts the recorded gym time up on the live dashboard',
    async ({ page, account, day }) => {
      await watchCountUp(page)
      await dashboardWithDay(page, account, day)

      await expect(heroValue(page)).toHaveText('1:12:05')
      await expect(page.getByTestId('count-up-display')).toHaveCount(0)
      await expect(heroValue(page)).toHaveCSS('opacity', '1')

      const { added, counts } = await countUpSeen(page)
      const seconds = counts.map(clockSeconds)
      expect(added).toBe(1)
      expect(seconds[0]).toBe(0)
      expect(seconds.at(-1)).toBe(4325)
      expect(seconds.some((value) => value > 0 && value < 4325)).toBe(true)
      expect(seconds).toEqual([...seconds].sort((left, right) => left - right))
    },
  )
})

signedIn.describe('on the live signed-in routes, with reduced motion set', () => {
  signedIn.use({ reducedMotion: 'reduce' })

  signedIn(
    'shows the final gym time on the live dashboard at once',
    async ({ page, account, day }) => {
      await watchCountUp(page)
      await dashboardWithDay(page, account, day)

      await expect(heroValue(page)).toHaveText('1:12:05')
      await expect(heroValue(page)).toHaveCSS('opacity', '1')
      expect(await countUpSeen(page)).toEqual({ added: 0, counts: [] })
    },
  )

  signedIn('swaps the page with no transition', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('dashboard-grid')).toBeVisible()
    await sampleTransition(page)

    await navLink(page, 'Stats').click()
    await expect(page).toHaveURL(/\/analytics$/)
    await expect
      .poll(async () => (await transitionSamples(page, '/analytics')).length)
      .toBeGreaterThan(3)

    const samples = await transitionSamples(page, '/analytics')
    expect(samples.every((sample) => sample.opacity === 1)).toBe(true)
  })
})
