import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { HistoryLink } from './HistoryLink'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('HistoryLink', () => {
  it('is a real link to its address', () => {
    render(<HistoryLink href="/workouts?session=abc">Open</HistoryLink>)
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      '/workouts?session=abc',
    )
  })

  it('moves in place with pushState on a plain click', () => {
    const push = vi.spyOn(window.history, 'pushState')
    render(<HistoryLink href="/workouts?session=abc">Open</HistoryLink>)
    fireEvent.click(screen.getByRole('link', { name: 'Open' }))
    expect(push).toHaveBeenCalledWith(null, '', '/workouts?session=abc')
  })

  it('leaves a modifier click to the browser', () => {
    const push = vi.spyOn(window.history, 'pushState')
    render(<HistoryLink href="/workouts?session=abc">Open</HistoryLink>)
    fireEvent.click(screen.getByRole('link', { name: 'Open' }), { metaKey: true })
    expect(push).not.toHaveBeenCalled()
  })

  it.each([{ ctrlKey: true }, { shiftKey: true }, { altKey: true }])(
    'leaves a click with %o to the browser',
    (modifier) => {
      const push = vi.spyOn(window.history, 'pushState')
      render(<HistoryLink href="/workouts?session=abc">Open</HistoryLink>)
      fireEvent.click(screen.getByRole('link', { name: 'Open' }), modifier)
      expect(push).not.toHaveBeenCalled()
    },
  )

  it('leaves a middle click to the browser', () => {
    const push = vi.spyOn(window.history, 'pushState')
    render(<HistoryLink href="/workouts?session=abc">Open</HistoryLink>)
    fireEvent.click(screen.getByRole('link', { name: 'Open' }), { button: 1 })
    expect(push).not.toHaveBeenCalled()
  })

  it('keeps its class names', () => {
    render(
      <HistoryLink href="/workouts" className="rounded-card min-h-11">
        Open
      </HistoryLink>,
    )
    expect(screen.getByRole('link', { name: 'Open' })).toHaveClass('min-h-11', 'rounded-card')
  })
})
