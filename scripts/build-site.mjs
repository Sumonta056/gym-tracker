import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(process.argv[2] ?? join(ROOT, '_site'))
const SITE = join(ROOT, 'site')
const PRIVATE_IMAGE_DIRS = (
  process.env.SITE_GUARD_DIRS ?? 'docs/data/coach-images,public/exercises'
)
  .split(',')
  .map((dir) => join(ROOT, dir.trim()))

function fail(message) {
  console.error(`build-site: ${message}`)
  process.exit(1)
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

function guard() {
  const privateFiles = PRIVATE_IMAGE_DIRS.filter((dir) => existsSync(dir)).flatMap(walk)
  if (privateFiles.length === 0) fail('the guard found no private images to compare')
  const needles = privateFiles.map((path) => {
    const bytes = readFileSync(path)
    return { path, bytes, base64: Buffer.from(bytes.toString('base64')) }
  })
  const leaks = []
  for (const file of walk(OUT)) {
    const body = readFileSync(file)
    for (const needle of needles) {
      if (body.includes(needle.bytes) || body.includes(needle.base64)) {
        leaks.push(`${relative(OUT, file)} holds ${relative(ROOT, needle.path)}`)
      }
    }
  }
  if (leaks.length > 0) fail(`private coach images in the output:\n  ${leaks.join('\n  ')}`)
  return needles.length
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
cpSync(SITE, OUT, { recursive: true })
const checked = guard()
console.log(`Guard passed against ${checked} private images`)
console.log(`Built ${relative(ROOT, OUT) || OUT}`)
