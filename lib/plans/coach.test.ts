import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { MUSCLE_GROUPS } from '../schema/exercise'
import { MUSCLES, PLAN_IDS, planSchema } from '../schema/plan'

import { COACH_PLANS } from './coach'

interface SourceStep {
  slug: string
  name: string
  how: string
  images: { start: string; end: string }
  muscles: { primary: string[]; secondary: string[] }
  video: { url: string; kind: string }
}

interface Source {
  uuids: Record<string, string>
  plans: {
    id: string
    title: string
    groups: { name: string; steps: SourceStep[] }[]
  }[]
}

const source = JSON.parse(
  readFileSync(resolve(process.cwd(), 'docs/data/coach-exercises.json'), 'utf8'),
) as Source

const steps = COACH_PLANS.flatMap((plan) => plan.groups.flatMap((group) => group.steps))
const sourceSteps = source.plans.flatMap((plan) => plan.groups.flatMap((group) => group.steps))

function webp(path: string) {
  return path.replace('docs/data/coach-images/', '/exercises/').replace(/\.jpg$/, '.webp')
}

describe('COACH_PLANS', () => {
  it('parses every plan with the Plan schema', () => {
    for (const plan of COACH_PLANS) {
      expect(planSchema.parse(plan)).toEqual(plan)
    }
  })

  it('holds 4 plans of 9, 9, 5 and 3 steps, 26 in all', () => {
    expect(COACH_PLANS.map((plan) => plan.id)).toEqual([
      'chest-triceps',
      'back-biceps',
      'shoulders',
      'legs',
    ])
    expect(
      COACH_PLANS.map((plan) => plan.groups.reduce((sum, group) => sum + group.steps.length, 0)),
    ).toEqual([9, 9, 5, 3])
    expect(steps).toHaveLength(26)
  })

  it('gives every step a unique slug', () => {
    expect(new Set(steps.map((step) => step.slug)).size).toBe(26)
  })

  it('gives every step a unique exercise id', () => {
    expect(new Set(steps.map((step) => step.exerciseId)).size).toBe(26)
  })

  it('holds 26 unique UUIDs in the JSON, one per slug', () => {
    const uuids = Object.values(source.uuids)

    expect(uuids).toHaveLength(26)
    expect(new Set(uuids).size).toBe(26)
    expect(Object.keys(source.uuids).sort()).toEqual(sourceSteps.map((step) => step.slug).sort())
  })

  it('keeps the plans, the groups and the step order of the JSON', () => {
    expect(
      COACH_PLANS.map((plan) => ({
        id: plan.id,
        title: plan.title,
        groups: plan.groups.map((group) => [group.name, group.steps.map((step) => step.slug)]),
      })),
    ).toEqual(
      source.plans.map((plan) => ({
        id: plan.id,
        title: plan.title,
        groups: plan.groups.map((group) => [group.name, group.steps.map((step) => step.slug)]),
      })),
    )
  })

  it('copies every field of every step from the JSON', () => {
    sourceSteps.forEach((sourceStep, index) => {
      expect(steps[index]).toEqual({
        exerciseId: source.uuids[sourceStep.slug],
        slug: sourceStep.slug,
        name: sourceStep.name,
        how: sourceStep.how,
        images: { start: webp(sourceStep.images.start), end: webp(sourceStep.images.end) },
        muscles: sourceStep.muscles,
        video: sourceStep.video,
        target: { sets: 3, repsMin: 10, repsMax: 12 },
      })
    })
  })

  it('gives every step 1 or more primary muscles, all from the 16 names', () => {
    const known: readonly string[] = MUSCLES

    for (const step of steps) {
      expect(step.muscles.primary.length).toBeGreaterThan(0)
      for (const muscle of [...step.muscles.primary, ...step.muscles.secondary]) {
        expect(known).toContain(muscle)
      }
    }
  })

  it('gives every step a video link that starts with https://', () => {
    for (const step of steps) {
      expect(step.video?.url.startsWith('https://')).toBe(true)
    }
  })

  it('retires no coach plan', () => {
    expect(COACH_PLANS.every((plan) => !plan.retired)).toBe(true)
  })
})

const MIGRATIONS = resolve(process.cwd(), 'supabase/migrations')

function seedRows(file: string) {
  const text = readFileSync(resolve(MIGRATIONS, file), 'utf8')
  const pattern = /\('([0-9a-f-]{36})', null, '([^']+)', '([a-z]+)'\)/g

  return [...text.matchAll(pattern)].map(([, id = '', name = '', group = '']) => ({
    id,
    name,
    group,
  }))
}

function migrationFile(suffix: string) {
  const file = readdirSync(MIGRATIONS).find((name) => name.endsWith(suffix))

  if (file === undefined) {
    throw new Error(`no migration ends with ${suffix}`)
  }

  return file
}

const GROUP_OF_MUSCLE: Record<string, string> = {
  chest: 'chest',
  shoulders: 'shoulders',
  neck: 'shoulders',
  triceps: 'arms',
  biceps: 'arms',
  forearms: 'arms',
  abdominals: 'core',
  obliques: 'core',
  lats: 'back',
  'middle back': 'back',
  'lower back': 'back',
  traps: 'back',
  quadriceps: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'legs',
}

