import { describe, expect, it } from 'vitest'

import { getPlan } from '../../lib/plans'

import {
  agoText,
  cardLine,
  daysBetween,
  lastDoneText,
  lastSetText,
  NEVER_DONE,
  NOT_DONE_YET,
  PICK_A_PLAN,
  planPath,
  previewLine,
  reasonText,
  startDetail,
  startLabel,
  stepsLinkText,
  targetText,
  toggleSelection,
} from './planText'

import type { WorkoutSet } from '../../lib/db/dexie'
import type { Plan, PlanId } from '../../lib/schema/plan'

function plan(id: PlanId): Plan {
  const found = getPlan(id)
  if (found === undefined) throw new Error(`expected the plan ${id}`)
  return found
}

function set(weight: number | null): WorkoutSet {
  return {
    id: 'set-1',
    session_id: 'session-1',
    exercise_id: 'exercise-1',
    set_index: 0,
    reps: 10,
    weight_kg: weight,
    completed_at: '2026-10-14T10:00:00.000Z',
    created_at: '2026-10-14T10:00:00.000Z',
    updated_at: '2026-10-14T10:00:00.000Z',
    deleted_at: null,
  } as WorkoutSet
}

describe('planPath', () => {
  it('opens the preview of a plan under /workouts', () => {
    expect(planPath('legs')).toBe('/workouts/legs')
  })
})

describe('daysBetween', () => {
  it('counts whole days between 2 dates', () => {
    expect(daysBetween('2026-10-14', '2026-10-20')).toBe(6)
  })

  it('never goes below 0 for a date after today', () => {
    expect(daysBetween('2026-10-21', '2026-10-20')).toBe(0)
  })

  it('reads a broken date as day 0 rather than throwing', () => {
    expect(daysBetween('nope', '1970-01-03')).toBe(2)
  })
})

describe('agoText', () => {
  it('says today for the same day', () => {
    expect(agoText('2026-10-20', '2026-10-20')).toBe('today')
  })

  it('says yesterday for 1 day back', () => {
    expect(agoText('2026-10-19', '2026-10-20')).toBe('yesterday')
  })

  it('counts days from 2 days back', () => {
    expect(agoText('2026-10-14', '2026-10-20')).toBe('6 days ago')
  })
})

describe('lastDoneText', () => {
  it('reads never done for a plan with no finished session', () => {
    expect(lastDoneText(undefined, '2026-10-20')).toBe(NEVER_DONE)
    expect(NEVER_DONE).toBe('never done')
  })

  it('reads last done with the days', () => {
    expect(lastDoneText('2026-10-14', '2026-10-20')).toBe('last done 6 days ago')
  })
})

describe('reasonText', () => {
  it('gives the least recent reason with the days', () => {
    expect(reasonText('2026-10-14', '2026-10-20')).toBe('You did it least recently: 6 days ago')
  })

  it('says the plan is not done yet when it never was', () => {
    expect(reasonText(undefined, '2026-10-20')).toBe(NOT_DONE_YET)
  })
})

describe('cardLine', () => {
  it('names the exercise count and the last day', () => {
    expect(cardLine(plan('chest-triceps'), '2026-10-14', '2026-10-20')).toBe(
      '9 exercises · last done 6 days ago',
    )
  })

  it('reads never done for legs on a new device', () => {
    expect(cardLine(plan('legs'), undefined, '2026-10-20')).toBe('3 exercises · never done')
  })
})

describe('stepsLinkText', () => {
  it('counts the steps of the plan', () => {
    expect(stepsLinkText(plan('chest-triceps'))).toBe('See the 9 steps →')
  })
})

describe('targetText', () => {
  it('writes sets times the rep range', () => {
    expect(targetText({ sets: 3, repsMin: 10, repsMax: 12 })).toBe('3 × 10–12')
  })

  it('writes 1 rep count when the range is 1 number', () => {
    expect(targetText({ sets: 4, repsMin: 8, repsMax: 8 })).toBe('4 × 8')
  })
})

describe('lastSetText', () => {
  it('reads first time with no earlier set', () => {
    expect(lastSetText(undefined, 'metric')).toBe('first time')
  })

  it('names the last weight in kg', () => {
    expect(lastSetText(set(12), 'metric')).toBe('last 12 kg')
  })

  it('names the last weight in lb on the imperial setting', () => {
    expect(lastSetText(set(10), 'imperial')).toBe('last 22 lb')
  })

  it('reads body for a set with no weight', () => {
    expect(lastSetText(set(null), 'metric')).toBe('body')
  })

  it('reads body for a body-weight step, done or not', () => {
    expect(lastSetText(undefined, 'metric', true)).toBe('body')
    expect(lastSetText(set(12), 'metric', true)).toBe('body')
  })
})

describe('previewLine', () => {
  it('names exercises, sets and minutes for chest and triceps', () => {
    expect(previewLine(plan('chest-triceps'))).toBe('9 exercises · 27 sets · about 55 min')
  })
})

describe('startLabel', () => {
  it('asks for a plan with none picked', () => {
    expect(startLabel([])).toBe(PICK_A_PLAN)
  })

  it('names 1 plan', () => {
    expect(startLabel([plan('chest-triceps')])).toBe('Start Chest + Triceps')
  })

  it('names 2 plans in the picked order', () => {
    expect(startLabel([plan('legs'), plan('shoulders')])).toBe('Start Legs + Shoulders')
  })
})

describe('startDetail', () => {
  it('gives no detail with none picked', () => {
    expect(startDetail([])).toBeNull()
  })

  it('names the exercises and the minutes of 1 plan', () => {
    expect(startDetail([plan('chest-triceps')])).toBe('9 exercises · about 55 min')
  })

  it('adds both plans and says combined for 2', () => {
    expect(startDetail([plan('shoulders'), plan('legs')])).toBe(
      '8 exercises · about 60 min · combined',
    )
  })
})

describe('toggleSelection', () => {
  it('adds a plan', () => {
    expect(toggleSelection([], 'legs')).toEqual(['legs'])
  })

  it('removes a picked plan', () => {
    expect(toggleSelection(['legs', 'shoulders'], 'legs')).toEqual(['shoulders'])
  })

  it('drops the oldest pick on a third plan', () => {
    expect(toggleSelection(['legs', 'shoulders'], 'chest-triceps')).toEqual([
      'shoulders',
      'chest-triceps',
    ])
  })
})
