'use client'

import { ErrorScreen } from '../../components/errors/ErrorScreen'

export default function AppError({
  error,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorScreen error={error} />
}
