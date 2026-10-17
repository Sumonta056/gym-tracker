import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { MUSCLES, planSchema } from '../schema/plan'

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
