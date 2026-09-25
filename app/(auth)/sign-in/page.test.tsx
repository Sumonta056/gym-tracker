import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import SignInPage, { metadata } from './page'

vi.mock('../../../lib/auth/actions', () => ({
  sendMagicLink: vi.fn(),
  signInWithPassword: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}))

describe('the sign in page', () => {
  it('names the app as its heading', () => {
    render(<SignInPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Gym Tracker' })).toBeInTheDocument()
  })

  it('offers the password form with the magic link as a fallback', () => {
    render(<SignInPage />)
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Email me a link instead' })).toBeInTheDocument()
  })

  it('carries a page title', () => {
    expect(metadata.title).toBe('Sign in — Gym Tracker')
  })
})
