import { mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import sharp from 'sharp'

const WIDTH = 420
const HEIGHT = 280
const QUALITY = 80
const MAX_BYTES = 5 * 1024 * 1024
const IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'avif', 'tiff', 'heif'])
const SIDES = new Set(['start', 'end'])
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const SOURCE_DIR = resolve('docs/data/coach-images')
const OUT_DIR = resolve('public/exercises')

function fail(message) {
  console.error(`exercise-image: ${message}`)
  process.exit(1)
}

function tooLarge(size) {
  return `the source is ${String(size)} bytes, more than the 5 MB limit`
}

async function fromLink(link) {
  const response = await fetch(link)
  if (!response.ok) {
    throw new Error(`the link answered ${String(response.status)}`)
  }
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > MAX_BYTES) {
    throw new Error(tooLarge(declared))
  }
  const type = response.headers.get('content-type') ?? ''
  if (!type.startsWith('image/')) {
    throw new Error(`the link is ${type || 'of no content type'}, not an image`)
  }
  return Buffer.from(await response.arrayBuffer())
}

function fromDataUrl(value) {
  const match = /^data:image\/[a-z0-9.+-]+;base64,(.*)$/is.exec(value)
  if (match === null) {
    throw new Error('a data value must be data:image/<type>;base64,<data>')
  }
  return Buffer.from(match[1], 'base64')
}

function fromFile(path) {
  const size = statSync(path).size
  if (size > MAX_BYTES) {
    throw new Error(tooLarge(size))
  }
  return readFileSync(path)
}

async function readSource(source) {
  if (source.startsWith('https://')) return fromLink(source)
  if (source.startsWith('data:')) return fromDataUrl(source)
  if (/^[a-z]+:\/\//i.test(source)) {
    throw new Error('a link must start with https://')
  }
  return fromFile(source)
}

async function convert(source, slug, side) {
  if (!SLUG.test(slug)) {
    throw new Error(`the slug ${slug} is not lower case words joined by a dash`)
  }
  if (!SIDES.has(side)) {
    throw new Error(`the side must be start or end, not ${side}`)
  }
  const input = await readSource(source)
  if (input.length > MAX_BYTES) {
    throw new Error(tooLarge(input.length))
  }
  const metadata = await sharp(input)
    .metadata()
    .catch(() => {
      throw new Error('the source is not an image')
    })
  if (!IMAGE_FORMATS.has(metadata.format)) {
    throw new Error(`the source is ${String(metadata.format)}, not an image`)
  }
  mkdirSync(OUT_DIR, { recursive: true })
  const out = join(OUT_DIR, `${slug}-${side}.webp`)
  await sharp(input)
    .rotate()
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre', withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(out)
  return out
}

async function convertAll() {
  const files = readdirSync(SOURCE_DIR)
    .filter((file) => file.endsWith('.jpg'))
    .sort()
  for (const file of files) {
    const match = /^(.+)-(start|end)\.jpg$/.exec(file)
    if (match === null) {
      throw new Error(`${file} is not named <slug>-<start|end>.jpg`)
    }
    console.log(await convert(join(SOURCE_DIR, file), match[1], match[2]))
  }
  console.log(`exercise-image: ${String(files.length)} files written`)
}

const args = process.argv.slice(2)

try {
  if (args.length === 1 && args[0] === '--all') {
    await convertAll()
  } else if (args.length === 3) {
    console.log(await convert(args[0], args[1], args[2]))
  } else {
    fail(
      'usage: node scripts/exercise-image.mjs <source> <slug> <start|end>, or node scripts/exercise-image.mjs --all',
    )
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}
