import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StatusChip } from './StatusChip'

describe('StatusChip', () => {
  it('renders SYNCED in the ok token', () => {
    render(<StatusChip status="synced" />)
    expect(screen.getByText('SYNCED')).toHaveClass('text-ok')
  })

  it('renders OFFLINE in the warn token', () => {
    render(<StatusChip status="offline" />)
    expect(screen.getByText('OFFLINE')).toHaveClass('text-warn')
  })

  it('renders SYNCING in the cyan data token', () => {
    render(<StatusChip status="syncing" />)
    expect(screen.getByText('SYNCING')).toHaveClass('text-data-cyan')
  })

  it('renders PENDING in the muted token', () => {
    render(<StatusChip status="pending" />)
    expect(screen.getByText('PENDING')).toHaveClass('text-muted')
  })

  it('exposes the chip as a status region', () => {
    render(<StatusChip status="synced" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('stays out of the live regions when a second chip on the screen already announces', () => {
    render(<StatusChip status="synced" announce={false} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByText('SYNCED')).toBeInTheDocument()
  })

  it('carries the meaning in words, not colour alone', () => {
    render(<StatusChip status="offline" />)
    expect(screen.getByRole('status')).toHaveTextContent('OFFLINE')
  })
})
