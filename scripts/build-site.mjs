import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(process.argv[2] ?? join(ROOT, '_site'))
const SITE = join(ROOT, 'site')
const PROTOTYPE = join(ROOT, 'docs/design/prototype/index.html')
const EXERCISES = join(ROOT, 'docs/data/coach-exercises.json')
const PRIVATE_IMAGE_DIRS = (
  process.env.SITE_GUARD_DIRS ?? 'docs/data/coach-images,public/exercises'
)
  .split(',')
  .map((dir) => join(ROOT, dir.trim()))

function fail(message) {
  console.error(`build-site: ${message}`)
  process.exit(1)
}

function exerciseFrames() {
  const data = JSON.parse(readFileSync(EXERCISES, 'utf8'))
  const byName = new Map()
  for (const plan of data.plans) {
    for (const group of plan.groups) {
      for (const step of group.steps) {
        const [start, end] = step.freeExerciseDb.frames
        byName.set(step.name, { slug: step.slug, start, end })
      }
    }
  }
  return byName
}

function nameFor(alt, after, names) {
  const fromAlt = /^(.+), (start|end) position$/.exec(alt)
  if (fromAlt) return { name: fromAlt[1], frame: fromAlt[2] }
  const text = after
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const name = [...names.keys()]
    .sort((a, b) => b.length - a.length)
    .find((candidate) => text.startsWith(candidate))
  return name ? { name, frame: 'start' } : null
}

function buildDemo() {
  const names = exerciseFrames()
  const html = readFileSync(PROTOTYPE, 'utf8')
  const imgDir = join(OUT, 'demo/img')
  mkdirSync(imgDir, { recursive: true })
  const swaps = []
  const swapped = html.replace(
    /<img(\s+)src="data:image\/jpeg;base64,[A-Za-z0-9+/=]+"([^>]*)>/g,
    (tag, space, rest, offset) => {
      const alt = /alt="([^"]*)"/.exec(rest)?.[1] ?? ''
      const found = nameFor(alt, html.slice(offset + tag.length, offset + tag.length + 400), names)
      if (!found || !names.has(found.name))
        fail(`no exercise for embedded image ${swaps.length + 1}`)
      const entry = names.get(found.name)
      const source = found.frame === 'end' ? entry.end : entry.start
      const file = source.split('/').pop()
      cpSync(join(ROOT, source), join(imgDir, file))
      swaps.push(`${found.name} (${found.frame}) -> img/${file}`)
      return `<img${space}src="img/${file}"${rest}>`
    },
  )
  const page = swapped
    .replace('<head>', '<head>\n    <meta name="robots" content="noindex" />')
    .replace(
      /<title>[^<]*<\/title>/,
      '<title>Gym Tracker — live demo</title>\n    <link rel="icon" type="image/png" href="../icon-192.png" />',
    )
  writeFileSync(join(OUT, 'demo/index.html'), page)
  return swaps
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
    if (file.endsWith('.html') && body.includes('data:image/jpeg')) {
      leaks.push(`${relative(OUT, file)} still embeds a JPEG`)
    }
  }
  const publicDomain = join(ROOT, 'docs/data/fedb-images')
  for (const file of walk(join(OUT, 'demo/img'))) {
    const source = join(publicDomain, file.split('/').pop())
    if (!existsSync(source) || !readFileSync(source).equals(readFileSync(file))) {
      leaks.push(`${relative(OUT, file)} is not a Free Exercise DB photo`)
    }
  }
  if (leaks.length > 0) fail(`private coach images in the output:\n  ${leaks.join('\n  ')}`)
  return needles.length
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
cpSync(SITE, OUT, { recursive: true })
const swaps = buildDemo()
if (swaps.length === 0) fail('the prototype had no embedded image to swap')
const checked = guard()
console.log(`Swapped ${swaps.length} images:\n  ${swaps.join('\n  ')}`)
console.log(`Guard passed against ${checked} private images`)
console.log(`Built ${relative(ROOT, OUT) || OUT}`)
