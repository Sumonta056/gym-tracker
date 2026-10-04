'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { EmailField } from '../../../components/ui/EmailField'
import { Field } from '../../../components/ui/Field'
import { PasswordField } from '../../../components/ui/PasswordField'
import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import { signUp } from '../../../lib/auth/actions'
import { signUpSchema } from '../../../lib/schema/signUp'
import { AuthHeader } from '../AuthHeader'

import type { ReactNode } from 'react'

type FieldName = 'name' | 'email' | 'password'

type FieldErrors = Partial<Record<FieldName, ReactNode>>

const EXISTS = (
  <>
    An account with this email exists.{' '}
    <Link href="/sign-in" className="inline-flex min-h-11 items-center font-bold underline">
      Sign in instead.
    </Link>
  </>
)

function isFieldName(key: PropertyKey | undefined): key is FieldName {
  return key === 'name' || key === 'email' || key === 'password'
}

export function SignUpForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  function clear(field: FieldName): void {
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  async function submit(): Promise<void> {
    setMessage(null)
    const input = { name, email, password }
    const parsed = signUpSchema.safeParse(input)

    if (!parsed.success) {
      const found: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (isFieldName(field) && found[field] === undefined) found[field] = issue.message
      }
      setErrors(found)
      return
    }

    setErrors({})
    setCreating(true)

    const result = await signUp(input)

    if (result.status === 'signed-in') {
      router.replace('/')
      router.refresh()
      return
    }

    if (result.status === 'needs-code') {
      router.replace(`/verify?${new URLSearchParams({ email: result.email }).toString()}`)
      return
    }

    if (result.status === 'exists') {
      setErrors({ email: EXISTS })
    } else {
      setMessage(result.message)
    }
    setCreating(false)
  }

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
        <Field
          label="Name"
          type="text"
          autoComplete="name"
          placeholder="Your name"
          value={name}
          disabled={creating}
          error={errors.name}
          onChange={(event) => {
            setName(event.target.value)
            clear('name')
          }}
        />

        <EmailField
          label="Email"
          placeholder="you@example.com"
          value={email}
          disabled={creating}
          error={errors.email}
          onChange={(event) => {
            setEmail(event.target.value)
            clear('email')
          }}
        />

        <PasswordField
          label="Password"
          autoComplete="new-password"
          placeholder="Choose a password"
          hint="8 or more characters"
          value={password}
          disabled={creating}
          error={errors.password}
          onChange={(event) => {
            setPassword(event.target.value)
            clear('password')
          }}
        />

        {message === null ? null : (
          <p role="alert" className="text-danger text-center text-[13px]">
            {message}
          </p>
        )}

        <PrimaryButton type="submit" disabled={creating} aria-busy={creating}>
          {creating ? 'Creating account…' : 'Create account'}
        </PrimaryButton>
      </form>

      <p className="text-muted text-center text-[13px]">
        Have an account?{' '}
        <Link
          href="/sign-in"
          className="text-text inline-flex min-h-11 items-center font-bold underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
