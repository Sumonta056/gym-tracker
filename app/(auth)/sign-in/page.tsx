import { SignInForm } from './SignInForm'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign in — Gym Tracker',
}

export default function SignInPage() {
  return <SignInForm />
}
