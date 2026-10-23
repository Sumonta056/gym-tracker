import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { chromium } from '@playwright/test'
import { createServerClient } from '@supabase/ssr'

import {
  buildSample,
  IMPORT_SHEET,
  LIVE_LIFTS,
  loadSchemas,
  PLAN_DONE_REPS,
  PLAN_DONE_STEPS,
  SAMPLE_STORES,
  sampleClock,
} from './site-sample-data.mjs'

const ROOT = resolve(import.meta.dirname, '..')
const OUT_DIR = join(ROOT, 'site/screenshots')
const FEDB_DIR = join(ROOT, 'docs/data/fedb-images')
const PORT = 3100
const HOST = '127.0.0.1'
const BASE_URL = `http://${HOST}:${String(PORT)}`
const SCALE = 2
const MAX_BYTES = 400 * 1024
const SETTLE_MS = 1200
const SERVER_WAIT_MS = 180000
const CONTENT_WAIT_MS = 60000
const PLACEHOLDER_EMAIL = 'you@example.com'
const EXERCISE_IMAGE = /\/exercises\/([a-z0-9]+(?:-[a-z0-9]+)*)-(start|end)\.webp(?:\?.*)?$/
const ANY_EXERCISE_FILE = /\/exercises\//
const CHIP_ROUTES = new Set(['/', '/analytics', '/workouts', '/profile'])
const COACH_WIDTH = 420
const EMPTY_STATE =
  /Nothing logged|Log a weight|Log a day to|Log the calories|Log your steps|Log your walk|Log an average|Log gym time with|Log one more|Log the gym time and|Finish a set|Finish a session or|No sets logged|No volume last week|No finished session|No videos yet/
const FRAME_INDEX = { start: 0, end: 1 }

const VIEWPORTS = {
  1440: { viewport: { width: 1440, height: 900 }, outWidth: 1800 },
  390: { viewport: { width: 390, height: 844 }, outWidth: 780 },
}

const SHOTS = [
  { name: 'today-390', route: '/', width: 390, seed: true },
  { name: 'today-1440', route: '/', width: 1440, seed: true },
  { name: 'day-picker-390', route: '/', width: 390, seed: true, act: 'dayPicker' },
  { name: 'day-picker-1440', route: '/', width: 1440, seed: true, act: 'dayPicker' },
  { name: 'log-390', route: '/log', width: 390, seed: true },
  { name: 'log-1440', route: '/log', width: 1440, seed: true },
  { name: 'analytics-390', route: '/analytics', width: 390, seed: true },
  { name: 'analytics-1440', route: '/analytics', width: 1440, seed: true },
  { name: 'workout-live-390', route: '/workouts', width: 390, act: 'liveSession' },
  { name: 'workout-live-1440', route: '/workouts', width: 1440, act: 'liveSession' },
  { name: 'workouts-390', route: '/workouts', width: 390, seed: true },
  { name: 'workouts-1440', route: '/workouts', width: 1440, seed: true },
  { name: 'plan-step-390', route: '/workouts', width: 390, act: 'planStep' },
  { name: 'plan-step-1440', route: '/workouts', width: 1440, act: 'planStep' },
  { name: 'plan-muscles-390', route: '/workouts', width: 390, act: 'planMuscles' },
  { name: 'plan-muscles-1440', route: '/workouts', width: 1440, act: 'planMuscles' },
  { name: 'plan-done-390', route: '/workouts', width: 390, act: 'planDone' },
  { name: 'plan-done-1440', route: '/workouts', width: 1440, act: 'planDone' },
  { name: 'saved-390', route: '/saved', width: 390, seed: true },
  { name: 'saved-1440', route: '/saved', width: 1440, seed: true },
  { name: 'import-390', route: '/profile', width: 390, act: 'importReview' },
  { name: 'import-1440', route: '/profile', width: 1440, act: 'importReview' },
  { name: 'profile-390', route: '/profile', width: 390 },
  { name: 'profile-1440', route: '/profile', width: 1440 },
]

