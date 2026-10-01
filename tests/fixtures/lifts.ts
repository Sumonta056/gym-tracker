import type { Exercise, WorkoutSession, WorkoutSet } from '../../lib/db/dexie'

export const BENCH = '00000000-0000-4000-8000-0000000000b1'
export const LAT = '00000000-0000-4000-8000-0000000000b2'
export const LEG = '00000000-0000-4000-8000-0000000000b3'
export const ROW = '00000000-0000-4000-8000-0000000000b4'

export function exercise(id: string, name: string): Exercise {
  return {
    id,
    user_id: null,
    name,
    muscle_group: 'chest',
    is_archived: false,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    deleted_at: null,
  }
}

export const EXERCISES: Exercise[] = [
  exercise(BENCH, 'Bench press'),
  exercise(LAT, 'Lat pulldown'),
  exercise(LEG, 'Leg press'),
  exercise(ROW, 'Seated row'),
]

export function sessionOn(date: string, patch: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: `00000000-0000-4000-8000-${date.replaceAll('-', '').padStart(12, '0')}`,
    entry_date: date,
    started_at: `${date}T12:00:00.000Z`,
    ended_at: `${date}T13:00:00.000Z`,
    status: 'finished',
    created_at: `${date}T12:00:00.000Z`,
    updated_at: `${date}T13:00:00.000Z`,
    deleted_at: null,
    ...patch,
  }
}

let counter = 0

export function liftSet(
  session: WorkoutSession,
  exerciseId: string,
  reps: number,
  weightKg: number | null,
  patch: Partial<WorkoutSet> = {},
): WorkoutSet {
  counter += 1

  return {
    id: `00000000-0000-4000-9000-${String(counter).padStart(12, '0')}`,
    session_id: session.id,
    exercise_id: exerciseId,
    set_index: counter,
    reps,
    weight_kg: weightKg,
    rpe: null,
    completed_at: `${session.entry_date}T12:${String(counter % 60).padStart(2, '0')}:00.000Z`,
    created_at: `${session.entry_date}T12:00:00.000Z`,
    updated_at: `${session.entry_date}T12:00:00.000Z`,
    deleted_at: null,
    ...patch,
  }
}
