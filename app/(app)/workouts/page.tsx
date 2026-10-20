'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

import { PlanPicker } from '../../../components/plans/PlanPicker'
import { SyncChip } from '../../../components/sync/SyncChip'
import { MicroLabel } from '../../../components/ui/MicroLabel'
import { SecondaryButton } from '../../../components/ui/SecondaryButton'
import { WorkoutHistory } from '../../../components/workouts/WorkoutHistory'
import {
  getActiveSession,
  SessionAlreadyActive,
  SignedOutOnThisDevice,
  startSession,
} from '../../../lib/db/repository'
import { localDate } from '../../../lib/schema/dailyEntry'

const WORKOUT_PATH = '/workout'

const START_FAILED = 'The session could not be started on this device.'

type Launch = 'reading' | 'idle' | 'active'

function SessionLauncher() {
  const router = useRouter()
  const [launch, setLaunch] = useState<Launch>('reading')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true

    getActiveSession().then(
      (session) => {
        if (live) setLaunch(session === undefined ? 'idle' : 'active')
      },
      () => {
        if (live) setLaunch('idle')
      },
    )

    return () => {
      live = false
    }
  }, [])

  const start = () => {
    if (starting) return

    setStarting(true)
    setError(null)
    startSession(localDate()).then(
      () => {
        router.push(WORKOUT_PATH)
      },
      (cause: unknown) => {
        if (cause instanceof SessionAlreadyActive) {
          router.push(WORKOUT_PATH)
          return
        }

        setStarting(false)
        setError(cause instanceof SignedOutOnThisDevice ? cause.message : START_FAILED)
      },
    )
  }

  if (launch === 'reading') {
    return null
  }

  return (
    <div className="mt-5 flex max-w-sm flex-col gap-3">
      {launch === 'active' ? (
        <Link
          href={WORKOUT_PATH}
          className="bg-surface-2 text-text border-border rounded-input inline-flex min-h-[54px] w-full items-center justify-center border px-4 text-[15px] font-bold tracking-[-0.2px]"
        >
          Resume
        </Link>
      ) : (
        <SecondaryButton disabled={starting} onClick={start}>
          Start a session
        </SecondaryButton>
      )}
      {error === null ? null : (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
    </div>
  )
}

export default function WorkoutsPage() {
  return (
    <>
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <MicroLabel as="p">Gym Tracker</MicroLabel>
          <h1 className="mt-2 text-[23px] leading-tight font-bold tracking-[-0.6px]">Workouts</h1>
        </div>
        <SyncChip className="shrink-0" />
      </header>
      <PlanPicker />
      <section aria-labelledby="free-session" className="mt-6">
        <MicroLabel as="p" id="free-session">
          Free session
        </MicroLabel>
        <SessionLauncher />
      </section>
      <Suspense fallback={null}>
        <WorkoutHistory />
      </Suspense>
      <div aria-hidden="true" className="h-24 lg:hidden" />
    </>
  )
}
