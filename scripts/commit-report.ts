import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const SECTION_TITLES = [
  'What this commit does',
  'Improvements',
  'Fallbacks',
  'Things to consider',
  'Evidence',
] as const

type SectionTitle = (typeof SECTION_TITLES)[number]

interface Draft {
  meta: Map<string, string>
  sections: Map<SectionTitle, string[]>
}

interface CoverageMetric {
  pct: number | null
  covered: number | null
  total: number | null
}

interface CoverageRow {
  file: string
  lines: CoverageMetric
  branches: CoverageMetric
  functions: CoverageMetric
  statements: CoverageMetric
}

interface TestCounts {
  totalTests: number | null
  passedTests: number | null
  failedTests: number | null
  skippedTests: number | null
  totalSuites: number | null
  durationMs: number | null
}

function fail(message: string): never {
  process.stderr.write(`commit-report: ${message}\n`)
  process.exit(1)
}

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
}

function gitBytes(args: string[]): Buffer {
  return execFileSync('git', args, { maxBuffer: 256 * 1024 * 1024 })
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inline(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug
}

function today(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${String(now.getFullYear())}-${month}-${day}`
}

function isSectionTitle(value: string): value is SectionTitle {
  return (SECTION_TITLES as readonly string[]).includes(value)
}

function parseDraft(raw: string): Draft {
  const meta = new Map<string, string>()
  const sections = new Map<SectionTitle, string[]>()

  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  let index = 0

  if (lines[0]?.trim() === '---') {
    index = 1
    while (index < lines.length && lines[index]?.trim() !== '---') {
      const line = lines[index] ?? ''
      const match = /^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/.exec(line)
      const key = match?.[1]
      const value = match?.[2]
      if (key !== undefined && value !== undefined) {
        meta.set(key.toLowerCase(), value.trim())
      }
      index += 1
    }
    index += 1
  }

  let current: SectionTitle | null = null
  let fenced = false

  for (; index < lines.length; index += 1) {
    const line = lines[index] ?? ''

    if (line.trimStart().startsWith('```')) {
      fenced = !fenced
    }

    const heading = fenced ? null : /^#{1,3}\s+(.*)$/.exec(line)
    const headingText = heading?.[1]?.trim()

    if (headingText !== undefined) {
      if (isSectionTitle(headingText)) {
        current = headingText
        sections.set(current, [])
        continue
      }
      if (current === null) {
        if (!meta.has('title')) {
          meta.set('title', headingText)
        }
        continue
      }
    }

    if (current !== null) {
      sections.get(current)?.push(line)
    }
  }

  return { meta, sections }
}

function renderMarkdown(lines: string[]): string {
  const html: string[] = []
  let listOpen = false
  let paragraph: string[] = []
  let fence: string[] | null = null
  let item: string[] | null = null

  const closeItem = (): void => {
    if (item !== null) {
      html.push(`          <li>${inline(item.join(' '))}</li>`)
      item = null
    }
  }

  const closeList = (): void => {
    closeItem()
    if (listOpen) {
      html.push('        </ul>')
      listOpen = false
    }
  }

  const closeParagraph = (): void => {
    if (paragraph.length > 0) {
      html.push(`        <p>${inline(paragraph.join(' '))}</p>`)
      paragraph = []
    }
  }

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      if (fence === null) {
        closeParagraph()
        closeList()
        fence = []
      } else {
        html.push(`        <pre>${escapeHtml(fence.join('\n'))}</pre>`)
        fence = null
      }
      continue
    }

    if (fence !== null) {
      fence.push(line)
      continue
    }

    if (line.trim() === '') {
      closeParagraph()
      closeList()
      continue
    }

    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    const bulletText = bullet?.[1]

    if (bulletText !== undefined) {
      closeParagraph()
      closeItem()
      if (!listOpen) {
        html.push('        <ul>')
        listOpen = true
      }
      item = [bulletText]
      continue
    }

    if (item !== null) {
      item.push(line.trim())
      continue
    }

    closeList()
    paragraph.push(line.trim())
  }

  if (fence !== null) {
    html.push(`        <pre>${escapeHtml(fence.join('\n'))}</pre>`)
  }
  closeParagraph()
  closeList()

  return html.join('\n')
}

function readMetric(source: Record<string, unknown> | null): CoverageMetric {
  if (source === null) {
    return { pct: null, covered: null, total: null }
  }
  return {
    pct: asFiniteNumber(source['pct']),
    covered: asFiniteNumber(source['covered']),
    total: asFiniteNumber(source['total']),
  }
}

