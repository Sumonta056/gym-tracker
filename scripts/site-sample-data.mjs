import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { build } from 'esbuild'

const ROOT = resolve(import.meta.dirname, '..')
const BUNDLE = join(ROOT, 'node_modules/.cache/site-shots/schemas.mjs')
const DAYS = 28
const GYM_WEEKDAYS = new Set([1, 2, 4, 5])
const SESSION_PLANS = [
  'back-biceps',
  'shoulders',
  'legs',
  'chest-triceps',
  'chest-triceps',
  'back-biceps',
  'legs',
  'chest-triceps',
]
const ANCHOR_WEEKDAY = 5
const ANCHOR_HOUR = 18

const SCHEMA_ENTRY = `
export { dailyEntrySchema } from './lib/schema/dailyEntry'
export { storedWorkoutSessionSchema } from './lib/schema/workoutSession'
export { workoutSetSchema } from './lib/schema/workoutSet'
export { videoCategorySchema } from './lib/schema/videoCategory'
export { savedVideoSchema } from './lib/schema/savedVideo'
export { COACH_PLANS } from './lib/plans/coach'
`

export const SAMPLE_STORES = [
  'dailyEntries',
  'workoutSessions',
  'workoutSets',
  'videoCategories',
  'savedVideos',
]

export const PLAN_LIFTS = {
  'chest-triceps': [
    { name: 'Incline Dumbbell Press', kg: 24, reps: 10 },
    { name: 'Flat Dumbbell Press', kg: 26, reps: 10 },
    { name: 'Incline Dumbbell Fly', kg: 12, reps: 12 },
    { name: 'Dumbbell Overhead Extension', kg: 20, reps: 12 },
    { name: 'Rope Pushdown', kg: 25, reps: 12 },
  ],
  'back-biceps': [
    { name: 'Lat Pulldown', kg: 55, reps: 10 },
    { name: 'Seated Cable Row', kg: 50, reps: 10 },
    { name: 'One-Arm Dumbbell Row', kg: 28, reps: 10 },
    { name: 'Dumbbell Curl', kg: 12, reps: 12 },
    { name: 'Hammer Curl', kg: 14, reps: 10 },
  ],
  shoulders: [
    { name: 'Shoulder Press', kg: 40, reps: 10 },
    { name: 'Side Lateral Raise', kg: 8, reps: 15 },
    { name: 'Face Pull', kg: 20, reps: 15 },
    { name: 'Dumbbell Shrugs', kg: 30, reps: 12 },
  ],
  legs: [
    { name: 'Squat', kg: 80, reps: 8 },
    { name: 'Leg Curl', kg: 40, reps: 12 },
    { name: 'Leg Press', kg: 140, reps: 10 },
  ],
}

export const VIDEO_CATEGORIES = [
  { key: 'big-lifts', name: 'Big lifts', color: 'data-cyan' },
  { key: 'pull', name: 'Pull day', color: 'data-violet' },
  { key: 'shoulders', name: 'Shoulders', color: 'data-blue' },
]

export const LIVE_LIFTS = [
  {
    name: 'Bench Press',
    sets: [
      { reps: 8, kg: 60 },
      { reps: 8, kg: 62.5 },
      { reps: 6, kg: 65 },
    ],
  },
  {
    name: 'Barbell Row',
    sets: [
      { reps: 10, kg: 50 },
      { reps: 10, kg: 52.5 },
    ],
  },
  { name: 'Back Squat', sets: [{ reps: 5, kg: 90 }] },
]

export const PLAN_DONE_STEPS = 4

export const PLAN_DONE_REPS = [12, 10, 10]

export const IMPORT_SHEET = [
  'Day,Walk Time,Gym Time,Avg Heart Rate,Highest Rate,Weight,Calories Burnt,Steps',
  'August 4,22.30,1:04:12,129,163,83.10,402,10215',
  'August 5,31.45,52.40,126,158,82.95,377,11630',
  'August 7,0,01.12.05,134,170,,566,6840',
  'August 8,19.20,01.05.30,128,161,82.70,431,"10,902"',
  'August 11,1.05.00,0,,,82.55,,13120',
  'August 12,26.10,48.15,125,155,82.60,352,9480',
  'August 14,44.00,01.09.47,133,168,82.30,468,"12,377"',
  'August 15,28.55,57.02,127,160,82.15,389,10044',
].join('\n')

