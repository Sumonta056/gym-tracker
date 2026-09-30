'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import {
  discardSession,
  getActiveSession,
  listSets,
  SignedOutOnThisDevice,
} from '../../lib/db/repository'
import { SecondaryButton } from '../ui/SecondaryButton'
import { SheetModal } from '../ui/SheetModal'

import { startedText } from './SessionTimer'

import type { WorkoutSession, WorkoutSet } from '../../lib/db/dexie'

export type ResumeSource = {
  getActiveSession: () => Promise<WorkoutSession | undefined>
  listSets: (sessionId: string) => Promise<WorkoutSet[]>
  discardSession: (id: string) => Promise<void>
}

export const REPOSITORY_RESUME_SOURCE: ResumeSource = {
  getActiveSession,
  listSets,
  discardSession,
}

export const WORKOUT_PATH = '/workout'

export const RESUME_TITLE = 'Session running'

export const CONFIRM_TITLE = 'Discard the session?'

export const DISCARD_FAILED = 'The session could not be discarded on this device.'

export function reloadPage(): void {
  window.location.reload()
}

export function discardText(setCount: number): string {
  const sets = setCount === 1 ? '1 set' : `${String(setCount)} sets`

  return `The session and its ${sets} are removed from every device. This cannot be undone.`
}

type Prompt =
  { step: 'closed' } | { step: 'ask' | 'confirm'; session: WorkoutSession; setCount: number }

export type ResumePromptProps = {
  source?: ResumeSource
  onDiscarded?: () => void
}

export function ResumePrompt({
  source = REPOSITORY_RESUME_SOURCE,
  onDiscarded = reloadPage,
}: ResumePromptProps) {
  const pathname = usePathname()
  const openedOn = useRef(pathname)
  const [prompt, setPrompt] = useState<Prompt>({ step: 'closed' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const body = useRef<HTMLDivElement>(null)
  const step = prompt.step

  useEffect(() => {
    if (step === 'confirm') {
      Array.from(body.current?.querySelectorAll<HTMLElement>('button') ?? [])
        .at(-1)
        ?.focus()
    }
  }, [step])

  useEffect(() => {
    if (openedOn.current === WORKOUT_PATH) {
      return
    }

    let live = true

    const read = async () => {
      const session = await source.getActiveSession()

      if (session === undefined) {
        return
      }

      const sets = await source.listSets(session.id)

      if (live) {
        setPrompt({ step: 'ask', session, setCount: sets.length })
      }
    }

    read().catch(() => undefined)

    return () => {
      live = false
    }
  }, [source])

  const close = () => {
    if (!busy) {
      setPrompt({ step: 'closed' })
      setError(null)
    }
  }

  const discard = (session: WorkoutSession) => {
    setBusy(true)
    setError(null)
    source.discardSession(session.id).then(
      () => {
        setBusy(false)
        setPrompt({ step: 'closed' })
        onDiscarded()
      },
      (cause: unknown) => {
        setBusy(false)
        setError(cause instanceof SignedOutOnThisDevice ? cause.message : DISCARD_FAILED)
      },
    )
  }

  const open = prompt.step !== 'closed'

  return (
    <SheetModal
      open={open}
      title={prompt.step === 'confirm' ? CONFIRM_TITLE : RESUME_TITLE}
      onClose={close}
    >
      {prompt.step === 'closed' ? null : (
        <div ref={body} className="flex flex-col gap-3">
          <p className="text-muted text-sm">
            {prompt.step === 'ask'
              ? `A session started at ${startedText(prompt.session.started_at)} is still running on this device.`
              : discardText(prompt.setCount)}
          </p>
          {error === null ? null : (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}
          {prompt.step === 'ask' ? (
            <>
              <Link
                href={WORKOUT_PATH}
                onClick={close}
                className="bg-accent text-accent-ink border-accent rounded-input inline-flex min-h-[54px] w-full items-center justify-center gap-2 border px-4 text-[15px] font-bold tracking-[-0.2px]"
              >
                Resume
              </Link>
              <SecondaryButton
                tone="danger"
                onClick={() => {
                  setPrompt({ ...prompt, step: 'confirm' })
                }}
              >
                Discard
              </SecondaryButton>
            </>
          ) : (
            <>
              <SecondaryButton
                tone="danger"
                disabled={busy}
                onClick={() => {
                  discard(prompt.session)
                }}
              >
                Discard session
              </SecondaryButton>
              <SecondaryButton
                disabled={busy}
                onClick={() => {
                  setError(null)
                  setPrompt({ ...prompt, step: 'ask' })
                }}
              >
                Keep the session
              </SecondaryButton>
            </>
          )}
        </div>
      )}
    </SheetModal>
  )
}
