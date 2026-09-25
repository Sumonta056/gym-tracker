import { dirname } from 'path'
import { fileURLToPath } from 'url'

import { FlatCompat } from '@eslint/eslintrc'
import vitest from '@vitest/eslint-plugin'
import tseslint from 'typescript-eslint'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const REPOSITORY_RULE =
  'The repository rule: no screen calls Supabase. Import lib/db/repository.ts instead. Only lib/sync/* may import lib/supabase/* or @supabase/*.'

const restrictedSupabase = {
  patterns: [
    {
      group: [
        '@supabase/*',
        '@/lib/supabase',
        '@/lib/supabase/*',
        '**/lib/supabase',
        '**/lib/supabase/*',
        '@/lib/sync',
        '@/lib/sync/*',
        '**/lib/sync',
        '**/lib/sync/*',
      ],
      message: REPOSITORY_RULE,
    },
  ],
}

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'reports/**',
      'docs/design/prototype/**',
      '.lighthouseci/**',
      'public/sw.js',
      'public/sw.js.map',
      'public/swe-worker-*.js',
      'next-env.d.ts',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
        node: true,
      },
    },
    rules: {
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'type',
          ],
          pathGroups: [
            {
              pattern: '@/**',
              group: 'internal',
              position: 'before',
            },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      'jsx-a11y/no-static-element-interactions': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', restrictedSupabase],
    },
  },
  {
    files: [
      'lib/sync/**/*.{ts,tsx}',
      'lib/supabase/**/*.{ts,tsx}',
      'lib/auth/**/*.{ts,tsx}',
      'middleware.ts',
      'tests/e2e/support/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['lib/supabase/database.types.ts'],
    rules: {
      '@typescript-eslint/no-redundant-type-constituents': 'off',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    plugins: { vitest },
    rules: vitest.configs.recommended.rules,
    settings: {
      vitest: { typecheck: true },
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
)
