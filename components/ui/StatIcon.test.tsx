import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StatIcon } from './StatIcon'

import type { StatIconName } from './StatIcon'

const NAMES: StatIconName[] = [
  'steps',
  'flame',
  'walk',
  'swim',
  'scale',
  'calendar',
  'trash',
  'clock',
  'layers',
  'kettlebell',
  'dumbbell',
  'trophy',
  'chevron',
]

describe('StatIcon', () => {
  it.each(NAMES)('draws the %s icon', (name) => {
    const { container } = render(<StatIcon name={name} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('data-icon', name)
    expect(svg?.childElementCount).toBeGreaterThan(0)
  })

  it('hides the icon from assistive technology', () => {
    const { container } = render(<StatIcon name="steps" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('focusable', 'false')
  })

  it('takes its colour from the text colour', () => {
    const { container } = render(<StatIcon name="flame" className="text-warn" />)
    expect(container.querySelector('svg')).toHaveClass('stroke-current', 'text-warn')
  })
})
