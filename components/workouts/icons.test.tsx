import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StarIcon, TrashIcon } from './icons'

describe('TrashIcon', () => {
  it('is hidden from assistive technology', () => {
    const { container } = render(<TrashIcon />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('strokes in the current colour and takes a class', () => {
    const { container } = render(<TrashIcon className="size-4" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('stroke', 'currentColor')
    expect(svg).toHaveClass('size-4')
  })
})

describe('StarIcon', () => {
  it('fills in the current colour and is hidden from assistive technology', () => {
    const { container } = render(<StarIcon />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('fill', 'currentColor')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })
})
