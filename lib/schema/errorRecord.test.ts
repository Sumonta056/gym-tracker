import { describe, expect, it } from 'vitest'

import { errorRecordSchema, MAX_MESSAGE_LENGTH, MAX_STACK_LENGTH } from './errorRecord'

const RECORD = {
  id: '11111111-1111-4111-8111-111111111111',
  at: '2026-10-05T10:00:00.000Z',
  source: 'boundary',
  message: 'boom',
  stack: 'Error: boom\n    at render',
  route: '/log',
}

describe('errorRecordSchema', () => {
  it('accepts a full record', () => {
    expect(errorRecordSchema.parse(RECORD)).toEqual(RECORD)
  })

  it('accepts a record with no stack', () => {
    expect(errorRecordSchema.parse({ ...RECORD, stack: null }).stack).toBeNull()
  })

  it('refuses an unknown source', () => {
    expect(errorRecordSchema.safeParse({ ...RECORD, source: 'server' }).success).toBe(false)
  })

  it('refuses a stack longer than the limit', () => {
    const stack = 'x'.repeat(MAX_STACK_LENGTH + 1)

    expect(errorRecordSchema.safeParse({ ...RECORD, stack }).success).toBe(false)
  })

  it('refuses a message longer than the limit', () => {
    const message = 'x'.repeat(MAX_MESSAGE_LENGTH + 1)

    expect(errorRecordSchema.safeParse({ ...RECORD, message }).success).toBe(false)
  })
})
