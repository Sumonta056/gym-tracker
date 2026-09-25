import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StatusChip } from './StatusChip'

describe('StatusChip', () => {
  it('marks synced with the ok dot', () => {
    const { container } = render(<StatusChip status="synced" />)
    expect(screen.getByText('Synced')).toBeInTheDocument()
    expect(container.querySelector('[aria-hidden="true"]')).toHaveClass('bg-ok')
  })

  it('marks offline with the warn dot', () => {
    const { container } = render(<StatusChip status="offline" />)
    expect(screen.getByText('Offline')).toBeInTheDocument()
    expect(container.querySelector('[aria-hidden="true"]')).toHaveClass('bg-warn')
  })

  it('marks syncing with the cyan data dot', () => {
    const { container } = render(<StatusChip status="syncing" />)
    expect(screen.getByText('Syncing')).toBeInTheDocument()
    expect(container.querySelector('[aria-hidden="true"]')).toHaveClass('bg-data-cyan')
  })

  it('marks pending with the muted dot', () => {
    const { container } = render(<StatusChip status="pending" />)
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(container.querySelector('[aria-hidden="true"]')).toHaveClass('bg-muted')
  })

  it('writes every word in the muted token, so only the dot carries the colour', () => {
    for (const status of ['synced', 'offline', 'syncing', 'pending'] as const) {
      const { unmount } = render(<StatusChip status={status} />)
      const word = screen.getByRole('status').lastElementChild
      expect(word).toHaveClass('text-muted')
      expect(word).not.toHaveClass('text-ok')
      expect(word).not.toHaveClass('text-warn')
      expect(word).not.toHaveClass('text-data-cyan')
      unmount()
    }
  })

  it('writes the word in normal case and lets the micro label upper-case it', () => {
    render(<StatusChip status="synced" />)
    const word = screen.getByText('Synced')
    expect(word.textContent).toBe('Synced')
    expect(word).toHaveClass('uppercase')
  })

  it('draws the recipe frame: surface fill, border, 28 px floor and 12 px sides', () => {
    render(<StatusChip status="synced" />)
    const chip = screen.getByRole('status')
    expect(chip).toHaveClass('bg-surface', 'border-border', 'border', 'rounded-full')
    expect(chip).toHaveClass('min-h-7', 'px-3')
    expect(chip).not.toHaveClass('bg-surface-2')
    expect(chip).not.toHaveClass('py-1')
  })

  it('keeps the dot at 6 px when the chip is squeezed', () => {
    const { container } = render(<StatusChip status="synced" />)
    expect(container.querySelector('[aria-hidden="true"]')).toHaveClass('size-1.5', 'shrink-0')
  })

  it('exposes the chip as a status region', () => {
    render(<StatusChip status="synced" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('stays out of the live regions when a second chip on the screen already announces', () => {
    render(<StatusChip status="synced" announce={false} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByText('Synced')).toBeInTheDocument()
  })

  it('carries the meaning in words, not colour alone', () => {
    render(<StatusChip status="offline" />)
    expect(screen.getByRole('status')).toHaveTextContent('Offline')
  })
})
