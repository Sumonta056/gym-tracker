import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const REQUIRED_ROOTS = ['lib/', 'components/', 'app/']

const EXEMPT = [
  { file: 'app/sw.ts', reason: 'the service worker runs outside the dom and has no unit seam' },
  { file: 'app/layout.tsx', reason: 'the root layout is proved by the end to end suite' },
  { file: 'app/globals.css', reason: 'a stylesheet, proved by the token drift test' },
]

const EXEMPT_SUFFIXES = ['.d.ts']

function isSource(path) {
  if (!path.endsWith('.ts') && !path.endsWith('.tsx')) return false
  if (path.endsWith('.test.ts') || path.endsWith('.test.tsx')) return false
  if (EXEMPT_SUFFIXES.some((suffix) => path.endsWith(suffix))) return false
  if (EXEMPT.some((entry) => entry.file === path)) return false
  return REQUIRED_ROOTS.some((root) => path.startsWith(root))
}

function testPathsFor(path) {
  const base = path.replace(/\.tsx?$/, '')
  return [`${base}.test.ts`, `${base}.test.tsx`]
}

function stagedFiles() {
  const output = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  return output.split('\n').filter((line) => line !== '')
}

function trackedFiles() {
  const output = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
  return output.split('\n').filter((line) => line !== '')
}

const staged = process.argv.includes('--staged')
const candidates = (staged ? stagedFiles() : trackedFiles()).filter(isSource)

const missing = candidates
  .map((path) => ({ path, tests: testPathsFor(path) }))
  .filter((entry) => !entry.tests.some((test) => existsSync(resolve(ROOT, test))))

if (missing.length === 0) {
  const scope = staged ? 'staged' : 'tracked'
  console.log(`require-tests: ${String(candidates.length)} ${scope} source files, all have a test`)
  process.exit(0)
}

console.error('')
console.error('MISSING UNIT TESTS')
console.error('')

for (const entry of missing) {
  console.error(`  ${entry.path}`)
  console.error(`    needs ${entry.tests.join(' or ')}`)
}

console.error('')
console.error('Write the test, or add the file to EXEMPT in scripts/require-tests.mjs with a')
console.error('reason. Never exempt a file just to get past this gate.')
console.error('')
process.exit(1)
