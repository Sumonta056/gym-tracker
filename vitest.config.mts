import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['lib/**/*.test.ts', 'middleware.test.ts'],
          exclude: ['lib/sync/worker.test.ts', 'lib/sync/useSyncStatus.test.ts'],
        },
      },
      {
        oxc: { jsx: { runtime: 'automatic' } },
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: [
            'components/**/*.test.tsx',
            'app/**/*.test.tsx',
            'app/**/*.test.ts',
            'lib/sync/worker.test.ts',
            'lib/sync/useSyncStatus.test.ts',
          ],
          setupFiles: ['tests/setup.ui.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'json'],
      reportsDirectory: 'coverage',
      include: ['lib/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.d.ts', 'app/sw.ts', 'app/layout.tsx'],
      thresholds: {
        perFile: true,
        lines: 85,
        branches: 75,
        functions: 85,
        'lib/duration.ts': {
          lines: 100,
          branches: 100,
          functions: 100,
        },
        'lib/metrics/**': {
          lines: 100,
          branches: 95,
          functions: 100,
        },
        'lib/sync/**': {
          lines: 95,
          branches: 90,
          functions: 95,
        },
        'components/**': {
          lines: 85,
          branches: 75,
          functions: 85,
        },
        'app/**': {
          lines: 85,
          branches: 75,
          functions: 85,
        },
      },
    },
  },
})
