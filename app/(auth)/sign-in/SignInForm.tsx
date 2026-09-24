'use client'

import { useEffect, useRef, useState } from 'react'

import { BrandMark } from '../../../components/ui/BrandMark'
import { Card } from '../../../components/ui/Card'
import { EmailField } from '../../../components/ui/EmailField'
import { MicroLabel } from '../../../components/ui/MicroLabel'
import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import { SecondaryButton } from '../../../components/ui/SecondaryButton'
import { sendMagicLink } from '../../../lib/auth/actions'
import { isValidEmail } from '../../../lib/auth/email'

type Status = 'idle' | 'sending' | 'sent'

const INVALID_EMAIL = 'Enter an email address like you@example.com.'

export function SignInForm() {
  const confirmation = useRef<HTMLDivElement>(null)
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')

  async function submit(): Promise<void> {
    if (!isValidEmail(email)) {
      setError(INVALID_EMAIL)
      setStatus('idle')
      return
    }

    setError(null)
    setStatus('sending')

    const result = await sendMagicLink(email)

    if (result.status === 'error') {
      setError(result.message)
      setStatus('idle')
      return
    }

    setSentTo(result.email)
    setStatus('sent')
  }

  useEffect(() => {
    if (status === 'sent') confirmation.current?.focus()
  }, [status])

  if (status === 'sent') {
    return (
      <div className="flex flex-col gap-3">
        <SignInHeader />
        <Card
          ref={confirmation}
          tabIndex={-1}
          role="status"
          className="flex flex-col gap-2 text-center"
        >
          <MicroLabel as="p">Check your email</MicroLabel>
          <p className="text-text min-w-0 text-base font-semibold break-words">{sentTo}</p>
          <p className="text-muted text-sm leading-relaxed">
            Open the link on the phone you want to log from. It signs you in and brings you straight
            back.
          </p>
        </Card>
        <SecondaryButton
          onClick={() => {
            setStatus('idle')
            setSentTo('')
          }}
        >
          Use a different email
        </SecondaryButton>
      </div>
    )
  }

  const sending = status === 'sending'

  return (
    <div className="flex flex-col gap-3">
      <SignInHeader />
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <EmailField
          label="Email"
          placeholder="you@example.com"
          value={email}
          disabled={sending}
          error={error ?? undefined}
          onChange={(event) => {
            setEmail(event.target.value)
            setError(null)
          }}
        />

        <PrimaryButton type="submit" disabled={sending} aria-busy={sending}>
          {sending ? 'Sending the link…' : 'Send magic link'}
        </PrimaryButton>
      </form>

      <p className="text-muted text-center text-[13px]">
        No password. The link signs you in for 30 days.
      </p>

      <Card className="mt-2 flex flex-col gap-2">
        <MicroLabel as="p">Install on iPhone</MicroLabel>
        <p className="text-muted text-[13px] leading-relaxed">
          Open in Safari, tap <span className="text-text font-semibold">Share</span>, then{' '}
          <span className="text-text font-semibold">Add to Home Screen</span>. The app then opens
          full screen and logs offline.
        </p>
      </Card>
    </div>
  )
}

function SignInHeader() {
  return (
    <div className="mb-2 flex flex-col items-center text-center">
      <BrandMark className="mb-[18px]" />
      <h1 className="text-text text-[23px] font-bold tracking-[-0.6px]">Gym Tracker</h1>
      <p className="text-muted mt-2 text-[13px]">One log. Works with no signal in the gym.</p>
    </div>
  )
}
