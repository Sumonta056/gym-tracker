import { LOCAL_PROFILE_ID } from '../../lib/db/dexie'
import { dailyEntrySchema } from '../../lib/schema/dailyEntry'
import { exerciseSchema } from '../../lib/schema/exercise'
import { profileSchema } from '../../lib/schema/profile'
import { workoutSessionSchema } from '../../lib/schema/workoutSession'
import { workoutSetSchema } from '../../lib/schema/workoutSet'

import type { DeadLetter } from '../../lib/db/dexie'
import type { SyncStatusReport } from '../../lib/db/repository'

export const SYNCED: SyncStatusReport = { status: 'synced', pending: 0, failed: 0 }

export function syncedStatus(): SyncStatusReport {
  return SYNCED
}

export const DEAD_DAY: DeadLetter = {
  id: '44444444-4444-4444-8444-444444444444',
  sequence: 3,
  table_name: 'daily_entries',
  operation: 'upsert',
  row_id: '11111111-1111-4111-8111-111111111111',
  payload: {
    ...dailyEntrySchema.parse({ entry_date: '2026-09-01', steps: 8000 }),
    id: '11111111-1111-4111-8111-111111111111',
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    deleted_at: null,
  },
  created_at: '2026-09-01T10:00:00.000Z',
  attempts: 1,
  last_error: 'new row violates row-level security policy for table "daily_entries"',
  next_attempt_at: null,
  error_code: '42501',
  failed_at: '2026-09-01T10:00:05.000Z',
}

export const DEAD_PROFILE: DeadLetter = {
  id: '55555555-5555-4555-8555-555555555555',
  sequence: 4,
  table_name: 'profiles',
  operation: 'upsert',
  row_id: LOCAL_PROFILE_ID,
  payload: {
    ...profileSchema.parse({}),
    id: LOCAL_PROFILE_ID,
    updated_at: '2026-09-01T10:00:00.000Z',
  },
  created_at: '2026-09-01T10:00:00.000Z',
  attempts: 20,
  last_error: 'Failed to fetch',
  next_attempt_at: null,
  error_code: null,
  failed_at: '2026-09-01T10:30:00.000Z',
}

export const DEAD_EXERCISE: DeadLetter = {
  ...DEAD_DAY,
  id: '66666666-6666-4666-8666-666666666666',
  sequence: 5,
  table_name: 'exercises',
  row_id: '33333333-3333-4333-8333-333333333333',
  payload: {
    ...exerciseSchema.parse({ name: 'Cable Fly', muscle_group: 'chest' }),
    id: '33333333-3333-4333-8333-333333333333',
    user_id: LOCAL_PROFILE_ID,
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    deleted_at: null,
  },
}

export const DEAD_SESSION: DeadLetter = {
  ...DEAD_DAY,
  id: '77777777-7777-4777-8777-777777777777',
  sequence: 6,
  table_name: 'workout_sessions',
  row_id: '22222222-2222-4222-8222-222222222222',
  payload: {
    ...workoutSessionSchema.parse({
      entry_date: '2026-09-01',
      started_at: '2026-09-01T10:00:00.000Z',
    }),
    id: '22222222-2222-4222-8222-222222222222',
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    deleted_at: null,
  },
}

export const DEAD_SET: DeadLetter = {
  ...DEAD_DAY,
  id: '88888888-8888-4888-8888-888888888888',
  sequence: 7,
  table_name: 'workout_sets',
  row_id: '99999999-9999-4999-8999-999999999999',
  payload: {
    ...workoutSetSchema.parse({
      session_id: '22222222-2222-4222-8222-222222222222',
      exercise_id: '33333333-3333-4333-8333-333333333333',
      set_index: 2,
      reps: 8,
    }),
    id: '99999999-9999-4999-8999-999999999999',
    created_at: '2026-09-01T10:05:00.000Z',
    updated_at: '2026-09-01T10:05:00.000Z',
    deleted_at: null,
  },
}
