'use client'

import { useEffect, useState } from 'react'

import { copyText, reloadPage } from '../../lib/errors/browser'
import { currentRoute, errorText, reportError } from '../../lib/errors/report'
import { Card } from '../ui/Card'
import { MicroLabel } from '../ui/MicroLabel'
import { PrimaryButton } from '../ui/PrimaryButton'
import { SecondaryButton } from '../ui/SecondaryButton'

export const ERROR_TITLE = 'Something went wrong.'

export const ERROR_BODY = 'Your data is safe on this device.'

export const COPIED = 'The error is copied.'

export const COPY_FAILED = 'The error could not be copied.'

type CopyState = 'idle' | 'copied' | 'failed'

const COPY_TEXT: Record<CopyState, string> = {
  idle: '',
  copied: COPIED,
  failed: COPY_FAILED,
}

export type ErrorScreenProps = {
  error: Error & { digest?: string }
  reload?: () => void
  copy?: (text: string) => Promise<void>
}

export function ErrorScreenView({ error, reload = reloadPage, copy = copyText }: ErrorScreenProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle')

  function copyError(): void {
    void copy(errorText(error)).then(
      () => {
        setCopyState('copied')
      },
      () => {
        setCopyState('failed')
      },
    )
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <MicroLabel as="p">Error</MicroLabel>
      <h1 className="mt-2 text-[23px] leading-tight font-bold tracking-[-0.6px]">{ERROR_TITLE}</h1>
      <p className="text-muted mt-3 text-sm leading-relaxed">{ERROR_BODY}</p>
      <div className="mt-6 flex flex-col gap-2">
        <PrimaryButton
          onClick={() => {
            reload()
          }}
        >
          Reload
        </PrimaryButton>
        <SecondaryButton onClick={copyError}>Copy error</SecondaryButton>
      </div>
      <p
        role="status"
        className={copyState === 'failed' ? 'text-danger mt-2 text-xs' : 'text-muted mt-2 text-xs'}
      >
        {COPY_TEXT[copyState]}
      </p>
    </Card>
  )
}

export function ErrorScreen(props: ErrorScreenProps) {
  const { error } = props

  useEffect(() => {
    reportError(error, { route: currentRoute(), source: 'boundary' })
  }, [error])

  return <ErrorScreenView {...props} />
}
