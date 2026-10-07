export type ErrorSource = 'boundary' | 'window' | 'rejection' | 'live-query' | 'sync'

export const UNKNOWN_ERROR = 'An error with no message'

export const ERROR_LOG_QUERY = 'error log'

function textOf(value: unknown): string {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  } catch {
    return UNKNOWN_ERROR
  }
}

export function describeError(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) {
    return { message: error.message || error.name, stack: error.stack ?? null }
  }

  if (typeof error === 'string') {
    return { message: error, stack: null }
  }

  return { message: textOf(error), stack: null }
}

function digestOf(error: unknown): string | null {
  if (error instanceof Error && 'digest' in error && typeof error.digest === 'string') {
    return error.digest
  }

  return null
}

export function errorText(error: unknown): string {
  const { message, stack } = describeError(error)
  const digest = digestOf(error)

  return [message, digest === null ? null : `Digest: ${digest}`, stack]
    .filter((line): line is string => line !== null)
    .join('\n')
}

export function currentRoute(): string {
  return typeof window === 'undefined' ? '' : window.location.pathname
}

async function persist(record: {
  source: ErrorSource
  message: string
  stack: string | null
  route: string
}): Promise<void> {
  try {
    const { recordError } = await import('../db/repository')

    await recordError(record)
  } catch {
    return
  }
}

export function reportError(error: unknown, context: { route: string; source: ErrorSource }): void {
  try {
    const { message, stack } = describeError(error)

    console.error(`[${context.source}] ${context.route} ${message}`, stack ?? '')

    if (context.source === 'live-query' && message.startsWith(`${ERROR_LOG_QUERY}: `)) {
      return
    }

    const record = { source: context.source, message, stack, route: context.route }

    setTimeout(() => {
      void persist(record)
    }, 0)
  } catch {
    return
  }
}