const CLOCK_ACTS = new Set(['liveSession', 'planDone'])
const IMAGE_ACTS = new Set(['planStep'])

const HELP = `Capture the marketing screenshots of the real app into site/screenshots/.

Usage:
  pnpm site:shots [--only <name>[,<name>...]] [--build]

Options:
  --only <names>  Capture only these shots, by name without .png. Repeat or comma separate.
  --build         Run pnpm build with NEXT_PUBLIC_ENABLE_CSV_IMPORT=1 before the capture.
                  Without it the current .next build is used; the import shots need the flag.
  --help          Show this help.

Shots: ${SHOTS.map((shot) => shot.name).join(', ')}

How it runs:
  1. Loads .env.test.local and .env.local: E2E_EMAIL, E2E_PASSWORD,
     NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY.
  2. Reuses a server already answering on ${BASE_URL}. Otherwise it starts
     "next start --port ${String(PORT)}" on the current build and stops it at the end.
     Stop any "next dev" before you build: a shared .next breaks the build.
  3. Signs the test account in with its password and opens a fresh browser context
     per shot, with service workers blocked and reduced motion.
  4. Aborts every Supabase REST request that is not a GET, so the run never writes
     to the server. The plan session it starts stays on that browser only.
  5. Serves every /exercises/<slug>-start|end.webp from docs/data/fedb-images/
     <slug>-0|1.jpg (public domain). The coach images never reach a screenshot.
     The run fails if any image under /exercises/ escapes that route.
  6. The shots marked seed run with the browser clock fixed on the last Friday at 18:00,
     so every run shows the same week shape. Before them, the script writes the sample
     rows of scripts/site-sample-data.mjs into this browser's IndexedDB only, after the
     first pull, with no outbox entry. Every row is parsed through its zod schema first.
     The live session and plan done shots start the clock at the same time and move it
     forward, then log their sets in the browser; their pushes are aborted and counted.
     The import shots load IMPORT_SHEET and stop on the review screen; nothing is applied.
  7. Replaces the account email on the profile with ${PLACEHOLDER_EMAIL}.
  8. Shrinks each PNG to ${String(VIEWPORTS[1440].outWidth)} px (desktop) or ${String(VIEWPORTS[390].outWidth)} px (phone) wide with a
     256 colour palette, through the sharp that next ships, and warns above ${String(MAX_BYTES / 1024)} KB.`

function fail(message) {
  throw new Error(message)
}

function loadEnv() {
  for (const file of ['.env.test.local', '.env.local']) {
    const path = join(ROOT, file)
    if (existsSync(path)) {
      process.loadEnvFile(path)
    }
  }
  const env = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    email: process.env.E2E_EMAIL,
    password: process.env.E2E_PASSWORD,
  }
  for (const [key, value] of Object.entries(env)) {
    if (!value) {
      fail(
        `missing ${key}. Put the Supabase keys in .env.local and E2E_EMAIL, E2E_PASSWORD in .env.test.local.`,
      )
    }
  }
  return env
}

function pickShots(only) {
  const names = only
    .flatMap((value) => value.split(','))
    .map((value) => value.trim().replace(/\.png$/, ''))
  if (names.length === 0) {
    return SHOTS
  }
  const unknown = names.filter((name) => !SHOTS.some((shot) => shot.name === name))
  if (unknown.length > 0) {
    fail(`unknown shot ${unknown.join(', ')}. Known: ${SHOTS.map((shot) => shot.name).join(', ')}`)
  }
  return SHOTS.filter((shot) => names.includes(shot.name))
}

