import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MIN_BAR_PERCENT, VolumeBar, volumeBarLabel, volumeShare } from './VolumeBar'

describe('volumeShare', () => {
  it('returns the session volume as a percent of the biggest', () => {
    expect(volumeShare(1710, 3420)).toBe(50)
  })

  it('returns 0 when the biggest session has no volume', () => {
    expect(volumeShare(0, 0)).toBe(0)
  })

  it('caps the share at 100', () => {
    expect(volumeShare(5000, 3420)).toBe(100)
  })

  it('never goes below 0', () => {
    expect(volumeShare(-10, 3420)).toBe(0)
  })
})

describe('volumeBarLabel', () => {
  it('rounds the share and names the biggest session', () => {
    expect(volumeBarLabel(78.6)).toBe('79% of your biggest session')
  })
})

describe('VolumeBar', () => {
  it('is an image with a text alternative', () => {
    render(<VolumeBar volumeKg={2700} maxKg={3420} />)
    expect(screen.getByRole('img')).toHaveAccessibleName('79% of your biggest session')
  })

  it('fills the bar to the share in the cyan token', () => {
    render(<VolumeBar volumeKg={1710} maxKg={3420} />)
    const fill = screen.getByTestId('volume-fill')
    expect(fill).toHaveStyle({ width: '50%' })
    expect(fill).toHaveClass('bg-data-cyan')
  })

  it('keeps a small session visible at the floor width', () => {
    render(<VolumeBar volumeKg={1} maxKg={3420} />)
    expect(screen.getByTestId('volume-fill')).toHaveStyle({ width: `${String(MIN_BAR_PERCENT)}%` })
  })

  it('draws a 4 px track on the second surface', () => {
    render(<VolumeBar volumeKg={1} maxKg={2} className="mt-1" />)
    expect(screen.getByRole('img')).toHaveClass('bg-surface-2', 'h-1', 'mt-1')
  })
})
