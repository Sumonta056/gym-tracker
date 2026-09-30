import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { REST_OVER, restLengthText, RestTimerCard } from './RestTimerCard'

import type { RestTimerCardProps } from './RestTimerCard'

const COMPLETED_AT = '2026-09-30T17:30:00.000Z'

function clock(secondsAfter: number) {
  let offset = secondsAfter
  return {
    now: () => new Date(Date.parse(COMPLETED_AT) + offset * 1000),
    move: (seconds: number) => {
      offset += seconds
    },
  }
}

function renderCard(props: Partial<RestTimerCardProps> = {}, secondsAfter = 6) {
  const time = clock(secondsAfter)
  const handlers = {
    onZero: vi.fn(),
    onSkip: vi.fn(),
    onAddThirty: vi.fn(),
    onChange: vi.fn(),
  }
  const all: RestTimerCardProps = {
    exerciseName: 'Bench Press',
    completedAt: COMPLETED_AT,
    restSeconds: 90,
    savedSeconds: 90,
    extraTaps: 0,
    now: time.now,
    ...handlers,
    ...props,
  }
  const view = render(<RestTimerCard {...all} />)
  return { ...view, ...handlers, time, all }
}

function remaining() {
  return screen.getByRole('timer', { name: 'Rest remaining' })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('RestTimerCard', () => {
  it('counts down from the completed time of the last set', () => {
    renderCard()

    expect(screen.getByRole('region', { name: 'Rest timer' })).toBeInTheDocument()
    expect(remaining()).toHaveTextContent('1:24')
    expect(screen.getByText('of 1:30')).toBeInTheDocument()
    expect(screen.getByText('Bench Press rests 1:30')).toBeInTheDocument()
  })

  it('shows the share of the rest still to run in the bar', () => {
    renderCard()

    expect(screen.getByTestId('rest-bar').style.width).toMatch(/^93\.3/)
  })

  it('is correct after a 60 second gap with no tick in between', () => {
    vi.useFakeTimers()
    const { time } = renderCard()

    time.move(60)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(remaining()).toHaveTextContent('0:24')
  })

  it('ticks each second from the clock, not from a count', () => {
    vi.useFakeTimers()
    const { time } = renderCard()

    time.move(5)
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(remaining()).toHaveTextContent('1:19')
  })

  it('asks its owner to skip the rest', () => {
    const { onSkip } = renderCard()

    fireEvent.click(screen.getByRole('button', { name: 'Skip rest' }))

    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('asks its owner for 30 more seconds', () => {
    const { onAddThirty } = renderCard()

    fireEvent.click(screen.getByRole('button', { name: '+30 s more rest' }))

    expect(onAddThirty).toHaveBeenCalledTimes(1)
  })

  it('raises the remaining time by 30 seconds for each extra tap', () => {
    const { rerender, all } = renderCard()

    rerender(<RestTimerCard {...all} extraTaps={1} />)

    expect(remaining()).toHaveTextContent('1:54')
    expect(screen.getByText('of 2:00')).toBeInTheDocument()
  })

  it('asks its owner to change the rest time of the exercise', () => {
    const { onChange } = renderCard()

    fireEvent.click(screen.getByRole('button', { name: 'Change the rest time for Bench Press' }))

    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('shows the saved rest of the exercise apart from the length of this rest', () => {
    renderCard({ savedSeconds: 120 })

    expect(screen.getByText('Bench Press rests 2:00')).toBeInTheDocument()
    expect(screen.getByText('of 1:30')).toBeInTheDocument()
  })

  it('announces zero as text in a polite live region and alerts once', () => {
    vi.useFakeTimers()
    const { time, onZero } = renderCard({}, 88)
    const live = document.querySelector('[aria-live="polite"]')

    expect(live).toBeEmptyDOMElement()

    time.move(2)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    time.move(5)
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(remaining()).toHaveTextContent('0:00')
    expect(live).toHaveTextContent(REST_OVER)
    expect(onZero).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Skip rest' })).not.toBeInTheDocument()
  })

  it('reaches zero when the phone comes back after the end of the rest', () => {
    vi.useFakeTimers()
    const { time, onZero } = renderCard({}, 60)

    time.move(60)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(screen.getByText(REST_OVER)).toBeInTheDocument()
    expect(onZero).toHaveBeenCalledTimes(1)
  })

  it('does not tick when the page turns hidden', () => {
    vi.useFakeTimers()
    const { time } = renderCard()
    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')

    time.move(10)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(remaining()).toHaveTextContent('1:24')
    hidden.mockRestore()
  })

  it('shows nothing for a rest that ended before the card was shown', () => {
    const { container, onZero } = renderCard({}, 200)

    expect(container).toBeEmptyDOMElement()
    expect(onZero).not.toHaveBeenCalled()
  })

  it('stops the clock when it is taken away', () => {
    vi.useFakeTimers()
    const { unmount } = renderCard()

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('restLengthText', () => {
  it('names the exercise and its rest in the clock style', () => {
    expect(restLengthText('Back Squat', 150)).toBe('Back Squat rests 2:30')
  })
})
