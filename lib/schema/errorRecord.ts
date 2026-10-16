import { z } from 'zod'

import type { ErrorSource } from '../errors/report'

export const MAX_ERROR_RECORDS = 50

export const MAX_STACK_LENGTH = 2000

export const MAX_MESSAGE_LENGTH = 500

export const ERROR_SOURCES = [
  'boundary',
  'window',
  'rejection',
  'live-query',
  'sync',
] as const satisfies readonly ErrorSource[]

export type ErrorRecord = {
  id: string
  at: string
  source: ErrorSource
  message: string
  stack: string | null
  route: string
}

export const errorRecordSchema: z.ZodType<ErrorRecord> = z.object({
  id: z.uuid(),
  at: z.iso.datetime(),
  source: z.enum(ERROR_SOURCES),
  message: z.string().max(MAX_MESSAGE_LENGTH),
  stack: z.string().max(MAX_STACK_LENGTH).nullable(),
  route: z.string(),
})
