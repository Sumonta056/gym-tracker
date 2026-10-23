import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'

const ROOT = resolve(import.meta.dirname, '..')
const DEFAULT_RANGE = 'origin/main..HEAD'
const FEAT = /^feat(\([^)]*\))?!?:/
const UI_ROOTS = ['app/', 'components/']
const SITE_ROOTS = ['site/', 'README.md']
const OPT_OUT = /^Site-update:\s*none\s*$/im
const FIELD = '\x1f'
const RECORD = '\x1e'

function git(args) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function lines(output) {
  return output.split('\n').filter((line) => line !== '')
}

function touches(files, roots) {
  return files.some((file) => roots.some((root) => file === root || file.startsWith(root)))
}

function commitsIn(range) {
  return git(['log', `--format=%H${FIELD}%s${FIELD}%b${RECORD}`, range, '--'])
    .split(RECORD)
    .map((record) => record.replace(/^\n/, ''))
    .filter((record) => record !== '')
    .map((record) => {
      const [sha = '', subject = '', body = ''] = record.split(FIELD)
      return { sha, subject, body }
    })
}

function filesOf(sha) {
  return lines(git(['diff-tree', '--no-commit-id', '--name-only', '-r', '--root', sha]))
}

const { values } = parseArgs({
  options: { range: { type: 'string', default: DEFAULT_RANGE } },
})
const range = values.range

let commits
let rangeFiles
try {
  commits = commitsIn(range)
  rangeFiles = lines(git(['log', '--format=', '--name-only', range, '--']))
} catch (error) {
  console.error(`site-check: git could not read the range ${range}.`)
  console.error(String(error?.stderr ?? error).trim())
  process.exit(1)
}

const siteTouched = touches(rangeFiles, SITE_ROOTS)
const features = commits.filter(
  (commit) => FEAT.test(commit.subject) && touches(filesOf(commit.sha), UI_ROOTS),
)
const missing = features.filter((commit) => !siteTouched && !OPT_OUT.test(commit.body))

if (missing.length === 0) {
  const why =
    features.length === 0
      ? 'no user-visible feat commit'
      : siteTouched
        ? 'site/ or README.md changed in the range'
        : 'every feat commit says Site-update: none'
  console.log(
    `site-check: ${range}: ${String(commits.length)} commits, ${String(features.length)} feat under app/ or components/. Passed: ${why}.`,
  )
  process.exit(0)
}

console.error('')
console.error(`site-check: ${range}: the website and the README are out of date.`)
console.error('')
for (const commit of missing) {
  console.error(`  ${commit.sha.slice(0, 7)} ${commit.subject}`)
}
console.error('')
console.error('Run the update-website skill, or add `Site-update: none` to the commit body.')
console.error('')
process.exit(1)
