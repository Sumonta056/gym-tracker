import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import sharp from 'sharp'

const ROOT = resolve(import.meta.dirname, '../../../..')
const TARGET_DIR = join(ROOT, 'docs/data/coach-images')
const MAX_BYTES = 5 * 1024 * 1024
const IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'avif', 'tiff', 'heif'])
const SIDES = new Set(['start', 'end'])
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

function fail(message) {
  console.error(`fetch-source: ${message}`)
  process.exit(1)
}

function tooLarge(size) {
  return `the source is ${String(size)} bytes, more than the 5 MB limit`
}

async function fromLink(link) {
  const response = await fetch(link)
  if (!response.url.startsWith('https://')) {
    throw new Error(`the link moved to ${response.url}, which is not https`)
  }
  if (!response.ok) {
    throw new Error(`the link answered ${String(response.status)}`)
  }
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > MAX_BYTES) throw new Error(tooLarge(declared))
  const type = response.headers.get('content-type') ?? ''
  if (!type.startsWith('image/')) {
    throw new Error(`the link is ${type || 'of no content type'}, not an image`)
  }
  return Buffer.from(await response.arrayBuffer())
}

function fromFile(path) {
  const size = statSync(path).size
  if (size > MAX_BYTES) throw new Error(tooLarge(size))
  return readFileSync(path)
}

async function readSource(source) {
  if (source.startsWith('https://')) return fromLink(source)
  if (/^[a-z][a-z0-9+.-]*:/i.test(source)) {
    throw new Error('a link must start with https://')
  }
  return fromFile(source)
}

async function run(source, slug, side, checkOnly) {
  if (!SLUG.test(slug)) throw new Error(`the slug ${slug} is not lower case words joined by a dash`)
  if (!SIDES.has(side)) throw new Error(`the side must be start or end, not ${side}`)
  const input = await readSource(source)
  if (input.length > MAX_BYTES) throw new Error(tooLarge(input.length))
  const metadata = await sharp(input)
    .metadata()
    .catch(() => {
      throw new Error('the source is not an image')
    })
  if (!IMAGE_FORMATS.has(metadata.format)) {
    throw new Error(`the source is ${String(metadata.format)}, not an image`)
  }
  const summary = `${metadata.format} ${String(metadata.width)} x ${String(metadata.height)}, ${String(input.length)} bytes`
  const target = join(TARGET_DIR, `${slug}-${side}.jpg`)
  if (checkOnly) return `ok: ${summary}`
  if (!source.startsWith('https://') && resolve(source) === target) {
    return `in place: ${target} (${summary}), nothing written`
  }
  mkdirSync(TARGET_DIR, { recursive: true })
  const jpeg =
    metadata.format === 'jpeg'
      ? input
      : await sharp(input).rotate().jpeg({ quality: 90 }).toBuffer()
  writeFileSync(target, jpeg)
  return `wrote ${target} (from ${summary})`
}

const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const positional = args.filter((arg) => arg !== '--check')

if (positional.length !== 3) {
  fail('usage: node fetch-source.mjs <https link or local file> <slug> <start|end> [--check]')
}

try {
  console.log(await run(positional[0], positional[1], positional[2], checkOnly))
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}
