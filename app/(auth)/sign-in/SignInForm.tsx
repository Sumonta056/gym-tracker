'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { BrandMark } from '../../../components/ui/BrandMark'
import { Card } from '../../../components/ui/Card'
import { EmailField } from '../../../components/ui/EmailField'
import { MicroLabel } from '../../../components/ui/MicroLabel'
import { PasswordField } from '../../../components/ui/PasswordField'
import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import { SecondaryButton } from '../../../components/ui/SecondaryButton'
import { sendMagicLink, signInWithPassword } from '../../../lib/auth/actions'
import { isValidEmail } from '../../../lib/auth/email'

type Mode = 'password' | 'link'

type Status = 'idle' | 'sending' | 'sent'

type PasswordStatus = 'idle' | 'signing-in'

const INVALID_EMAIL = 'Enter an email address like you@example.com.'
const EMPTY_PASSWORD = 'Enter your password.'

export function SignInForm() {
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')

  if (mode === 'password') {
    return (
      <PasswordSignIn
        email={email}
        onEmailChange={setEmail}
        onUseLink={() => {
          setMode('link')
        }}
      />
    )
  }

  return (
    <MagicLinkSignIn
      email={email}
      onEmailChange={setEmail}
      onUsePassword={() => {
        setMode('password')
      }}
    />
  )
}

type PasswordSignInProps = {
  email: string
  onEmailChange: (email: string) => void
  onUseLink: () => void
}

function PasswordSignIn({ email, onEmailChange, onUseLink }: PasswordSignInProps) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [status, setStatus] = useState<PasswordStatus>('idle')

  async function submit(): Promise<void> {
    const badEmail = !isValidEmail(email)
    const noPassword = password === ''
    setEmailError(badEmail ? INVALID_EMAIL : null)
    setPasswordError(noPassword ? EMPTY_PASSWORD : null)
    if (badEmail || noPassword) return

    setStatus('signing-in')

    const result = await signInWithPassword(email, password)

    if (result.status === 'error') {
      setPasswordError(result.message)
      setStatus('idle')
      return
    }

    router.replace('/')
    router.refresh()
  }

  const signingIn = status === 'signing-in'

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
          autoComplete="username"
          value={email}
          disabled={signingIn}
          error={emailError ?? undefined}
          onChange={(event) => {
            onEmailChange(event.target.value)
            setEmailError(null)
          }}
        />

        <PasswordField
          label="Password"
          placeholder="Your password"
          value={password}
          disabled={signingIn}
          error={passwordError ?? undefined}
          onChange={(event) => {
            setPassword(event.target.value)
            setPasswordError(null)
          }}
        />

        <PrimaryButton type="submit" disabled={signingIn} aria-busy={signingIn}>
          {signingIn ? 'Signing in…' : 'Sign in'}
        </PrimaryButton>
      </form>

      <SecondaryButton type="button" disabled={signingIn} onClick={onUseLink}>
        Email me a link instead
      </SecondaryButton>

      <InstallCard />
    </div>
  )
}

type MagicLinkSignInProps = {
  email: string
  onEmailChange: (email: string) => void
  onUsePassword: () => void
}

function MagicLinkSignIn({ email, onEmailChange, onUsePassword }: MagicLinkSignInProps) {
  const confirmation = useRef<HTMLDivElement>(null)
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
          type="button"
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
            onEmailChange(event.target.value)
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

      <SecondaryButton type="button" disabled={sending} onClick={onUsePassword}>
        Use password instead
      </SecondaryButton>

      <InstallCard />
    </div>
  )
}

function InstallCard() {
  return (
    <Card className="mt-2 flex flex-col gap-2">
      <MicroLabel as="p">Install on iPhone</MicroLabel>
      <p className="text-muted text-[13px] leading-relaxed">
        Open in Safari, tap <span className="text-text font-semibold">Share</span>, then{' '}
        <span className="text-text font-semibold">Add to Home Screen</span>. The app then opens full
        screen and logs offline.
      </p>
    </Card>
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
