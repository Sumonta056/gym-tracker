import { SignUpForm } from './SignUpForm'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Create account — Gym Tracker',
}

export default function SignUpPage() {
  return <SignUpForm />
}
