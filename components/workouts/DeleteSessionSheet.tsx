'use client'

import { useEffect, useId, useState } from 'react'

import { discardSession, SessionNotFound, SignedOutOnThisDevice } from '../../lib/db/repository'
import { SecondaryButton } from '../ui/SecondaryButton'
import { SheetModal } from '../ui/SheetModal'

import { DangerButton } from './DangerButton'
import { deleteBody, rowLine, rowTitle } from './historyText'

import type { WorkoutSession } from '../../lib/db/dexie'
import type { SessionStats } from '../../lib/metrics/sessionStats'
import type { UnitSystem } from '../../lib/schema/profile'

export const DELETE_TITLE = 'Delete this session?'

export const DELETE_FAILED = 'The session could not be deleted on this device.'

export type DeleteTarget = { session: WorkoutSession; stats: SessionStats }

export type Discard = (id: string) => Promise<void>

export type DeleteSessionSheetProps = {
  target: DeleteTarget | null
  unit: UnitSystem
  onClose: () => void
  onDeleted?: () => void
  discard?: Discard
}

export function DeleteSessionSheet({
  target,
  unit,
  onClose,
  onDeleted,
  discard = discardSession,
}: DeleteSessionSheetProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const keepId = useId()
  const bodyId = useId()
  const open = target !== null

  useEffect(() => {
    if (open) {
      document.getElementById(keepId)?.focus({ preventScroll: true })
    }
  }, [open, keepId])

  const close = () => {
    if (busy) return

    setError(null)
    onClose()
  }

  const confirm = () => {
    if (target === null || busy) return

    setBusy(true)
    setError(null)
    discard(target.session.id).then(
      () => {
        setBusy(false)
        onDeleted?.()
        onClose()
      },
      (cause: unknown) => {
        setBusy(false)

        if (cause instanceof SessionNotFound) {
          onDeleted?.()
          onClose()
          return
        }

        setError(cause instanceof SignedOutOnThisDevice ? cause.message : DELETE_FAILED)
      },
    )
  }

  return (
    <SheetModal
      open={open}
      title={DELETE_TITLE}
      closeDisabled={busy}
      describedBy={bodyId}
      onClose={close}
      footer={
        <div className="grid gap-2.5">
          <DangerButton disabled={busy} onClick={confirm}>
            {busy ? 'Deleting…' : 'Delete session'}
          </DangerButton>
          <SecondaryButton id={keepId} disabled={busy} onClick={close}>
            Keep it
          </SecondaryButton>
        </div>
      }
    >
      {target === null ? null : (
        <>
          <div className="bg-surface-2 rounded-input flex flex-col gap-1 px-3.5 py-3">
            <strong className="text-text text-[15px] font-bold">{rowTitle(target.session)}</strong>
            <span className="text-muted text-[13px]">{rowLine(target.stats, unit)}</span>
          </div>
          <p id={bodyId} className="text-muted mt-3.5 mb-1 text-sm leading-normal">
            {deleteBody(target.stats.setCount)}
          </p>
          {error === null ? null : (
            <p role="alert" className="text-danger mt-3 mb-2 text-sm">
              {error}
            </p>
          )}
        </>
      )}
    </SheetModal>
  )
}
