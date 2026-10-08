'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { SessionDetail } from './SessionDetail'
import { SessionList } from './SessionList'
import { HISTORY_PAGE, useHistory, useSessionView } from './useWorkoutHistory'

export const UNKNOWN_SESSION = 'That session is not on this device.'

export const RUNNING_SESSION = 'That session is still running. Resume it above.'

export const HISTORY_READ_FAILED = 'The sessions on this device could not be read.'

function Reading() {
  return (
    <p role="status" className="text-muted mt-6 text-sm">
      Reading this device…
    </p>
  )
}

function Failed() {
  return (
    <p role="alert" className="text-danger mt-6 text-sm">
      {HISTORY_READ_FAILED}
    </p>
  )
}

function HistorySection({ note }: { note: string | null }) {
  const [limit, setLimit] = useState(HISTORY_PAGE)
  const list = useHistory(limit)

  if (list === undefined) return <Reading />
  if (list === null) return <Failed />

  return (
    <SessionList
      list={list}
      note={note}
      onMore={() => {
        setLimit((held) => held + HISTORY_PAGE)
      }}
    />
  )
}

function SessionSection({ id }: { id: string }) {
  const view = useSessionView(id)

  if (view === undefined) return <Reading />
  if (view === null) return <Failed />
  if (view.status === 'found') return <SessionDetail view={view} />

  return <HistorySection note={view.status === 'missing' ? UNKNOWN_SESSION : RUNNING_SESSION} />
}

export function WorkoutHistory() {
  const id = useSearchParams().get('session')

  return id === null || id === '' ? <HistorySection note={null} /> : <SessionSection id={id} />
}
