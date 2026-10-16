import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TextAreaField } from './TextAreaField'

describe('TextAreaField', () => {
  it('ties the label to the text area', () => {
    render(<TextAreaField label="Note" />)
    const area = screen.getByRole('textbox', { name: 'Note' })
    expect(area.tagName).toBe('TEXTAREA')
  })

  it('opens two rows tall by default', () => {
    render(<TextAreaField label="Note" />)
    expect(screen.getByLabelText('Note')).toHaveAttribute('rows', '2')
  })

  it('takes a row count from its caller', () => {
    render(<TextAreaField label="Note" rows={4} />)
    expect(screen.getByLabelText('Note')).toHaveAttribute('rows', '4')
  })

  it('grows with its content up to a ceiling, with no resize handle', () => {
    render(<TextAreaField label="Note" />)
    expect(screen.getByLabelText('Note')).toHaveClass(
      '[field-sizing:content]',
      'max-h-40',
      'min-h-[74px]',
      'resize-none',
    )
  })

  it('carries no error state by default', () => {
    render(<TextAreaField label="Note" />)
    const area = screen.getByLabelText('Note')
    expect(area).not.toHaveAttribute('aria-invalid')
    expect(area).not.toHaveAttribute('aria-describedby')
    expect(area).toHaveClass('border-border')
  })

  it('ties a hint to the text area', () => {
    render(<TextAreaField label="Note" hint="One line is enough." />)
    expect(screen.getByLabelText('Note')).toHaveAccessibleDescription('One line is enough.')
  })

  it('marks the text area invalid and announces the error tied to it', () => {
    render(<TextAreaField label="Note" error="Too long." />)
    const area = screen.getByLabelText('Note')
    expect(area).toHaveAttribute('aria-invalid', 'true')
    expect(area).toHaveAccessibleDescription('Too long.')
    expect(area).toHaveClass('border-danger')
    expect(screen.getByRole('alert')).toHaveTextContent('Too long.')
  })

  it('ties both the hint and the error to the text area', () => {
    render(<TextAreaField label="Note" hint="Optional." error="Too long." />)
    expect(screen.getByLabelText('Note')).toHaveAccessibleDescription('Optional. Too long.')
  })

  it('keeps a hidden label as the name when a heading already shows it', () => {
    render(<TextAreaField label="Note" hideLabel />)
    expect(screen.getByRole('textbox', { name: 'Note' })).toBeInTheDocument()
    expect(screen.getByText('Note')).toHaveClass('sr-only')
  })

  it('shows the label by default', () => {
    render(<TextAreaField label="Note" />)
    expect(screen.getByText('Note')).not.toHaveClass('sr-only')
  })

  it('takes an id from its caller', () => {
    render(<TextAreaField label="Note" id="given" />)
    expect(screen.getByLabelText('Note')).toHaveAttribute('id', 'given')
  })
})
