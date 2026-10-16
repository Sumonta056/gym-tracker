'use client'

import { useEffect, useState } from 'react'

export const FORCED_CRASH_MESSAGE = 'A forced render error for the end to end test.'

export function ForcedCrash() {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    setArmed(true)
  }, [])

  if (armed) {
    throw new Error(FORCED_CRASH_MESSAGE)
  }

  return <p className="text-muted text-sm">Forcing a render error…</p>
}
