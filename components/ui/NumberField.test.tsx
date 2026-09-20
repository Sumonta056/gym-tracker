import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { NumberField } from './NumberField'

describe('NumberField', () => {
  it('ties its label to its input', () => {
    render(<NumberField label="Weight" />)
    expect(screen.getByLabelText('Weight')).toBeInstanceOf(HTMLInputElement)
  })

  it('sets a decimal input mode for the phone keypad by default', () => {
    render(<NumberField label="Weight" />)
    expect(screen.getByLabelText('Weight')).toHaveAttribute('inputmode', 'decimal')
  })

  it('accepts a numeric input mode', () => {
    render(<NumberField label="Reps" inputMode="numeric" />)
    expect(screen.getByLabelText('Reps')).toHaveAttribute('inputmode', 'numeric')
  })

  it('is 52 px tall and uses the input radius token', () => {
    render(<NumberField label="Weight" />)
    const input = screen.getByLabelText('Weight')
    expect(input).toHaveClass('h-[52px]')
    expect(input).toHaveClass('rounded-input')
  })

  it('renders a unit suffix', () => {
    render(<NumberField label="Weight" unit="kg" />)
    expect(screen.getByText('kg')).toBeInTheDocument()
  })

  it('ties a hint to its input', () => {
    render(<NumberField label="Weight" id="weight" hint="Metric only" />)
    expect(screen.getByLabelText('Weight')).toHaveAccessibleDescription('Metric only')
  })

  it('marks an errored input as invalid and ties the message to it', () => {
    render(<NumberField label="Weight" id="weight" error="Enter a number" />)
    const input = screen.getByLabelText('Weight')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Enter a number')
    expect(input).toHaveClass('border-danger')
  })

  it('is not invalid without an error', () => {
    render(<NumberField label="Weight" />)
    expect(screen.getByLabelText('Weight')).not.toHaveAttribute('aria-invalid')
  })

  it('reports what the user types', async () => {
    const onChange = vi.fn()
    render(<NumberField label="Weight" onChange={onChange} />)
    await userEvent.type(screen.getByLabelText('Weight'), '82')
    expect(onChange).toHaveBeenCalled()
  })
})
