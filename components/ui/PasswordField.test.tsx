import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PasswordField } from './PasswordField'

describe('PasswordField', () => {
  it('ties the label to the input', () => {
    render(<PasswordField label="Password" />)
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('masks what the user types', () => {
    render(<PasswordField label="Password" />)
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
  })

  it('offers the saved password to autofill', () => {
    render(<PasswordField label="Password" />)
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password')
  })

  it('takes a different autofill hint from its caller', () => {
    render(<PasswordField label="Password" autoComplete="new-password" />)
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password')
  })

  it('carries no error state by default', () => {
    render(<PasswordField label="Password" />)
    const field = screen.getByLabelText('Password')
    expect(field).not.toHaveAttribute('aria-invalid')
    expect(field).not.toHaveAttribute('aria-describedby')
  })

  it('marks the input invalid and ties the message to it', () => {
    render(<PasswordField label="Password" error="Enter your password." />)
    const field = screen.getByLabelText('Password')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('Enter your password.')
  })

  it('announces the error', () => {
    render(<PasswordField label="Password" error="Enter your password." />)
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your password.')
  })

  it('takes an id from its caller', () => {
    render(<PasswordField label="Password" id="given" />)
    expect(screen.getByLabelText('Password')).toHaveAttribute('id', 'given')
  })
})
