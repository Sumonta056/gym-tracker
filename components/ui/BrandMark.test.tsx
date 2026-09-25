import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BrandMark } from './BrandMark'

describe('BrandMark', () => {
  it('shows the initials', () => {
    render(<BrandMark />)
    expect(screen.getByText('GT')).toBeInTheDocument()
  })

  it('is hidden from assistive technology, because the title carries the name', () => {
    render(<BrandMark />)
    expect(screen.getByText('GT')).toHaveAttribute('aria-hidden', 'true')
  })

  it('takes an extra class from its caller', () => {
    render(<BrandMark className="mb-[18px]" />)
    expect(screen.getByText('GT')).toHaveClass('mb-[18px]')
  })
})
