'use client'

import { useEffect, useState } from 'react'

import { PlanSession } from '../../../components/plans/PlanSession'
import { LiveSession } from '../../../components/workout/LiveSession'
import { getActiveSession } from '../../../lib/db/repository'
import { combinePlans } from '../../../lib/plans'

import type { WorkoutSession } from '../../../lib/db/dexie'

type Mode = { kind: 'reading' } | { kind: 'free' } | { kind: 'plan'; session: WorkoutSession }

function modeOf(session: WorkoutSession | undefined): Mode {
  const ids = session?.plan_ids ?? null

  if (session === undefined || ids === null || combinePlans(ids).steps.length === 0) {
    return { kind: 'free' }
  }

  return { kind: 'plan', session }
}

export default function WorkoutPage() {
  const [mode, setMode] = useState<Mode>({ kind: 'reading' })

  useEffect(() => {
    let live = true

    getActiveSession().then(
      (session) => {
        if (live) setMode(modeOf(session))
      },
      () => {
        if (live) setMode({ kind: 'free' })
      },
    )

    return () => {
      live = false
    }
  }, [])

  if (mode.kind === 'reading') {
    return (
      <p role="status" className="text-muted text-sm">
        Reading this device…
      </p>
    )
  }

  if (mode.kind === 'plan') {
    return <PlanSession key={mode.session.id} session={mode.session} />
  }

  return <LiveSession />
}
