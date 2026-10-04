import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import SignUpPage, { metadata } from './page'

vi.mock('../../../lib/auth/actions', () => ({
  signUp: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}))

describe('the sign up page', () => {
  it('names the app as its heading', () => {
    render(<SignUpPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Gym Tracker' })).toBeInTheDocument()
  })

  it('offers the create account form', () => {
    render(<SignUpPage />)
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
  })

  it('carries a page title', () => {
    expect(metadata.title).toBe('Create account — Gym Tracker')
  })
})
