import { describe, expect, it } from 'vitest'

import { MUSCLES, PLAN_IDS, planIdSchema, planSchema, planStepSchema } from './plan'

const step = {
  exerciseId: '901f3470-1ab2-4abe-9e0d-8f7fc9d20117',
  slug: 'incline-dumbbell-press',
  name: 'Incline Dumbbell Press',
  how: 'Bench tilted up, press dumbbells from your chest.',
  images: {
    start: '/exercises/incline-dumbbell-press-start.webp',
    end: '/exercises/incline-dumbbell-press-end.webp',
  },
  muscles: { primary: ['chest'], secondary: ['shoulders', 'triceps'] },
  video: {
    url: 'https://www.youtube.com/results?search_query=Incline%20Dumbbell%20Press%20form',
    kind: 'search',
  },
  target: { sets: 3, repsMin: 10, repsMax: 12 },
}

function plan(stepOverrides: Record<string, unknown> = {}, planOverrides = {}) {
  return planSchema.safeParse({
    id: 'chest-triceps',
    title: 'Chest + Triceps',
    groups: [{ name: 'Chest', steps: [{ ...step, ...stepOverrides }] }],
    ...planOverrides,
  })
}

function issuePaths(result: ReturnType<typeof plan>) {
  if (result.success) {
    throw new Error('expected the parse to fail')
  }

  return result.error.issues.map((issue) => issue.path.join('.'))
}

describe('planIdSchema', () => {
  it('holds the 4 coach plan ids', () => {
    expect(PLAN_IDS).toEqual(['chest-triceps', 'back-biceps', 'shoulders', 'legs'])
  })

  it('rejects an unknown plan id', () => {
    expect(planIdSchema.safeParse('arms').success).toBe(false)
  })
})

describe('MUSCLES', () => {
  it('holds the 16 Free Exercise DB muscle names', () => {
    expect(MUSCLES).toHaveLength(16)
    expect(new Set(MUSCLES).size).toBe(16)
  })
})

describe('planSchema', () => {
  it('parses a valid plan and defaults retired to false', () => {
    const result = plan()

    expect(result.success).toBe(true)
    expect(result.data?.retired).toBe(false)
  })

  it('keeps a retired flag it is given', () => {
    expect(plan({}, { retired: true }).data?.retired).toBe(true)
  })

  it('parses a step with no video', () => {
    expect(plan({ video: undefined }).success).toBe(true)
  })

  it('parses a video with a length', () => {
    const video = { url: 'https://www.youtube.com/watch?v=abc', kind: 'video', length: '0:45' }

    expect(plan({ video }).data?.groups[0]?.steps[0]?.video).toEqual(video)
  })

  it('fails when repsMin is above repsMax', () => {
    const result = plan({ target: { sets: 3, repsMin: 13, repsMax: 12 } })

    expect(issuePaths(result)).toEqual(['groups.0.steps.0.target.repsMin'])
  })

  it('fails on an image path outside /exercises/', () => {
    const images = { start: '/images/incline-dumbbell-press-start.webp', end: step.images.end }

    expect(issuePaths(plan({ images }))).toEqual(['groups.0.steps.0.images.start'])
  })

  it('fails on an image path that is not a webp', () => {
    const images = { start: step.images.start, end: '/exercises/incline-dumbbell-press-end.jpg' }

    expect(issuePaths(plan({ images }))).toEqual(['groups.0.steps.0.images.end'])
  })

  it('fails on an empty primary muscle list', () => {
    const muscles = { primary: [], secondary: ['triceps'] }

    expect(issuePaths(plan({ muscles }))).toEqual(['groups.0.steps.0.muscles.primary'])
  })

  it('fails on a muscle outside the 16 names', () => {
    const muscles = { primary: ['arms'], secondary: [] }

    expect(issuePaths(plan({ muscles }))).toEqual(['groups.0.steps.0.muscles.primary.0'])
  })

  it('fails on an http video link', () => {
    const video = { url: 'http://www.youtube.com/results?search_query=press', kind: 'search' }

    expect(issuePaths(plan({ video }))).toEqual(['groups.0.steps.0.video.url'])
  })

  it('fails on an exercise id that is not a uuid', () => {
    expect(issuePaths(plan({ exerciseId: 'incline-dumbbell-press' }))).toEqual([
      'groups.0.steps.0.exerciseId',
    ])
  })

  it('fails on a plan with no groups', () => {
    expect(issuePaths(plan({}, { groups: [] }))).toEqual(['groups'])
  })

  it('fails on a group with no steps', () => {
    expect(issuePaths(plan({}, { groups: [{ name: 'Chest', steps: [] }] }))).toEqual([
      'groups.0.steps',
    ])
  })

  it('fails on an unknown plan id', () => {
    expect(issuePaths(plan({}, { id: 'arms' }))).toEqual(['id'])
  })
})

describe('planStepSchema', () => {
  it('defaults bodyweight to false', () => {
    expect(planStepSchema.parse(step).bodyweight).toBe(false)
  })

  it('keeps a bodyweight flag it is given', () => {
    expect(planStepSchema.parse({ ...step, bodyweight: true }).bodyweight).toBe(true)
  })

  it('fails on a bodyweight flag that is not a boolean', () => {
    expect(planStepSchema.safeParse({ ...step, bodyweight: 'yes' }).success).toBe(false)
  })

  it('accepts zero secondary muscles', () => {
    expect(
      planStepSchema.safeParse({ ...step, muscles: { primary: ['chest'], secondary: [] } }).success,
    ).toBe(true)
  })
})
