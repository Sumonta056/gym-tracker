import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { defineConfig, devices } from '@playwright/test'

for (const file of ['.env.test.local', '.env.local']) {
  if (existsSync(file)) {
    process.loadEnvFile(file)
  }
}

const port = 3100
const baseURL = `http://127.0.0.1:${String(port)}`

const E2E_BUILD_MARKER = '.next/e2e-build'
const BUILD_INPUTS = [
  'app',
  'components',
  'lib',
  'public',
  'middleware.ts',
  'next.config.ts',
  'serwist.config.mjs',
  'postcss.config.mjs',
  'package.json',
  'pnpm-lock.yaml',
  'tsconfig.json',
  '.env.local',
]

function newestChange(path: string): number {
  if (!existsSync(path)) {
    return 0
  }
  const stat = statSync(path)
  if (!stat.isDirectory()) {
    return stat.mtimeMs
  }
  return readdirSync(path).reduce(
    (newest, name) => Math.max(newest, newestChange(join(path, name))),
    stat.mtimeMs,
  )
}

function e2eBuildIsFresh(): boolean {
  if (!existsSync(E2E_BUILD_MARKER) || !existsSync('.next/BUILD_ID')) {
    return false
  }
  const builtAt = statSync(E2E_BUILD_MARKER).mtimeMs
  if (statSync('.next/BUILD_ID').mtimeMs > builtAt) {
    return false
  }
  return Math.max(...BUILD_INPUTS.map(newestChange)) < builtAt
}

const serverCommand = `pnpm exec next start --port ${String(port)}`
const localCommand = e2eBuildIsFresh()
  ? serverCommand
  : `pnpm build && touch ${E2E_BUILD_MARKER} && ${serverCommand}`

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? undefined : 2,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: 'auth.setup.ts',
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      dependencies: ['setup'],
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: process.env.CI ? serverCommand : localCommand,
    url: baseURL,
    env: {
      NEXT_PUBLIC_ENABLE_STYLEGUIDE: '1',
      NEXT_PUBLIC_ENABLE_CSV_IMPORT: '1',
      NEXT_PUBLIC_ENABLE_CRASH_TEST: '1',
    },
    timeout: 180000,
    reuseExistingServer: !process.env.CI,
  },
})