export const SAVED_VIDEOS = [
  {
    category: 'big-lifts',
    title: 'How to get a huge bench press with perfect technique',
    url: 'https://www.youtube.com/watch?v=vcBig73ojpE',
    tags: ['bench', 'technique', 'chest'],
    priority: 'high',
  },
  {
    category: 'big-lifts',
    title: 'How to deadlift: the 5 step setup',
    url: 'https://www.youtube.com/watch?v=wYREQkVtvEc',
    tags: ['deadlift', 'setup'],
    priority: 'normal',
  },
  {
    category: 'big-lifts',
    title: 'How to squat: high bar and low bar',
    url: 'https://www.youtube.com/watch?v=bs_Ej32IYgo',
    tags: ['squat', 'legs'],
    priority: 'normal',
  },
  {
    category: 'pull',
    title: 'The perfect pull up',
    url: 'https://www.youtube.com/watch?v=eGo4IYlbE5g',
    tags: ['pullup', 'back', 'bodyweight'],
    priority: 'high',
  },
  {
    category: 'shoulders',
    title: 'How to do a face pull',
    url: 'https://www.youtube.com/watch?v=rep-qVOkqgk',
    tags: ['shoulders', 'rear delts'],
    priority: 'normal',
  },
  {
    category: 'shoulders',
    title: 'Standing overhead press',
    url: 'https://www.youtube.com/watch?v=2yjwXTZQDDI',
    tags: ['press', 'shoulders'],
    priority: 'low',
  },
]

export function sampleClock(now = new Date()) {
  const back = (now.getDay() - ANCHOR_WEEKDAY + 7) % 7
  const anchor = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - back,
    ANCHOR_HOUR,
    0,
    0,
    0,
  )
  if (anchor.getTime() > now.getTime()) {
    anchor.setDate(anchor.getDate() - 7)
  }
  return anchor
}

export async function loadSchemas() {
  mkdirSync(join(ROOT, 'node_modules/.cache/site-shots'), { recursive: true })
  await build({
    stdin: { contents: SCHEMA_ENTRY, resolveDir: ROOT, loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    external: ['zod'],
    outfile: BUNDLE,
    logLevel: 'silent',
  })
  return import(`${pathToFileURL(BUNDLE).href}?t=${String(Date.now())}`)
}

function localDate(date) {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dayAt(now, offset, hour, minute) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour, minute, 0, 0)
}

function wave(index, period, amplitude) {
  return Math.sin((index / period) * Math.PI * 2) * amplitude
}

function parse(schema, row, label) {
  const result = schema.safeParse(row)
  if (!result.success) {
    throw new Error(`the sample ${label} no longer fits its schema: ${result.error.message}`)
  }
  return result.data
}

function stamped(data, at) {
  return { id: randomUUID(), ...data, created_at: at, updated_at: at, deleted_at: null }
}

function liftIds(plans) {
  const byName = new Map(
    plans.flatMap((plan) =>
      plan.groups.flatMap((group) => group.steps.map((step) => [step.name, step.exerciseId])),
    ),
  )
  return Object.fromEntries(
    Object.entries(PLAN_LIFTS).map(([planId, lifts]) => [
      planId,
      lifts.map((lift) => {
        const exerciseId = byName.get(lift.name)
        if (exerciseId === undefined) {
          throw new Error(`the coach plans have no step named ${lift.name}`)
        }
        return { ...lift, exerciseId }
      }),
    ]),
  )
}

function dailyRows(schemas, now, gymOffsets, sessionSeconds) {
  const at = now.toISOString()
  return Array.from({ length: DAYS }, (_, step) => {
    const offset = step - (DAYS - 1)
    const gym = gymOffsets.has(offset)
    const weight = Math.round((82.4 - (step / (DAYS - 1)) * 1.8 + wave(step, 5, 0.25)) * 10) / 10
    const data = parse(
      schemas.dailyEntrySchema,
      {
        entry_date: localDate(dayAt(now, offset, 12, 0)),
        walk_seconds: (25 + Math.round(wave(step, 6, 8) + 8)) * 60,
        gym_seconds: gym
          ? (sessionSeconds.get(offset) ?? (62 + Math.round(wave(step, 4, 8))) * 60)
          : null,
        swim_seconds: null,
        avg_heart_rate: gym ? 124 + Math.round(wave(step, 3, 6)) : null,
        max_heart_rate: gym ? 168 + Math.round(wave(step, 4, 7)) : null,
        weight_kg: weight,
        calories_burnt: (gym ? 780 : 420) + Math.round(wave(step, 5, 60)),
        steps: 9800 + Math.round(wave(step, 7, 2600)) + (gym ? 1200 : 0),
        note: offset === 0 ? 'Push day. Incline press felt strong.' : null,
      },
      `daily entry ${String(offset)}`,
    )
    return stamped(data, at)
  })
}

