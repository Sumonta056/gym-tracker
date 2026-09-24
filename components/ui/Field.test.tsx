import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Field } from './Field'

describe('Field', () => {
  it('ties the label to the input', () => {
    render(<Field label="Weight" />)
    expect(screen.getByLabelText('Weight')).toBeInTheDocument()
  })

  it('carries no error state by default', () => {
    render(<Field label="Weight" />)
    const input = screen.getByLabelText('Weight')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).not.toHaveAttribute('aria-describedby')
  })

  it('ties a hint to the input', () => {
    render(<Field label="Weight" hint="In kilograms." />)
    expect(screen.getByLabelText('Weight')).toHaveAccessibleDescription('In kilograms.')
  })

  it('marks the input invalid and ties the message to it', () => {
    render(<Field label="Weight" error="Enter a number." />)
    const input = screen.getByLabelText('Weight')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Enter a number.')
  })

  it('announces the error', () => {
    render(<Field label="Weight" error="Enter a number." />)
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a number.')
  })

  it('ties both the hint and the error to the input', () => {
    render(<Field label="Weight" hint="In kilograms." error="Enter a number." />)
    expect(screen.getByLabelText('Weight')).toHaveAccessibleDescription(
      'In kilograms. Enter a number.',
    )
  })

  it('hides the adornment from assistive technology', () => {
    render(<Field label="Weight" adornment="kg" />)
    expect(screen.getByText('kg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('names the input with its unit, since the visible unit is hidden from assistive technology', () => {
    render(<Field label="Weight" adornment="kg" />)
    expect(screen.getByRole('textbox', { name: 'Weight, kg' })).toBeInTheDocument()
  })

  it('leaves the name alone when there is no unit', () => {
    render(<Field label="Weight" />)
    expect(screen.getByRole('textbox', { name: 'Weight' })).toBeInTheDocument()
  })

  it('sets the input at the recipe padding and a lighter placeholder', () => {
    render(<Field label="Weight" />)
    const input = screen.getByLabelText('Weight')
    expect(input).toHaveClass('px-3.5', 'placeholder:font-medium')
    expect(input).not.toHaveClass('px-4')
  })

  it('takes an id from its caller', () => {
    render(<Field label="Weight" id="given" />)
    expect(screen.getByLabelText('Weight')).toHaveAttribute('id', 'given')
  })
})