describe('the coach exercise rows', () => {
  const phase2 = seedRows(migrationFile('_phase2_exercise_seed.sql'))
  const phase3 = seedRows(migrationFile('_phase3_coach_plans.sql'))

  it('reads the 40 Phase 2 seed rows and the 14 Phase 3 coach rows', () => {
    expect(phase2).toHaveLength(40)
    expect(phase3).toHaveLength(14)
  })

  it('finds every coach exercise id in the Phase 2 seed or the Phase 3 migration', () => {
    const ids = new Set([...phase2, ...phase3].map((row) => row.id))

    for (const step of steps) {
      expect(ids).toContain(step.exerciseId)
    }
  })

  it('reuses the seed row for the 8 exact names and the 4 named aliases, 12 in all', () => {
    const seedByName = new Map(phase2.map((row) => [row.name.toLowerCase(), row.id]))
    const seedName: Record<string, string> = {
      'incline-dumbbell-press': 'Incline Dumbbell Press',
      'flat-dumbbell-fly': 'Dumbbell Fly',
      'lat-pulldown': 'Lat Pulldown',
      'seated-cable-row': 'Seated Cable Row',
      'one-arm-dumbbell-row': 'Dumbbell Row',
      'dumbbell-curl': 'Dumbbell Curl',
      'hammer-curl': 'Hammer Curl',
      'shoulder-press': 'Dumbbell Shoulder Press',
      'side-lateral-raise': 'Lateral Raise',
      'face-pull': 'Face Pull',
      'leg-curl': 'Leg Curl',
      'leg-press': 'Leg Press',
    }
    const seedIds = new Set(phase2.map((row) => row.id))
    const reused = steps.filter((step) => seedIds.has(step.exerciseId))

    expect(reused.map((step) => step.slug).sort()).toEqual(Object.keys(seedName).sort())
    expect(reused.map((step) => step.exerciseId)).toEqual(
      reused.map((step) => seedByName.get((seedName[step.slug] ?? '').toLowerCase())),
    )
  })

  it('reuses the seed row for every coach name that equals a seed name', () => {
    const seedByName = new Map(phase2.map((row) => [row.name.toLowerCase(), row.id]))
    const exact = steps.filter((step) => seedByName.has(step.name.toLowerCase()))

    expect(exact).toHaveLength(8)
    expect(exact.map((step) => step.exerciseId)).toEqual(
      exact.map((step) => seedByName.get(step.name.toLowerCase())),
    )
  })

  it('adds no coach row with the name of a seed row', () => {
    const seedNames = new Set(phase2.map((row) => row.name.toLowerCase()))

    for (const row of phase3) {
      expect(seedNames).not.toContain(row.name.toLowerCase())
    }
  })

  it('adds no coach row with the id of a seed row', () => {
    const seedIds = new Set(phase2.map((row) => row.id))

    for (const row of phase3) {
      expect(seedIds).not.toContain(row.id)
    }
  })

  it('names each new row as its coach step and files it under its main muscle group', () => {
    const groups: readonly string[] = MUSCLE_GROUPS

    for (const row of phase3) {
      const step = steps.find((candidate) => candidate.exerciseId === row.id)
      const primary = step?.muscles.primary[0] ?? ''

      expect(step?.name).toBe(row.name)
      expect(groups).toContain(row.group)
      expect(row.group).toBe(GROUP_OF_MUSCLE[primary])
    }
  })

  it('makes the Phase 3 insert safe to run twice', () => {
    const text = readFileSync(resolve(MIGRATIONS, migrationFile('_phase3_coach_plans.sql')), 'utf8')

    expect(text).toMatch(/on conflict \(id\) do nothing;/)
    expect(text).toMatch(/add column if not exists plan_ids text\[\]/)
  })

  it('checks every plan id of a session against the 4 plan ids', () => {
    const text = readFileSync(resolve(MIGRATIONS, migrationFile('_phase3_coach_plans.sql')), 'utf8')
    const allowed = /plan_ids <@ array\[([^\]]+)\]::text\[\]/.exec(text)?.[1] ?? ''

    expect([...allowed.matchAll(/'([^']+)'/g)].map(([, id]) => id)).toEqual([...PLAN_IDS])
  })

  it('refuses an empty plan list in the check', () => {
    const text = readFileSync(resolve(MIGRATIONS, migrationFile('_phase3_coach_plans.sql')), 'utf8')

    expect(text).toMatch(/cardinality\(plan_ids\) > 0\s+and plan_ids <@/)
  })

  it('writes no comment in the Phase 3 migration', () => {
    const text = readFileSync(resolve(MIGRATIONS, migrationFile('_phase3_coach_plans.sql')), 'utf8')

    expect(text).not.toMatch(/--|\/\*/)
  })
})

describe('lib/plans', () => {
  it('imports nothing from supabase, lib/sync or lib/db', () => {
    const folder = resolve(process.cwd(), 'lib/plans')
    const files = readdirSync(folder).filter((file) => /\.tsx?$/.test(file))

    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const text = readFileSync(resolve(folder, file), 'utf8')

      expect(text).not.toMatch(/from '(@supabase\/|@\/lib\/(sync|db)|(\.\.\/)+(sync|db)\b)/)
    }
  })
})