function sessionRows(schemas, now, sessionOffsets, lifts) {
  const sessions = []
  const sets = []
  const seconds = new Map()
  const visits = {}
  const ordered = [...sessionOffsets].sort((a, b) => a - b)
  ordered.forEach((offset, index) => {
    const planId = SESSION_PLANS[index]
    const visit = visits[planId] ?? 0
    visits[planId] = visit + 1
    const start = dayAt(now, offset, 7, 5)
    const end = dayAt(now, offset, 8, 7 + (index % 3) * 4)
    const session = stamped(
      parse(
        schemas.storedWorkoutSessionSchema,
        {
          entry_date: localDate(start),
          started_at: start.toISOString(),
          ended_at: end.toISOString(),
          status: 'finished',
          plan_ids: [planId],
        },
        `session ${String(offset)}`,
      ),
      end.toISOString(),
    )
    sessions.push(session)
    seconds.set(offset, Math.round((end.getTime() - start.getTime()) / 1000))
    let clock = start.getTime() + 4 * 60000
    lifts[planId].forEach((lift) => {
      for (let setIndex = 0; setIndex < 3; setIndex += 1) {
        clock += 3 * 60000
        const kg = Math.round(lift.kg * (1 + visit * 0.05) * 2) / 2
        const data = parse(
          schemas.workoutSetSchema,
          {
            session_id: session.id,
            exercise_id: lift.exerciseId,
            set_index: setIndex,
            reps: Math.max(1, lift.reps - (setIndex === 2 ? 2 : 0)),
            weight_kg: kg,
            rpe: 7 + setIndex,
            completed_at: new Date(clock).toISOString(),
          },
          `set ${lift.name}`,
        )
        sets.push(stamped(data, new Date(clock).toISOString()))
      }
    })
  })
  return { sessions, sets, seconds }
}

function videoRows(schemas, now) {
  const at = now.toISOString()
  const categories = VIDEO_CATEGORIES.map((category) => ({
    key: category.key,
    row: stamped(
      parse(
        schemas.videoCategorySchema,
        { name: category.name, color: category.color },
        `category ${category.name}`,
      ),
      at,
    ),
  }))
  const idOf = Object.fromEntries(categories.map((category) => [category.key, category.row.id]))
  const videos = SAVED_VIDEOS.map((video, index) =>
    stamped(
      parse(
        schemas.savedVideoSchema,
        {
          url: video.url,
          title: video.title,
          category_id: idOf[video.category],
          tags: video.tags,
          priority: video.priority,
        },
        `video ${video.title}`,
      ),
      new Date(now.getTime() - index * 86400000).toISOString(),
    ),
  )
  return { categories: categories.map((category) => category.row), videos }
}

export function buildSample(schemas, now = new Date()) {
  const lifts = liftIds(schemas.COACH_PLANS)
  const gymOffsets = new Set(
    Array.from({ length: DAYS }, (_, step) => step - (DAYS - 1)).filter(
      (offset) => offset === 0 || GYM_WEEKDAYS.has(dayAt(now, offset, 12, 0).getDay()),
    ),
  )
  const sessionOffsets = new Set(
    [...gymOffsets].sort((a, b) => b - a).slice(0, SESSION_PLANS.length),
  )
  const { sessions, sets, seconds } = sessionRows(schemas, now, sessionOffsets, lifts)
  const { categories, videos } = videoRows(schemas, now)
  return {
    exerciseIds: [
      ...new Set(Object.values(lifts).flatMap((list) => list.map((lift) => lift.exerciseId))),
    ],
    stores: {
      dailyEntries: dailyRows(schemas, now, gymOffsets, seconds),
      workoutSessions: sessions,
      workoutSets: sets,
      videoCategories: categories,
      savedVideos: videos,
    },
  }
}
