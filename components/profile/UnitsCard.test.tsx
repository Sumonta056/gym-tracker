import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { unitStatement, UnitsCard } from './UnitsCard'

describe('UnitsCard', () => {
  it('groups the two units under a label and presses the current one', () => {
    render(<UnitsCard unit="metric" onUnitChange={vi.fn()} />)
    expect(screen.getByRole('group', { name: 'Unit system' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Metric' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Imperial' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('states the current unit in text, not by colour alone', () => {
    render(<UnitsCard unit="imperial" onUnitChange={vi.fn()} />)
    expect(screen.getByText('Weight shows in pounds (lb).')).toBeInTheDocument()
  })

  it('says the toggle is display only', () => {
    render(<UnitsCard unit="metric" onUnitChange={vi.fn()} />)
    expect(
      screen.getByText('Display only. Weight is always stored in kilograms.'),
    ).toBeInTheDocument()
  })

  it('hands the chosen unit to its owner', async () => {
    const onUnitChange = vi.fn()
    render(<UnitsCard unit="metric" onUnitChange={onUnitChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Imperial' }))
    expect(onUnitChange).toHaveBeenCalledWith('imperial')
  })

  it('shows an error the owner reports', () => {
    render(<UnitsCard unit="metric" onUnitChange={vi.fn()} error="Not saved." />)
    expect(screen.getByRole('alert')).toHaveTextContent('Not saved.')
  })
})

describe('unitStatement', () => {
  it('names kilograms for metric', () => {
    expect(unitStatement('metric')).toBe('Weight shows in kilograms (kg).')
  })
})