function run(command, args, env = {}) {
  return new Promise((done, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, ...env },
    })
    child.on('exit', (code) => {
      if (code === 0) {
        done()
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with ${String(code)}`))
      }
    })
  })
}

async function answers() {
  try {
    const response = await fetch(BASE_URL, { redirect: 'manual' })
    return response.status > 0
  } catch {
    return false
  }
}

async function startServer() {
  if (await answers()) {
    console.log(`Reusing the server on ${BASE_URL}.`)
    return null
  }
  if (!existsSync(join(ROOT, '.next/BUILD_ID'))) {
    fail('no build in .next. Run pnpm build first, or pass --build.')
  }
  console.log(`Starting next start on port ${String(PORT)}.`)
  const server = spawn(
    process.execPath,
    [join(ROOT, 'node_modules/next/dist/bin/next'), 'start', '--port', String(PORT)],
    { cwd: ROOT, stdio: 'ignore', detached: true },
  )
  const deadline = Date.now() + SERVER_WAIT_MS
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      fail(`next start exited with ${String(server.exitCode)}`)
    }
    if (await answers()) {
      return server
    }
    await new Promise((done) => setTimeout(done, 500))
  }
  stopServer(server)
  fail(`the server did not answer on ${BASE_URL} within ${String(SERVER_WAIT_MS / 1000)} s`)
}

function stopServer(server) {
  if (server === null || server.exitCode !== null) {
    return
  }
  try {
    process.kill(-server.pid, 'SIGTERM')
  } catch {
    server.kill('SIGTERM')
  }
}

async function signIn(env) {
  const jar = new Map()
  const client = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return [...jar].map(([name, value]) => ({ name, value }))
      },
      setAll(cookies) {
        for (const { name, value } of cookies) {
          if (value === '') {
            jar.delete(name)
          } else {
            jar.set(name, value)
          }
        }
      },
    },
  })
  let error = null
  for (const wait of [0, 1000, 3000, 6000]) {
    await new Promise((done) => setTimeout(done, wait))
    ;({ error } = await client.auth.signInWithPassword({
      email: env.email,
      password: env.password,
    }))
    if (error === null) break
  }
  if (error !== null) {
    fail(`the test account could not sign in: ${error.message}`)
  }
  if (jar.size === 0) {
    fail('the sign in returned no session cookie')
  }
  const expires = Math.floor(Date.now() / 1000) + 86400
  return [...jar].map(([name, value]) => ({
    name,
    value,
    domain: HOST,
    path: '/',
    expires,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
  }))
}

async function newContext(browser, env, cookies, width) {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: VIEWPORTS[width].viewport,
    deviceScaleFactor: SCALE,
    isMobile: width === 390,
    hasTouch: width === 390,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    locale: 'en-GB',
  })
  context.setDefaultNavigationTimeout(CONTENT_WAIT_MS)
  await context.addCookies(cookies)

  const rest = new URL('/rest/v1/', env.url).href
  const blocked = []
  await context.route(
    (url) => url.href.startsWith(rest),
    async (route) => {
      const method = route.request().method()
      if (method === 'GET' || method === 'HEAD') {
        await route.fallback()
        return
      }
      blocked.push(`${method} ${new URL(route.request().url()).pathname}`)
      await route.abort('internetdisconnected')
    },
  )

  const served = new Set()
  const escaped = []
  await context.route(ANY_EXERCISE_FILE, async (route) => {
    const url = route.request().url()
    const match = EXERCISE_IMAGE.exec(new URL(url).pathname)
    const file =
      match === null ? null : join(FEDB_DIR, `${match[1]}-${String(FRAME_INDEX[match[2]])}.jpg`)
    if (file === null || !existsSync(file)) {
      escaped.push(url)
      await route.abort('blockedbyclient')
      return
    }
    served.add(new URL(url).pathname)
    await route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      headers: { 'cache-control': 'no-store' },
      body: readFileSync(file),
    })
  })

  return { context, blocked, served, escaped }
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: CONTENT_WAIT_MS }).catch(() => undefined)
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.waitForFunction(
    () =>
      [...document.images].every((image) => {
        const box = image.getBoundingClientRect()
        const onScreen = box.bottom > 0 && box.top < innerHeight && box.width > 0
        return !onScreen || image.complete
      }),
    undefined,
    { timeout: CONTENT_WAIT_MS },
  )
  await page.waitForTimeout(SETTLE_MS)
}

async function waitForSynced(page) {
  await page
    .getByRole('status')
    .filter({ hasText: /^Synced$/ })
    .filter({ visible: true })
    .first()
    .waitFor({ timeout: CONTENT_WAIT_MS })
}

async function waitForTransition(page) {
  await page.waitForFunction(
    () => {
      const element = document.querySelector('[data-testid="page-transition"]')
      if (element === null) return true
      const transform = getComputedStyle(element).transform
      return transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)'
    },
    undefined,
    { timeout: CONTENT_WAIT_MS },
  )
}

async function openRoute(page, route) {
  await page.goto(route)
  if (route === '/') {
    await page.getByTestId('dashboard-grid').waitFor({ timeout: CONTENT_WAIT_MS })
  } else if (route === '/analytics') {
    await page.getByTestId('stats-grid').waitFor({ timeout: CONTENT_WAIT_MS })
  } else if (route === '/log') {
    await page.getByRole('button', { name: 'Save entry' }).waitFor({ timeout: CONTENT_WAIT_MS })
  } else if (route === '/workouts') {
    await page.getByRole('region', { name: 'History' }).waitFor({ timeout: CONTENT_WAIT_MS })
  } else if (route === '/saved') {
    await page
      .getByRole('heading', { level: 1, name: 'Saved' })
      .waitFor({ timeout: CONTENT_WAIT_MS })
  } else if (route === '/profile') {
    await page.getByRole('button', { name: 'Sign out' }).waitFor({ timeout: CONTENT_WAIT_MS })
  }
  if (CHIP_ROUTES.has(route)) {
    await waitForSynced(page)
  }
}

async function openPlanStep(page) {
  await page.getByRole('button', { name: /^Start Chest \+ Triceps/ }).click()
  await page.waitForURL(/\/workout$/, { timeout: CONTENT_WAIT_MS })
  await page
    .getByRole('heading', { level: 1, name: 'Incline Dumbbell Press' })
    .waitFor({ timeout: CONTENT_WAIT_MS })
  await page
    .locator('figure img')
    .filter({ visible: true })
    .first()
    .waitFor({ timeout: CONTENT_WAIT_MS })
  await waitForTransition(page)
}

async function openDayPicker(page) {
  await page
    .getByRole('button', { name: /^Previous day,/ })
    .filter({ visible: true })
    .first()
    .click()
  await page
    .getByRole('link', { name: 'Edit this day' })
    .filter({ visible: true })
    .first()
    .waitFor({ timeout: CONTENT_WAIT_MS })
}

async function addLiveLift(page, lift) {
  await page.getByRole('button', { name: 'Add exercise' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Pick an exercise' })
  await dialog.getByRole('searchbox', { name: 'Search exercises' }).fill(lift.name)
  await dialog
    .getByRole('button', { name: new RegExp(`^${lift.name}`) })
    .first()
    .click()
  const card = page.getByRole('region', { name: lift.name })
  await card.waitFor({ timeout: CONTENT_WAIT_MS })
  for (const [index, set] of lift.sets.entries()) {
    await card.getByRole('textbox', { name: 'Reps', exact: true }).fill(String(set.reps))
    await card.getByRole('textbox', { name: /^Load/ }).fill(String(set.kg))
    await card.getByRole('button', { name: `Add set to ${lift.name}` }).click()
    await card.getByRole('listitem').nth(index).waitFor({ timeout: CONTENT_WAIT_MS })
  }
}

async function runLiveSession(page) {
  await page.getByRole('button', { name: 'Start a session' }).click()
  await page
    .getByRole('heading', { level: 1, name: 'Session' })
    .waitFor({ timeout: CONTENT_WAIT_MS })
  for (const [index, lift] of LIVE_LIFTS.entries()) {
    if (index === LIVE_LIFTS.length - 1) {
      await page.clock.fastForward('24:00')
    }
    await addLiveLift(page, lift)
  }
  await page.getByRole('region', { name: 'Rest timer' }).waitFor({ timeout: CONTENT_WAIT_MS })
  await page.evaluate(() => {
    scrollTo(0, 0)
  })
}

async function openPlanMuscles(page) {
  await openPlanStep(page)
  const muscles = page.getByRole('button', { name: 'Muscles' })
  await muscles.click()
  await page.waitForFunction(
    () =>
      document.querySelector('figure[data-view="muscles"]') !== null &&
      [...document.querySelectorAll('button')].some(
        (button) =>
          button.textContent === 'Muscles' && button.getAttribute('aria-pressed') === 'true',
      ),
    undefined,
    { timeout: CONTENT_WAIT_MS },
  )
}

async function logPlanSet(page, step, position, reps) {
  const weight = page.getByRole('combobox', { name: `Set ${String(position)} weight` })
  const count = await weight.locator('option').count()
  await weight.selectOption({
    index: Math.max(1, Math.min(count - 2, 2 + step + (position === 1 ? 0 : 1))),
  })
  await page.getByLabel(`Set ${String(position)} reps`).fill(String(reps))
  await page.getByRole('button', { name: `Set ${String(position)} done` }).click()
  await page
    .getByRole('button', { name: `Set ${String(position)} done` })
    .and(page.locator('[aria-pressed="true"]'))
    .waitFor({ timeout: CONTENT_WAIT_MS })
}

async function finishPlan(page) {
  await openPlanStep(page)
  for (let step = 1; step <= PLAN_DONE_STEPS; step += 1) {
    for (const [index, reps] of PLAN_DONE_REPS.entries()) {
      await logPlanSet(page, step, index + 1, reps)
    }
    await page.clock.fastForward('09:00')
    if (step < PLAN_DONE_STEPS) {
      await page
        .getByRole('button', { name: /^Next step/ })
        .filter({ visible: true })
        .first()
        .click()
      await page
        .getByRole('combobox', { name: 'Set 1 weight' })
        .and(page.locator(':not([disabled])'))
        .waitFor({ timeout: CONTENT_WAIT_MS })
      await waitForTransition(page)
    }
  }
  await page.getByRole('button', { name: 'Finish', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Finish the session?' })
    .getByRole('button', { name: 'Finish anyway' })
    .click()
  await page
    .getByRole('heading', { level: 1, name: 'Session done' })
    .waitFor({ timeout: CONTENT_WAIT_MS })
  await waitForTransition(page)
}

async function openImportReview(page, clockNow) {
  const open = page.getByRole('button', { name: 'Import the old sheet' })
  if ((await open.count()) === 0) {
    fail(
      'the CSV import is off in this build. Run with --build, which sets NEXT_PUBLIC_ENABLE_CSV_IMPORT=1.',
    )
  }
  await open.click()
  await page.getByLabel('Year of the sheet').fill(String(clockNow.getFullYear()))
  await page.getByLabel('The sheet as a CSV file').setInputFiles({
    name: 'gym-sheet.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(IMPORT_SHEET),
  })
  await page
    .getByRole('heading', { level: 1, name: 'Import review' })
    .waitFor({ timeout: CONTENT_WAIT_MS })
  await waitForTransition(page)
}

const ACTS = {
  dayPicker: (page) => openDayPicker(page),
  liveSession: (page) => runLiveSession(page),
  planStep: (page) => openPlanStep(page),
  planMuscles: (page) => openPlanMuscles(page),
  planDone: (page) => finishPlan(page),
  importReview: (page) => openImportReview(page, new Date()),
}

async function maskEmail(page, email) {
  await page.evaluate(
    ({ from, to }) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        if (node.nodeValue?.includes(from)) {
          node.nodeValue = node.nodeValue.replaceAll(from, to)
        }
      }
    },
    { from: email, to: PLACEHOLDER_EMAIL },
  )
  const left = await page.evaluate((from) => document.body.innerText.includes(from), email)
  if (left) {
    fail('the account email is still on the profile page')
  }
}

async function imageReport(page) {
  return page.evaluate(() =>
    [...document.images].map((image) => {
      const box = image.getBoundingClientRect()
      const style = getComputedStyle(image)
      const visible =
        box.width > 0 &&
        box.height > 0 &&
        box.bottom > 0 &&
        box.top < innerHeight &&
        style.visibility !== 'hidden' &&
        Number(style.opacity) > 0
      return {
        src: new URL(image.currentSrc || image.src, location.href).pathname,
        visible,
        naturalWidth: image.naturalWidth,
      }
    }),
  )
}

function proveImages(shot, images, served, escaped, needImage) {
  if (escaped.length > 0) {
    fail(`${shot.name}: an exercise image escaped the public domain route: ${escaped.join(', ')}`)
  }
  const exercise = images.filter((image) => ANY_EXERCISE_FILE.test(image.src))
  const unserved = exercise.filter((image) => image.naturalWidth > 0 && !served.has(image.src))
  if (unserved.length > 0) {
    fail(
      `${shot.name}: these exercise images did not come through the route: ${unserved.map((image) => image.src).join(', ')}`,
    )
  }
  const coach = exercise.filter((image) => image.naturalWidth === COACH_WIDTH)
  if (coach.length > 0) {
    fail(
      `${shot.name}: a coach image size is on the page: ${coach.map((image) => image.src).join(', ')}`,
    )
  }
  const visible = images.filter((image) => image.visible)
  if (needImage) {
    const strays = visible.filter((image) => !ANY_EXERCISE_FILE.test(image.src))
    if (strays.length > 0) {
      fail(
        `${shot.name}: a visible image is not an exercise image: ${strays.map((image) => image.src).join(', ')}`,
      )
    }
    if (!visible.some((image) => ANY_EXERCISE_FILE.test(image.src))) {
      fail(`${shot.name}: no exercise image is visible`)
    }
  }
  return {
    visible: visible.filter((image) => ANY_EXERCISE_FILE.test(image.src)).map((image) => image.src),
    served: [...served],
  }
}

function loadSharp() {
  try {
    return createRequire(realpathSync(join(ROOT, 'node_modules/next/package.json')))('sharp')
  } catch {
    return fail('sharp is missing. It comes with next; run pnpm install.')
  }
}

async function shrink(raw, width, file) {
  const png = await loadSharp()(raw)
    .resize({ width: VIEWPORTS[width].outWidth })
    .png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 })
    .toBuffer()
  writeFileSync(file, png)
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20), bytes: png.length }
}

async function seedDevice(page, sample) {
  await openRoute(page, '/workouts')
  await settle(page)
  const missing = await page.evaluate(
    ({ stores, exerciseIds, rows }) =>
      new Promise((done, reject) => {
        const open = indexedDB.open('gym-tracker')
        open.onerror = () => {
          reject(new Error(String(open.error)))
        }
        open.onsuccess = () => {
          const database = open.result
          const absent = stores.filter((name) => !database.objectStoreNames.contains(name))
          if (absent.length > 0) {
            database.close()
            reject(new Error(`the device has no store ${absent.join(', ')}`))
            return
          }
          const read = database
            .transaction('exercises', 'readonly')
            .objectStore('exercises')
            .getAllKeys()
          read.onsuccess = () => {
            const known = new Set(read.result)
            const lost = exerciseIds.filter((id) => !known.has(id))
            if (lost.length > 0) {
              database.close()
              done(lost)
              return
            }
            const write = database.transaction(stores, 'readwrite')
            for (const name of stores) {
              for (const row of rows[name]) {
                write.objectStore(name).put(row)
              }
            }
            write.oncomplete = () => {
              database.close()
              done([])
            }
            write.onerror = () => {
              database.close()
              reject(new Error(String(write.error)))
            }
          }
        }
      }),
    { stores: SAMPLE_STORES, exerciseIds: sample.exerciseIds, rows: sample.stores },
  )
  if (missing.length > 0) {
    fail(`the device has no exercise ${missing.join(', ')}; the sample sets need it`)
  }
}

async function capture(browser, env, cookies, shot, sample) {
  const { context, blocked, served, escaped } = await newContext(browser, env, cookies, shot.width)
  try {
    if (shot.seed) {
      await context.clock.setFixedTime(sample.clock)
    } else if (CLOCK_ACTS.has(shot.act)) {
      await context.clock.install({ time: sample.clock })
    }
    const page = await context.newPage()
    if (shot.seed) {
      await seedDevice(page, sample)
    }
    await openRoute(page, shot.route)
    if (shot.act !== undefined) {
      await settle(page)
      await ACTS[shot.act](page)
    }
    await settle(page)
    await waitForTransition(page)
    if (shot.seed) {
      const empty = await page.evaluate(
        (pattern) => new RegExp(pattern).exec(document.body.innerText)?.[0] ?? null,
        EMPTY_STATE.source,
      )
      if (empty !== null) {
        fail(`${shot.name}: the page still shows an empty state: ${empty}`)
      }
    }
    if (shot.route === '/profile') {
      await maskEmail(page, env.email)
    }
    await page.mouse.move(0, 0)
    const images = await imageReport(page)
    const proof = proveImages(shot, images, served, escaped, IMAGE_ACTS.has(shot.act))
    const raw = await page.screenshot({ animations: 'disabled', caret: 'hide' })
    const size = await shrink(raw, shot.width, join(OUT_DIR, `${shot.name}.png`))
    return { ...size, proof, blocked }
  } finally {
    await context.close()
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      only: { type: 'string', multiple: true, default: [] },
      build: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  })
  if (values.help) {
    console.log(HELP)
    return
  }
  const shots = pickShots(values.only)
  const env = loadEnv()
  if (values.build) {
    await run('pnpm', ['build'], { NEXT_PUBLIC_ENABLE_CSV_IMPORT: '1' })
  }
  mkdirSync(OUT_DIR, { recursive: true })
  const server = await startServer()
  let browser = null
  try {
    browser = await chromium.launch()
    const cookies = await signIn(env)
    const clock = sampleClock()
    const sample = { ...buildSample(await loadSchemas(), clock), clock }
    let blockedTotal = 0
    for (const shot of shots) {
      let result
      try {
        result = await capture(browser, env, cookies, shot, sample)
      } catch (error) {
        console.warn(`${shot.name}: ${error.message.split('\n')[0]}. Retrying once.`)
        result = await capture(browser, env, cookies, shot, sample)
      }
      const kb = Math.round(result.bytes / 1024)
      const warn = result.bytes > MAX_BYTES ? ' (over the size budget)' : ''
      console.log(
        `${shot.name}.png ${String(result.width)}x${String(result.height)} ${String(kb)} KB${warn}`,
      )
      if (result.proof.served.length > 0) {
        console.log(`  exercise images served from fedb-images: ${result.proof.served.join(', ')}`)
        console.log(`  visible exercise images: ${result.proof.visible.join(', ') || 'none'}`)
      }
      blockedTotal += result.blocked.length
      if (result.blocked.length > 0) {
        console.log(`  writes blocked: ${result.blocked.join(', ')}`)
      }
    }
    console.log(`Supabase writes blocked in this run: ${String(blockedTotal)}`)
  } finally {
    await browser?.close()
    stopServer(server)
  }
}

try {
  await main()
} catch (error) {
  console.error(`site-screenshots: ${error.message}`)
  process.exit(1)
}