function readCoverage(root: string): { rows: CoverageRow[]; note: string | null } {
  const file = join(root, 'coverage', 'coverage-summary.json')
  if (!existsSync(file)) {
    return {
      rows: [],
      note: 'No coverage/coverage-summary.json was found. Run pnpm test:cov before the report.',
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return { rows: [], note: 'coverage/coverage-summary.json could not be parsed as JSON.' }
  }

  const record = asRecord(parsed)
  if (record === null) {
    return { rows: [], note: 'coverage/coverage-summary.json is not an object.' }
  }

  const rows: CoverageRow[] = []
  for (const [key, value] of Object.entries(record)) {
    const entry = asRecord(value)
    if (entry === null) {
      continue
    }
    const within = relative(root, key)
    const name = key === 'total' ? 'total' : within === '' || within.startsWith('..') ? key : within
    rows.push({
      file: name,
      lines: readMetric(asRecord(entry['lines'])),
      branches: readMetric(asRecord(entry['branches'])),
      functions: readMetric(asRecord(entry['functions'])),
      statements: readMetric(asRecord(entry['statements'])),
    })
  }

  rows.sort((a, b) => {
    if (a.file === 'total') return -1
    if (b.file === 'total') return 1
    return a.file.localeCompare(b.file)
  })

  return { rows, note: rows.length === 0 ? 'The coverage summary held no files.' : null }
}

function readTestCounts(
  root: string,
  override: string | null,
): { counts: TestCounts | null; note: string | null } {
  const candidates =
    override === null
      ? [
          join(root, 'reports', '.vitest-report.json'),
          join(root, 'coverage', 'vitest-report.json'),
          join(root, 'vitest-report.json'),
        ]
      : [override.startsWith('/') ? override : join(root, override)]

  const found = candidates.find((candidate) => existsSync(candidate))
  if (found === undefined) {
    return {
      counts: null,
      note: 'No Vitest JSON report was found. Run pnpm vitest run --reporter=json --outputFile=reports/.vitest-report.json to include the test counts.',
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(found, 'utf8'))
  } catch {
    return { counts: null, note: `${relative(root, found)} could not be parsed as JSON.` }
  }

  const record = asRecord(parsed)
  if (record === null) {
    return { counts: null, note: `${relative(root, found)} is not a Vitest JSON report.` }
  }

  const start = asFiniteNumber(record['startTime'])
  const end = asFiniteNumber(record['endTime'])

  return {
    counts: {
      totalTests: asFiniteNumber(record['numTotalTests']),
      passedTests: asFiniteNumber(record['numPassedTests']),
      failedTests: asFiniteNumber(record['numFailedTests']),
      skippedTests: asFiniteNumber(record['numPendingTests']),
      totalSuites: asFiniteNumber(record['numTotalTestSuites']),
      durationMs: start !== null && end !== null ? end - start : null,
    },
    note: null,
  }
}

function metricCell(metric: CoverageMetric): string {
  if (metric.pct === null) {
    return '<td class="dim">—</td>'
  }
  const detail =
    metric.covered !== null && metric.total !== null
      ? ` <span class="dim">${String(metric.covered)}/${String(metric.total)}</span>`
      : ''
  return `<td>${String(metric.pct)}%${detail}</td>`
}

function renderCoverage(rows: CoverageRow[], note: string | null): string {
  if (rows.length === 0) {
    return `        <p class="note">${inline(note ?? 'No coverage data.')}</p>`
  }
  const body = rows
    .map((row) => {
      const name =
        row.file === 'total' ? '<strong>total</strong>' : `<code>${escapeHtml(row.file)}</code>`
      return [
        '          <tr>',
        `            <td>${name}</td>`,
        `            ${metricCell(row.lines)}`,
        `            ${metricCell(row.branches)}`,
        `            ${metricCell(row.functions)}`,
        `            ${metricCell(row.statements)}`,
        '          </tr>',
      ].join('\n')
    })
    .join('\n')

  return [
    '        <table>',
    '          <tr>',
    '            <th>File</th>',
    '            <th>Lines</th>',
    '            <th>Branches</th>',
    '            <th>Functions</th>',
    '            <th>Statements</th>',
    '          </tr>',
    body,
    '        </table>',
  ].join('\n')
}

function renderTests(counts: TestCounts | null, note: string | null): string {
  if (counts === null) {
    return `        <p class="note">${inline(note ?? 'No test report.')}</p>`
  }
  const cells = [
    ['Tests', counts.totalTests],
    ['Passed', counts.passedTests],
    ['Failed', counts.failedTests],
    ['Skipped', counts.skippedTests],
    ['Suites', counts.totalSuites],
    ['Duration', counts.durationMs],
  ] as const

  const body = cells
    .map(([label, value]) => {
      if (value === null) {
        return `          <tr><td>${label}</td><td class="dim">—</td></tr>`
      }
      const shown = label === 'Duration' ? `${String(value)} ms` : String(value)
      const klass = label === 'Failed' && value > 0 ? ' class="fail"' : ''
      return `          <tr><td>${label}</td><td${klass}>${shown}</td></tr>`
    })
    .join('\n')

  return ['        <table>', body, '        </table>'].join('\n')
}

function section(title: string, body: string): string {
  return [
    '      <section>',
    `        <div class="label">${escapeHtml(title)}</div>`,
    body,
    '      </section>',
  ].join('\n')
}

const STYLE = `      :root {
        --ground: #0b0b0d;
        --surface: #15151a;
        --surface-2: #1e1e25;
        --border: #24242c;
        --text: #f4f4f7;
        --muted: #8c8c99;
        --dim: #6e6e7b;
        --accent: #c6f135;
        --accent-ink: #10160a;
        --ok: #4ade80;
        --warn: #fb923c;
        --danger: #f87171;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 20px;
        background: var(--ground);
        color: var(--text);
        font-family: Figtree, system-ui, sans-serif;
        font-variant-numeric: tabular-nums;
        line-height: 1.55;
      }
      main {
        max-width: 1100px;
        margin: 0 auto;
      }
      h1 {
        font-size: 26px;
        font-weight: 800;
        margin: 0 0 4px;
      }
      .sub {
        color: var(--muted);
        font-size: 13px;
        margin-bottom: 20px;
      }
      section {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 20px;
        margin-bottom: 12px;
      }
      .label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 8px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      }
      th,
      td {
        text-align: left;
        padding: 8px 10px;
        border-bottom: 1px solid var(--border);
        vertical-align: top;
      }
      th {
        color: var(--muted);
        font-size: 11px;
        letter-spacing: 1px;
        text-transform: uppercase;
        font-weight: 700;
      }
      tr:last-child td {
        border-bottom: 0;
      }
      code {
        background: var(--surface-2);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 1px 6px;
        font-size: 13px;
      }
      pre {
        background: var(--surface-2);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 12px 14px;
        overflow-x: auto;
        font-size: 12.5px;
        margin: 8px 0 0;
      }
      ul {
        margin: 0;
        padding-left: 20px;
      }
      li {
        margin-bottom: 7px;
      }
      p {
        margin: 0 0 10px;
      }
      .pass {
        color: var(--ok);
        font-weight: 700;
      }
      .fail {
        color: var(--danger);
        font-weight: 700;
      }
      .note {
        color: var(--warn);
        font-weight: 700;
      }
      .dim {
        color: var(--dim);
      }
      .pill {
        display: inline-block;
        background: var(--accent);
        color: var(--accent-ink);
        border-radius: 999px;
        padding: 2px 10px;
        font-size: 11px;
        font-weight: 800;
      }`

function main(): void {
  const argv = process.argv.slice(2)
  let slugArg: string | null = null
  let testsArg: string | null = null

  for (const arg of argv) {
    if (arg.startsWith('--slug=')) {
      slugArg = arg.slice('--slug='.length)
    } else if (arg.startsWith('--tests=')) {
      testsArg = arg.slice('--tests='.length)
    } else if (!arg.startsWith('--')) {
      slugArg = arg
    }
  }

  let root: string
  try {
    root = git(['rev-parse', '--show-toplevel']).trim()
  } catch {
    fail('not inside a git repository.')
  }

  const reportsDir = join(root, 'reports')
  const draftPath = join(reportsDir, '.draft.md')

  if (!existsSync(draftPath)) {
    fail(
      'reports/.draft.md is missing. Write the draft first: front matter with title and slug, then the four headings What this commit does, Improvements, Fallbacks, Things to consider.',
    )
  }

  const nameStatus = git(['diff', '--cached', '--name-status']).trim()
  if (nameStatus === '') {
    fail('nothing is staged. Stage the change with git add, then run the report again.')
  }

  const stat = git(['diff', '--cached', '--stat']).trim()
  let branch = 'detached'
  try {
    branch = git(['symbolic-ref', '--short', '-q', 'HEAD']).trim() || branch
  } catch {
    branch = 'detached'
  }

  const draft = parseDraft(readFileSync(draftPath, 'utf8'))

  const missing = SECTION_TITLES.filter(
    (title) => title !== 'Evidence' && !draft.sections.has(title),
  )
  if (missing.length > 0) {
    fail(`reports/.draft.md is missing these headings: ${missing.join(', ')}.`)
  }

  const title = draft.meta.get('title') ?? 'Commit report'
  const slugSource = slugArg ?? draft.meta.get('slug') ?? title
  const slug = slugify(slugSource)
  if (slug === '') {
    fail('the slug is empty. Pass --slug=<name> or add a slug line to the draft front matter.')
  }

  const date = today()
  const subtitle = draft.meta.get('subtitle')
  const scope = draft.meta.get('scope')

  const coverage = readCoverage(root)
  const tests = readTestCounts(root, testsArg)

  const evidenceDraft = draft.sections.get('Evidence') ?? []
  const evidenceParts: string[] = []
  const evidenceProse = renderMarkdown(evidenceDraft)
  if (evidenceProse.trim() !== '') {
    evidenceParts.push(evidenceProse)
  }
  evidenceParts.push('        <p class="label" style="margin-top: 18px">Test counts</p>')
  evidenceParts.push(renderTests(tests.counts, tests.note))
  evidenceParts.push('        <p class="label" style="margin-top: 18px">Coverage</p>')
  evidenceParts.push(renderCoverage(coverage.rows, coverage.note))
  if (coverage.note !== null && coverage.rows.length > 0) {
    evidenceParts.push(`        <p class="note">${inline(coverage.note)}</p>`)
  }
  evidenceParts.push('        <p class="label" style="margin-top: 18px">Changed files</p>')
  evidenceParts.push(`        <pre>${escapeHtml(nameStatus)}</pre>`)
  evidenceParts.push('        <p class="label" style="margin-top: 18px">Diff stat</p>')
  evidenceParts.push(`        <pre>${escapeHtml(stat)}</pre>`)

  const subParts: string[] = []
  if (subtitle !== undefined && subtitle !== '') {
    subParts.push(`<span class="pill">${escapeHtml(subtitle)}</span> &nbsp;`)
  }
  subParts.push(`${date} &nbsp;·&nbsp; branch <code>${escapeHtml(branch)}</code>`)
  if (scope !== undefined && scope !== '') {
    subParts.push(` &nbsp;·&nbsp; scope <code>${escapeHtml(scope)}</code>`)
  }

  const html = [
    '<!doctype html>',
    '<html lang="en">',
    '  <head>',
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `    <title>Commit report — ${escapeHtml(title)}</title>`,
    '    <style>',
    STYLE,
    '    </style>',
    '  </head>',
    '  <body>',
    '    <main>',
    `      <h1>${escapeHtml(title)}</h1>`,
    `      <p class="sub">${subParts.join('')}</p>`,
    '',
    section(
      'What this commit does',
      renderMarkdown(draft.sections.get('What this commit does') ?? []),
    ),
    '',
    section('Improvements', renderMarkdown(draft.sections.get('Improvements') ?? [])),
    '',
    section('Fallbacks', renderMarkdown(draft.sections.get('Fallbacks') ?? [])),
    '',
    section('Things to consider', renderMarkdown(draft.sections.get('Things to consider') ?? [])),
    '',
    section('Evidence', evidenceParts.join('\n')),
    '    </main>',
    '  </body>',
    '</html>',
    '',
  ].join('\n')

  mkdirSync(reportsDir, { recursive: true })
  const reportPath = join(reportsDir, `${date}-${slug}.html`)
  writeFileSync(reportPath, html, 'utf8')

  const digest = createHash('sha256')
    .update(gitBytes(['diff', '--cached']))
    .digest('hex')
  writeFileSync(join(reportsDir, '.last-report-hash'), `${digest}\n`, 'utf8')

  process.stdout.write(`report:   ${relative(root, reportPath)}\n`)
  process.stdout.write(`hash:     ${digest}\n`)
  if (tests.note !== null) {
    process.stdout.write(`warning:  ${tests.note}\n`)
  }
  if (coverage.note !== null) {
    process.stdout.write(`warning:  ${coverage.note}\n`)
  }
  process.stdout.write(
    'The gate is open for exactly this staged diff. Restage and it goes stale.\n',
  )
}

main()
