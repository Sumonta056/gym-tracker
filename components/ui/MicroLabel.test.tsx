import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MicroLabel } from './MicroLabel'

describe('MicroLabel', () => {
  it('renders its text', () => {
    render(<MicroLabel>Gym time</MicroLabel>)
    expect(screen.getByText('Gym time')).toBeInTheDocument()
  })

  it('uses the muted token, upper case and the tracking step', () => {
    render(<MicroLabel>Gym time</MicroLabel>)
    const label = screen.getByText('Gym time')
    expect(label).toHaveClass('text-muted')
    expect(label).toHaveClass('uppercase')
    expect(label).toHaveClass('tracking-[1.5px]')
    expect(label).toHaveClass('font-bold')
  })

  it('narrows the tracking for a tab label, and writes only one tracking class', () => {
    render(<MicroLabel tracking="tab">Today</MicroLabel>)
    const label = screen.getByText('Today')
    expect(label).toHaveClass('tracking-[0.6px]')
    expect(label).not.toHaveClass('tracking-[1.5px]')
  })

  it('keeps a caller class name', () => {
    render(<MicroLabel className="mb-2">Gym time</MicroLabel>)
    expect(screen.getByText('Gym time')).toHaveClass('mb-2')
  })
})
