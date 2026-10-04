'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Card } from '../../../components/ui/Card'
import { EmailField } from '../../../components/ui/EmailField'
import { MicroLabel } from '../../../components/ui/MicroLabel'
import { PasswordField } from '../../../components/ui/PasswordField'
import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import { signInWithPassword } from '../../../lib/auth/actions'
import { isValidEmail } from '../../../lib/auth/email'
import { AuthHeader } from '../AuthHeader'

type PasswordStatus = 'idle' | 'signing-in'

const INVALID_EMAIL = 'Enter an email address like you@example.com.'
const EMPTY_PASSWORD = 'Enter your password.'

export function SignInForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
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
      <AuthHeader />
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
            setEmail(event.target.value)
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

      <p className="text-muted text-center text-[13px]">
        New here?{' '}
        <Link
          href="/sign-up"
          className="text-text inline-flex min-h-11 items-center font-bold underline"
        >
          Create an account
        </Link>
      </p>

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
