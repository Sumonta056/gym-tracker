import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EmailField } from './EmailField'

describe('EmailField', () => {
  it('ties the label to the input', () => {
    render(<EmailField label="Email" />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('asks the phone for the email keypad', () => {
    render(<EmailField label="Email" />)
    expect(screen.getByLabelText('Email')).toHaveAttribute('inputmode', 'email')
  })

  it('offers the saved address to autofill', () => {
    render(<EmailField label="Email" />)
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email')
  })

  it('carries no error state by default', () => {
    render(<EmailField label="Email" />)
    const field = screen.getByLabelText('Email')
    expect(field).not.toHaveAttribute('aria-invalid')
    expect(field).not.toHaveAttribute('aria-describedby')
  })

  it('ties a hint to the input', () => {
    render(<EmailField label="Email" hint="We only use it to sign you in." />)
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      'We only use it to sign you in.',
    )
  })

  it('marks the input invalid and ties the message to it', () => {
    render(<EmailField label="Email" error="Enter a valid address." />)
    const field = screen.getByLabelText('Email')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('Enter a valid address.')
  })

  it('announces the error', () => {
    render(<EmailField label="Email" error="Enter a valid address." />)
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid address.')
  })

  it('takes an id from its caller', () => {
    render(<EmailField label="Email" id="given" />)
    expect(screen.getByLabelText('Email')).toHaveAttribute('id', 'given')
  })
})
