import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { durationPreview, DurationField } from './DurationField'
import { FIELD_INPUT_CLASS } from './Field'

function Harness({ initial = '', error }: { initial?: string; error?: string }) {
  const [text, setText] = useState(initial)

  return (
    <DurationField
      label="Gym time"
      value={text}
      error={error}
      onChange={(event) => {
        setText(event.target.value)
      }}
    />
  )
}

function setup(initial = '', error?: string) {
  render(<Harness initial={initial} error={error} />)
  return { input: screen.getByLabelText('Gym time') }
}

describe('durationPreview', () => {
  it('returns null for an empty string', () => {
    expect(durationPreview('   ')).toBeNull()
  })

  it('returns null for text that cannot be parsed', () => {
    expect(durationPreview('about an hour')).toBeNull()
  })

  it('returns the clock and the short form for a parsed duration', () => {
    expect(durationPreview('72m')).toBe('1:12:00 · 1h 12m')
  })
})

describe('DurationField', () => {
  it('ties its label to its input', () => {
    const { input } = setup()
    expect(input).toBeInstanceOf(HTMLInputElement)
  })

  it('shows the accepted formats as its hint', () => {
    setup()
    expect(screen.getByText(/Accepts 1:12:05, 72m or 1h 12m\./)).toBeInTheDocument()
  })

  it('shows the parsed value under the field as the user types', async () => {
    const { input } = setup()
    await userEvent.type(input, '72m')
    expect(screen.getByText('1:12:00 · 1h 12m')).toBeInTheDocument()
  })

  it('shows no parsed value while the text cannot be parsed', async () => {
    const { input } = setup()
    await userEvent.type(input, 'nope')
    expect(screen.queryByText(/·/)).not.toBeInTheDocument()
  })

  it('keeps the text the caller gives it', () => {
    const { input } = setup('1:12:05')
    expect(input).toHaveValue('1:12:05')
  })

  it('marks itself invalid and names the problem when the caller passes an error', () => {
    const { input } = setup('nope', 'Enter a duration such as 1:12:05, 72m or 1h 12m.')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a duration such as 1:12:05, 72m or 1h 12m.',
    )
  })

  it('ties its error to its input', () => {
    const { input } = setup('nope', 'Enter a duration.')
    const describedBy = input.getAttribute('aria-describedby') ?? ''
    expect(describedBy).toContain(`${input.id}-error`)
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
})
