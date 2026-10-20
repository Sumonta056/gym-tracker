import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { END_CAPTION, endAlt, PLAY_HALF_MS, START_CAPTION, startAlt, StepFrame } from './StepFrame'

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
  it('opens on Play with 4 view buttons and only Play pressed', () => {
    mockReducedMotion(false)
    render(<StepFrame step={STEP} />)

    const buttons = within(screen.getByRole('group', { name: 'Image view' })).getAllByRole('button')
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Start',
      'End',
      '▶ Play',
      'Muscles',
    ])
    expect(viewButton('Play')).toHaveAttribute('aria-pressed', 'true')
    expect(viewButton('Start')).toHaveAttribute('aria-pressed', 'false')
    expect(document.querySelector('figure')).toHaveAttribute('data-view', 'play')
  })

  it('makes each view button 40 px tall inside a padded track', () => {
    render(<StepFrame step={STEP} />)

    expect(viewButton('End')).toHaveClass('min-h-10')
    expect(screen.getByRole('group', { name: 'Image view' })).toHaveClass('p-1')
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

  it('shows the start image with 1 · Start on Start', () => {
    render(<StepFrame step={STEP} />)
    fireEvent.click(viewButton('Start'))

    expect(viewButton('Start')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByAltText(startAlt(STEP.name))).toHaveClass('opacity-100')
    expect(screen.getByAltText(endAlt(STEP.name))).toHaveClass('opacity-0')
    expect(caption()).toHaveTextContent(START_CAPTION)
    expect(caption()).toHaveClass('bg-ground')
  })

  it('shows the end image with 2 · End on the accent on End', () => {
    render(<StepFrame step={STEP} />)
    fireEvent.click(viewButton('End'))

    expect(screen.getByAltText(endAlt(STEP.name))).toHaveClass('opacity-100')
    expect(caption()).toHaveTextContent(END_CAPTION)
    expect(caption()).toHaveClass('bg-accent', 'text-accent-ink')
  })

  it('shows the muscle map in the same box on Muscles', () => {
    render(<StepFrame step={STEP} />)
    fireEvent.click(viewButton('Muscles'))

    expect(viewButton('Muscles')).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('img', { name: 'Main: Chest. Helpers: Shoulders, Triceps.' }),
    ).toBeInTheDocument()
    expect(screen.queryByAltText(startAlt(STEP.name))).toBeNull()
    expect(document.querySelector('figure')).toHaveClass('aspect-[3/2]')
  })

  it('fades start to end and back on Play, with the label following', () => {
    mockReducedMotion(false)
    vi.useFakeTimers()
    render(<StepFrame step={STEP} />)

    expect(caption()).toHaveTextContent(START_CAPTION)
    act(() => {
      vi.advanceTimersByTime(PLAY_HALF_MS)
    })
    expect(caption()).toHaveTextContent(END_CAPTION)
    expect(screen.getByAltText(endAlt(STEP.name))).toHaveClass('opacity-100')
    act(() => {
      vi.advanceTimersByTime(PLAY_HALF_MS)
    })
    expect(caption()).toHaveTextContent(START_CAPTION)
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
    expect(caption()).toHaveTextContent(START_CAPTION)

    fireEvent.click(frame)
    act(() => {
      vi.advanceTimersByTime(PLAY_HALF_MS)
    })
    expect(caption()).toHaveTextContent(END_CAPTION)
  })

  it('shows End still on Play under reduced motion, with nothing to pause', () => {
    mockReducedMotion(true)
    vi.useFakeTimers()
    render(<StepFrame step={STEP} />)

    expect(caption()).toHaveTextContent(END_CAPTION)
    expect(screen.queryByRole('button', { name: 'Pause the movement' })).toBeNull()
    act(() => {
      vi.advanceTimersByTime(PLAY_HALF_MS * 3)
    })
    expect(caption()).toHaveTextContent(END_CAPTION)
  })

  it('keeps the box and shows the name when an image fails', () => {
    render(<StepFrame step={STEP} />)
    fireEvent.error(screen.getByAltText(startAlt(STEP.name)))

    expect(screen.getByTestId('frame-failed')).toHaveTextContent(STEP.name)
    expect(document.querySelector('figure')).toHaveClass('aspect-[3/2]', 'bg-surface-2')
    expect(screen.queryByAltText(endAlt(STEP.name))).toBeNull()
  })
})
