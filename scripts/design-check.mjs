import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const SCANNED_ROOTS = ['app/', 'components/']
const SCANNED_EXTENSIONS = ['.ts', '.tsx']

const ALLOWED_RAW_HEX = [
  { file: 'app/globals.css', reason: 'the token definitions themselves' },
  { file: 'app/manifest.ts', reason: 'a web manifest cannot read a css variable' },
  { file: 'app/layout.tsx', reason: 'the theme colour meta tag cannot read a css variable' },
  { file: 'lib/design/tokens.ts', reason: 'the chart mirror of the tokens' },
]

const ALLOWED_MICRO_LABEL = [
  { file: 'components/ui/MicroLabel.tsx', reason: 'the one definition of the style' },
]

const ALLOWED_OWN_FRAME = [
  { file: 'components/ui/AppShell.tsx', reason: 'the shell is the frame' },
  { file: 'app/~offline/page.tsx', reason: 'the offline fallback renders with no navigation' },
  {
    file: 'app/(auth)/layout.tsx',
    reason: 'the auth route group frame: sign-in renders before there is a user, so no navigation',
  },
]

const CHECKS = [
  {
    id: 'raw-hex',
    title: 'a raw hex colour',
    fix: 'use a token class, or lib/design/tokens.ts for chart code',
    pattern: /#[0-9a-fA-F]{3,8}\b/,
    allowed: ALLOWED_RAW_HEX,
  },
  {
    id: 'hand-mixed-colour',
    title: 'a hand mixed rgb or rgba colour',
    fix: 'use a token class with an opacity modifier, for example text-muted/70',
    pattern: /\brgba?\(\s*\d/,
    allowed: [],
  },
  {
    id: 'hand-written-micro-label',
    title: 'a hand written micro label',
    fix: 'use <MicroLabel>, which owns text-[10px], font-bold, tracking-[1.5px] and uppercase',
    pattern: /tracking-\[1\.5px\]|\buppercase\b/,
    allowed: ALLOWED_MICRO_LABEL,
  },
  {
    id: 'own-frame',
    title: 'a page that builds its own frame',
    fix: 'render the content inside <AppShell>, which owns the height, the width cap and the gutters',
    pattern: /min-h-dvh|max-w-\[1100px\]/,
    allowed: ALLOWED_OWN_FRAME,
  },
  {
    id: 'button-without-type',
    title: 'a button with no explicit type',
    fix: 'add type="button" or type="submit"',
    pattern: /<button(?![^>]*\stype=)(?=[^>]*>)/,
    allowed: [],
  },
]

function isScanned(path) {
  if (path.endsWith('.test.ts') || path.endsWith('.test.tsx')) return false
  if (!SCANNED_EXTENSIONS.some((extension) => path.endsWith(extension))) return false
  return SCANNED_ROOTS.some((root) => path.startsWith(root))
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

function allowedFor(check, path) {
  return check.allowed.some((entry) => entry.file === path)
}

function scan(path) {
  let source
  try {
    source = readFileSync(resolve(ROOT, path), 'utf8')
  } catch {
    return []
  }

  const lines = source.split('\n')
  const found = []

  for (const check of CHECKS) {
    if (allowedFor(check, path)) continue
    lines.forEach((line, index) => {
      if (check.pattern.test(line)) {
        found.push({ path, line: index + 1, check, text: line.trim() })
      }
    })
  }

  return found
}

const staged = process.argv.includes('--staged')
const candidates = (staged ? stagedFiles() : trackedFiles()).filter(isScanned)
const findings = candidates.flatMap(scan)

if (findings.length === 0) {
  const scope = staged ? 'staged' : 'tracked'
  console.log(`design-check: ${String(candidates.length)} ${scope} files, no drift`)
  process.exit(0)
}

console.error('')
console.error('DESIGN CHECK FAILED')
console.error('')

const byCheck = new Map()
for (const finding of findings) {
  const list = byCheck.get(finding.check.id) ?? []
  list.push(finding)
  byCheck.set(finding.check.id, list)
}

for (const [, list] of byCheck) {
  const check = list[0].check
  console.error(`${check.title}`)
  for (const finding of list) {
    console.error(`  ${relative('.', finding.path)}:${String(finding.line)}`)
    console.error(`    ${finding.text.slice(0, 110)}`)
  }
  console.error(`  fix: ${check.fix}`)
  console.error('')
}

console.error('The nine point list lives in .claude/skills/design-system/references/checklist.md')
console.error('')
process.exit(1)
