import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main'
const CACHE = join(tmpdir(), 'free-exercise-db-exercises.json')

function words(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
}

function score(query, name) {
  const a = new Set(words(query))
  const b = new Set(words(name))
  if ([...a].join(' ') === [...b].join(' ')) return 2
  const shared = [...a].filter((word) => b.has(word)).length
  return shared / new Set([...a, ...b]).size
}

async function load() {
  if (existsSync(CACHE)) return JSON.parse(readFileSync(CACHE, 'utf8'))
  const response = await fetch(`${BASE}/dist/exercises.json`)
  if (!response.ok) throw new Error(`Free Exercise DB answered ${String(response.status)}`)
  const text = await response.text()
  writeFileSync(CACHE, text)
  return JSON.parse(text)
}

const name = process.argv.slice(2).join(' ').trim()
if (name === '') {
  console.error('usage: node fedb-match.mjs <exercise name>')
  process.exit(1)
}

try {
  const entries = await load()
  const ranked = entries
    .map((entry) => ({ entry, score: score(name, entry.name) }))
    .filter((row) => row.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, 5)
  if (ranked.length === 0) {
    console.log(`fedb-match: no entry shares a word with "${name}"`)
  }
  for (const { entry, score: value } of ranked) {
    console.log(
      JSON.stringify({
        score: Number(value.toFixed(2)),
        id: entry.id,
        name: entry.name,
        equipment: entry.equipment,
        primary: entry.primaryMuscles,
        secondary: entry.secondaryMuscles,
        frames: entry.images.map((image) => `${BASE}/exercises/${image}`),
      }),
    )
  }
} catch (error) {
  console.error(`fedb-match: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
