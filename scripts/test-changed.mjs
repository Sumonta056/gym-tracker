import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const base = process.argv[2] ?? 'HEAD'

const FULL_RUN_TRIGGERS = [
  'vitest.config.mts',
  'package.json',
  'pnpm-lock.yaml',
  'tsconfig.json',
  'tests/setup.ui.ts',
]
const COVERAGE_EXEMPT = new Set(['app/sw.ts', 'app/layout.tsx'])
const SOURCE_ROOTS = ['lib/', 'components/', 'app/']

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean)
}

function run(args) {
  const result = spawnSync('pnpm', ['exec', 'vitest', ...args], { stdio: 'inherit' })
  process.exit(result.status ?? 1)
}

const changed = [
  ...new Set([
    ...git(['diff', '--name-only', base]),
    ...git(['ls-files', '--others', '--exclude-standard']),
  ]),
].filter((file) => existsSync(file))

if (changed.some((file) => FULL_RUN_TRIGGERS.includes(file))) {
  console.log('test:changed: a config file changed, so every test runs')
  run(['run', '--coverage'])
}

const tsFiles = changed.filter((file) => /\.(ts|tsx)$/.test(file) && !file.endsWith('.d.ts'))

if (tsFiles.length === 0) {
  console.log(`test:changed: no TypeScript file changed since ${base}`)
  process.exit(0)
}

const isTest = (file) => /\.test\.(ts|tsx)$/.test(file)
const subjects = tsFiles
  .map((file) => (isTest(file) ? file.replace(/\.test\.(ts|tsx)$/, '.$1') : file))
  .flatMap((file) => [file, file.replace(/\.ts$/, '.tsx'), file.replace(/\.tsx$/, '.ts')])
  .filter((file) => existsSync(file) && !isTest(file))
  .filter((file) => SOURCE_ROOTS.some((root) => file.startsWith(root)) || file === 'middleware.ts')
  .filter((file) => !COVERAGE_EXEMPT.has(file))
const coverage = [...new Set(subjects)]

console.log(`test:changed: ${String(tsFiles.length)} changed files since ${base}`)

const coverageArgs =
  coverage.length === 0
    ? []
    : ['--coverage', ...coverage.flatMap((file) => ['--coverage.include', file])]

run(['related', '--run', '--passWithNoTests', ...coverageArgs, ...tsFiles])
