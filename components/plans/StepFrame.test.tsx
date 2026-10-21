import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { endAlt, PLAY_HALF_MS, startAlt, StepFrame } from './StepFrame'

const STEP = {
  name: 'Flat Dumbbell Press',
  images: {
    start: '/exercises/flat-dumbbell-press-start.webp',
    end: '/exercises/flat-dumbbell-press-end.webp',
  },
  muscles: { primary: ['chest' as const], secondary: ['shoulders' as const, 'triceps' as const] },
}

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reduce, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
}

function viewButton(name: string) {
  return within(screen.getByRole('group', { name: 'Image view' })).getByRole('button', { name })
}

function caption() {
  return document.querySelector('figcaption')
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('StepFrame', () => {
  it('opens on How to with 2 view buttons and only How to pressed', () => {
    mockReducedMotion(false)
    render(<StepFrame step={STEP} />)

    const buttons = within(screen.getByRole('group', { name: 'Image view' })).getAllByRole('button')
    expect(buttons.map((button) => button.textContent)).toEqual(['How to', 'Muscles'])
    expect(viewButton('How to')).toHaveAttribute('aria-pressed', 'true')
    expect(viewButton('Muscles')).toHaveAttribute('aria-pressed', 'false')
    expect(document.querySelector('figure')).toHaveAttribute('data-view', 'howto')
  })

  it('opens on the view it is given', () => {
    render(<StepFrame step={STEP} initialView="muscles" />)

    expect(viewButton('Muscles')).toHaveAttribute('aria-pressed', 'true')
    expect(document.querySelector('figure')).toHaveAttribute('data-view', 'muscles')
    expect(
      screen.getByRole('img', { name: 'Main: Chest. Helpers: Shoulders, Triceps.' }),
    ).toBeInTheDocument()
  })

  it('puts the 2 view buttons on a 16 by 9 image, each 44 px tall', () => {
    render(<StepFrame step={STEP} className="-mx-4" />)

    const figure = document.querySelector('figure')
    expect(figure).toHaveClass('aspect-[16/9]', '-mx-4')
    expect(figure).toContainElement(screen.getByRole('group', { name: 'Image view' }))
    expect(viewButton('How to')).toHaveClass('min-h-11')
    expect(viewButton('Muscles')).toHaveClass('min-h-11')
  })

  it('fills the pressed view button with the accent', () => {
    render(<StepFrame step={STEP} />)

    expect(viewButton('How to')).toHaveClass('bg-accent', 'text-accent-ink')
    expect(viewButton('Muscles')).toHaveClass('text-text')
  })

  it('gives the 2 images their alt texts', () => {
    render(<StepFrame step={STEP} />)

    expect(screen.getByAltText(startAlt(STEP.name)).getAttribute('src')).toMatch(
      new RegExp(`${STEP.images.start}$`),
    )
    expect(screen.getByAltText(endAlt(STEP.name)).getAttribute('src')).toMatch(
      new RegExp(`${STEP.images.end}$`),
    )
    expect(startAlt(STEP.name)).toBe('Flat Dumbbell Press, start position')
    expect(endAlt(STEP.name)).toBe('Flat Dumbbell Press, end position')
  })

  it('shows the muscle map in the same box on Muscles, and goes back on How to', () => {
    render(<StepFrame step={STEP} />)
    fireEvent.click(viewButton('Muscles'))

    expect(viewButton('Muscles')).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('img', { name: 'Main: Chest. Helpers: Shoulders, Triceps.' }),
    ).toBeInTheDocument()
    expect(screen.queryByAltText(startAlt(STEP.name))).toBeNull()
    expect(document.querySelector('figure')).toHaveClass('aspect-[16/9]')

    fireEvent.click(viewButton('How to'))
    expect(screen.getByAltText(startAlt(STEP.name))).toBeInTheDocument()
  })

  it('fades start to end and back on How to, with no caption on the image', () => {
    mockReducedMotion(false)
    vi.useFakeTimers()
    render(<StepFrame step={STEP} />)

    expect(caption()).toBeNull()
    expect(screen.getByAltText(startAlt(STEP.name))).toHaveClass('opacity-100')
    act(() => {
      vi.advanceTimersByTime(PLAY_HALF_MS)
    })
    expect(caption()).toBeNull()
    expect(screen.getByAltText(endAlt(STEP.name))).toHaveClass('opacity-100')
    act(() => {
      vi.advanceTimersByTime(PLAY_HALF_MS)
    })
    expect(screen.getByAltText(startAlt(STEP.name))).toHaveClass('opacity-100')
    expect(caption()).toBeNull()
  })

  it('pauses on a tap on the frame, and plays on a second tap', () => {
    mockReducedMotion(false)
    vi.useFakeTimers()
    render(<StepFrame step={STEP} />)

    const frame = screen.getByRole('button', { name: 'Pause the movement' })
    fireEvent.click(frame)
    expect(frame).toHaveAttribute('aria-pressed', 'true')
    act(() => {
      vi.advanceTimersByTime(PLAY_HALF_MS * 3)
    })
    expect(screen.getByAltText(startAlt(STEP.name))).toHaveClass('opacity-100')

    fireEvent.click(frame)
    act(() => {
      vi.advanceTimersByTime(PLAY_HALF_MS)
    })
    expect(screen.getByAltText(endAlt(STEP.name))).toHaveClass('opacity-100')
  })

  it('shows End still on How to under reduced motion, with nothing to pause', () => {
    mockReducedMotion(true)
    vi.useFakeTimers()
    render(<StepFrame step={STEP} />)

    expect(screen.getByAltText(endAlt(STEP.name))).toHaveClass('opacity-100')
    expect(screen.queryByRole('button', { name: 'Pause the movement' })).toBeNull()
    act(() => {
      vi.advanceTimersByTime(PLAY_HALF_MS * 3)
    })
    expect(screen.getByAltText(endAlt(STEP.name))).toHaveClass('opacity-100')
    expect(caption()).toBeNull()
  })

  it('keeps the box and shows the name when an image fails', () => {
    render(<StepFrame step={STEP} />)
    fireEvent.error(screen.getByAltText(startAlt(STEP.name)))

    expect(screen.getByTestId('frame-failed')).toHaveTextContent(STEP.name)
    expect(document.querySelector('figure')).toHaveClass('aspect-[16/9]', 'bg-surface-2')
    expect(screen.queryByAltText(endAlt(STEP.name))).toBeNull()
  })
})
