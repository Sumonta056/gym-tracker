import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Badge, ReviewCell, ReviewValue } from './ReviewCell'

import type { ReviewCellProps } from './ReviewCell'

const READINGS = [
  { label: '15m 54s (as mm.ss)', seconds: 954 },
  { label: '15.54 min · 15m 32s', seconds: 932 },
]

function renderCell(overrides: Partial<ReviewCellProps> = {}) {
  const props: ReviewCellProps = {
    label: 'Walk time',
    raw: '15.54',
    readings: READINGS,
    pick: undefined,
    onPick: vi.fn(),
    similar: 2,
    others: 2,
    onApplySimilar: vi.fn(),
    ...overrides,
  }
  render(<ReviewCell {...props} />)
  return props
}

describe('ReviewCell', () => {
  it('offers both readings side by side as labelled buttons in a named group', () => {
    renderCell()
    const group = screen.getByRole('group', { name: 'Walk time 15.54 reads two ways. Pick one.' })
    expect(group).toBeInTheDocument()
    const first = screen.getByRole('button', {
      name: '15m 54s, read as minutes and seconds',
    })
    const second = screen.getByRole('button', {
      name: '15.54 min, read as decimal minutes, 15m 32s',
    })
    expect(first).toHaveAttribute('type', 'button')
    expect(second).toHaveAttribute('aria-pressed', 'false')
  })

  it('hands the picked reading to its owner', async () => {
    const props = renderCell()
    await userEvent.click(screen.getByRole('button', { name: /^15\.54 min/ }))
    expect(props.onPick).toHaveBeenCalledWith(1)
  })

  it('marks the picked reading as pressed', () => {
    renderCell({ pick: 0 })
    expect(screen.getByRole('button', { name: /^15m 54s/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps Apply to all similar disabled until a reading is picked', () => {
    renderCell()
    const apply = screen.getByRole('button', { name: 'Apply to all similar · 2 more' })
    expect(apply).toBeDisabled()
    expect(apply).toHaveAttribute('type', 'button')
    expect(apply).toHaveClass('bg-surface-2', 'min-h-11!')
  })

  it('applies to all similar once a reading is picked', async () => {
    const props = renderCell({ pick: 0 })
    await userEvent.click(screen.getByRole('button', { name: 'Apply to all similar · 2 more' }))
    expect(props.onApplySimilar).toHaveBeenCalledOnce()
  })

  it('disables Apply to all similar when every similar cell already holds the pick', () => {
    renderCell({ pick: 0, similar: 0 })
    expect(screen.getByRole('button', { name: 'Apply to all similar · 0 more' })).toBeDisabled()
  })

  it('shows no Apply to all similar when no other cell is similar', () => {
    renderCell({ others: 0, similar: 0 })
    expect(screen.queryByRole('button', { name: /Apply to all similar/ })).not.toBeInTheDocument()
  })
})

describe('ReviewValue', () => {
  it('marks an unpicked cell with the warn border and the word Check', () => {
    render(<ReviewValue raw="15.54" picked={null} />)
    const check = screen.getByText('Check')
    expect(check).toHaveClass('text-warn')
    expect(check.parentElement).toHaveClass('border-warn')
  })

  it('shows the picked value with no Check', () => {
    render(<ReviewValue raw="15.54" picked="15m 54s" />)
    expect(screen.getByText('15m 54s')).toHaveClass('border-border')
    expect(screen.queryByText('Check')).not.toBeInTheDocument()
  })
})

describe('Badge', () => {
  it('takes a danger tone', () => {
    render(<Badge tone="danger">Error</Badge>)
    expect(screen.getByText('Error')).toHaveClass('text-danger')
  })
})
