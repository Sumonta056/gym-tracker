export const DEFAULT_REST_SECONDS = 90

export const EXTRA_REST_SECONDS = 30

export function restSecondsFor(
  byExercise: Readonly<Record<string, number>>,
  exerciseId: string,
): number {
  return byExercise[exerciseId] ?? DEFAULT_REST_SECONDS
}

export function restTotalSeconds(restSeconds: number, extraTaps: number): number {
  return restSeconds + EXTRA_REST_SECONDS * extraTaps
}

export function restEndsAt(completedAt: string, restSeconds: number, extraTaps: number): number {
  return Date.parse(completedAt) + restTotalSeconds(restSeconds, extraTaps) * 1000
}

export function remainingSeconds(endsAt: number, now: Date): number {
  return Math.max(0, Math.ceil((endsAt - now.getTime()) / 1000))
}

export function restProgress(remaining: number, total: number): number {
  if (total <= 0) {
    return 0
  }

  return Math.min(100, (remaining / total) * 100)
}
