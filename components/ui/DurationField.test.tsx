import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DurationField } from './DurationField'
import { FIELD_INPUT_CLASS } from './Field'

function setup(value: number | null = null) {
  const onValueChange = vi.fn()
  render(<DurationField label="Gym time" value={value} onValueChange={onValueChange} />)
  return { input: screen.getByLabelText('Gym time'), onValueChange }
}

describe('DurationField', () => {
  it('ties its label to its input', () => {
    const { input } = setup()
    expect(input).toBeInstanceOf(HTMLInputElement)
  })

  it('shows the formatted value it is given', () => {
    const { input } = setup(4325)
    expect(input).toHaveValue('1:12:05')
  })

  it('reports the seconds for a clock string', async () => {
    const { input, onValueChange } = setup()
    await userEvent.type(input, '1:12:05')
    await userEvent.tab()
    expect(onValueChange).toHaveBeenCalledWith(4325)
  })

  it('reports the seconds for a minutes string', async () => {
    const { input, onValueChange } = setup()
    await userEvent.type(input, '72m')
    await userEvent.tab()
    expect(onValueChange).toHaveBeenCalledWith(4320)
  })

  it('reports the seconds for an hours and minutes string', async () => {
    const { input, onValueChange } = setup()
    await userEvent.type(input, '1h 12m')
    await userEvent.tab()
    expect(onValueChange).toHaveBeenCalledWith(4320)
  })

  it('normalises the text it shows on blur', async () => {
    const { input } = setup()
    await userEvent.type(input, '72m')
    await userEvent.tab()
    expect(input).toHaveValue('1:12:00')
  })

  it('reports null for an empty field', async () => {
    const { input, onValueChange } = setup()
    await userEvent.click(input)
    await userEvent.tab()
    expect(onValueChange).toHaveBeenCalledWith(null)
  })

  it('marks an unparseable value as invalid', async () => {
    const { input, onValueChange } = setup()
    await userEvent.type(input, 'about an hour')
    await userEvent.tab()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(onValueChange).toHaveBeenCalledWith(null)
    expect(screen.getByText(/Enter a duration/)).toBeInTheDocument()
  })

  it('clears the error once the user types again', async () => {
    const { input } = setup()
    await userEvent.type(input, 'nope')
    await userEvent.tab()
    await userEvent.type(input, '5')
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('is 52 px tall and uses the input radius token', () => {
    const { input } = setup()
    expect(input).toHaveClass('h-[52px]')
    expect(input).toHaveClass('rounded-input')
  })

  it('wears the one shared input skin, so it cannot drift from the other fields', () => {
    const { input } = setup()
    expect(input).toHaveClass(...FIELD_INPUT_CLASS.split(' '))
  })

  it('announces its error, like every other field', async () => {
    const { input } = setup()
    await userEvent.type(input, 'nope')
    await userEvent.tab()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a duration such as 1:12:05, 72m or 1h 12m.',
    )
  })
})
