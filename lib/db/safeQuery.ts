import { currentRoute, describeError, reportError } from '../errors/report'

export function safeQuery<T>(query: () => Promise<T>, source: string): () => Promise<T | null> {
  return async () => {
    try {
      return await query()
    } catch (cause) {
      const { message, stack } = describeError(cause)
      const error = new Error(`${source}: ${message}`)

      error.stack = stack ?? error.stack
      reportError(error, { route: currentRoute(), source: 'live-query' })

      return null
    }
  }
}
