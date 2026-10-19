import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { COACH_PLANS } from '../plans/coach'
import { MUSCLE_GROUPS } from '../schema/exercise'
import { MUSCLES } from '../schema/plan'

import { BODY_BACK, BODY_FRONT, BODY_VIEWBOX, MUSCLE_REGIONS } from './body'

interface PolygonSource {
  viewBox: string
  front: Record<string, string[]>
  back: Record<string, string[]>
}

const polygons = JSON.parse(
  readFileSync(resolve(process.cwd(), 'docs/data/body-polygons.json'), 'utf8'),
) as PolygonSource

const readme = readFileSync(resolve(process.cwd(), 'docs/data/README.md'), 'utf8')

const steps = COACH_PLANS.flatMap((plan) => plan.groups.flatMap((group) => group.steps))

function readmeTable(): Record<string, { group: string; regions: string[] }> {
  const rows: Record<string, { group: string; regions: string[] }> = {}
  for (const line of readme.split('\n')) {
    const match = /^\|\s*([a-z ]+?)\s*\|\s*`([a-z]+)`\s*\|\s*([a-z, -]+?)\s*\|$/.exec(line.trim())
    if (match === null) continue
    const [, muscle = '', group = '', regions = ''] = match
    rows[muscle] = { group, regions: regions.split(',').map((region) => region.trim()) }
  }
  return rows
}

describe('BODY_FRONT and BODY_BACK', () => {
  it('uses the viewBox of the source file', () => {
    expect(BODY_VIEWBOX).toBe('0 0 100 200')
    expect(BODY_VIEWBOX).toBe(polygons.viewBox)
  })

  it('equals the front polygons of docs/data/body-polygons.json', () => {
    expect(BODY_FRONT).toEqual(polygons.front)
  })

  it('equals the back polygons of docs/data/body-polygons.json', () => {
    expect(BODY_BACK).toEqual(polygons.back)
  })
})

describe('MUSCLE_REGIONS', () => {
  it('equals the region table in docs/data/README.md', () => {
    expect(MUSCLE_REGIONS).toEqual(readmeTable())
  })

  it('has a row for every muscle the plan schema allows', () => {
    expect(Object.keys(MUSCLE_REGIONS).sort()).toEqual([...MUSCLES].sort())
  })

  it('maps every muscle of every coach step', () => {
    const used = new Set(
      steps.flatMap((step) => [...step.muscles.primary, ...step.muscles.secondary]),
    )
    expect(used.size).toBeGreaterThan(0)
    for (const muscle of used) {
      expect(MUSCLE_REGIONS[muscle].regions.length).toBeGreaterThan(0)
    }
  })

  it('names only regions that a figure draws', () => {
    const drawn = new Set([...Object.keys(BODY_FRONT), ...Object.keys(BODY_BACK)])
    for (const row of Object.values(MUSCLE_REGIONS)) {
      for (const region of row.regions) {
        expect(drawn).toContain(region)
      }
    }
  })

  it('names only app muscle groups', () => {
    for (const row of Object.values(MUSCLE_REGIONS)) {
      expect(MUSCLE_GROUPS).toContain(row.group)
    }
  })
})
