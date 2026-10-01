import { signIn } from './support/account'
import { chip, expect, navLink, recordDay, test, waitForServiceWorker } from './support/signedIn'

import type { APIResponse, Page } from '@playwright/test'

const OK_GREEN = 'rgb(74, 222, 128)'

type CacheContents = { names: string[]; urls: string[] }

function readCaches(page: Page): Promise<CacheContents> {
  return page.evaluate(async () => {
    const names = await caches.keys()
    const urls: string[] = []

    for (const name of names) {
      const requests = await (await caches.open(name)).keys()
      urls.push(...requests.map((request) => request.url))
    }

    return { names, urls }
  })
}

async function expectNoSupabaseCache(page: Page): Promise<void> {
  const { names, urls } = await readCaches(page)

  expect(names).not.toContain('supabase')
  expect(urls.filter((url) => new URL(url).hostname.endsWith('.supabase.co'))).toEqual([])
}

const SECURITY_HEADERS = {
  'content-security-policy': "frame-ancestors 'none'",
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
}

function securityHeaders(response: APIResponse): Record<string, string | undefined> {
  const headers = response.headers()

  return Object.fromEntries(Object.keys(SECURITY_HEADERS).map((name) => [name, headers[name]]))
}

test.describe('the security headers when signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('sends the 5 headers on the sign-in page', async ({ context }) => {
    const response = await context.request.get('/sign-in', { maxRedirects: 0 })

    expect(response.status()).toBe(200)
    expect(securityHeaders(response)).toEqual(SECURITY_HEADERS)
  })

  test('sends the 5 headers on the redirect from the home page', async ({ context }) => {
    const response = await context.request.get('/', { maxRedirects: 0 })

    expect(response.status()).toBe(307)
    expect(new URL(response.headers().location ?? '', 'http://x').pathname).toBe('/sign-in')
    expect(securityHeaders(response)).toEqual(SECURITY_HEADERS)
  })

  for (const path of ['/sw.js', '/manifest.webmanifest']) {
    test(`still serves ${path} with the 5 headers`, async ({ context }) => {
      const response = await context.request.get(path, { maxRedirects: 0 })

      expect(response.status()).toBe(200)
      expect(securityHeaders(response)).toEqual(SECURITY_HEADERS)
    })
  }
})

test.describe('the security headers when signed in', () => {
  test('sends the 5 headers on the home page', async ({ context }) => {
    const response = await context.request.get('/', { maxRedirects: 0 })

    expect(response.status()).toBe(200)
    expect(securityHeaders(response)).toEqual(SECURITY_HEADERS)
  })
})

test.describe('the service worker cache', () => {
  test.use({
    storageState: { cookies: [], origins: [] },
    serviceWorkers: async ({ browserName }, provide) => {
      await provide(browserName === 'webkit' ? 'block' : 'allow')
    },
  })

  test('keeps no Supabase response after a sync and after a sign-out', async ({
    page,
    context,
    browserName,
    baseURL,
  }) => {
    test.skip(
      browserName === 'webkit',
      'Playwright WebKit runs these suites with service workers blocked, so Cache Storage holds nothing to check.',
    )

    await page.addLocatorHandler(
      page.getByRole('heading', { level: 2, name: 'Session running' }),
      async () => {
        await page.getByRole('button', { name: 'Close Session running' }).click()
      },
    )
    await context.addCookies(await signIn(new URL(baseURL ?? '').hostname))
    await page.goto('/log')
    await waitForServiceWorker(page)
    expect(
      await page.evaluate(
        async () => (await navigator.serviceWorker.getRegistration())?.active?.scriptURL ?? '',
      ),
    ).toMatch(/\/sw\.js$/)

    await page.reload()
    await expect(page.getByRole('button', { name: 'Save entry' })).toBeEnabled()
    await recordDay(page, { gym: '0:42:00', steps: '5100' })
    await page.goto('/')
    await expect(navLink(page, 'Today').first()).toBeVisible()
    const synced = chip(page, 'Synced')
    await expect(synced).toBeVisible()
    await expect(synced.locator('[aria-hidden="true"]').first()).toHaveCSS(
      'background-color',
      OK_GREEN,
    )

    await expectNoSupabaseCache(page)

    await page.goto('/profile')
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/sign-in$/)

    await expectNoSupabaseCache(page)
  })
})
