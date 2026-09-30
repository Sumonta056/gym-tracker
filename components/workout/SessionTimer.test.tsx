import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { elapsedSeconds, SessionTimer, startedText, systemNow, TICK_MS } from './SessionTimer'

const STARTED = '2026-09-01T17:30:00.000Z'

afterEach(() => {
  vi.useRealTimers()
})

describe('elapsedSeconds', () => {
  it('counts whole seconds since the start', () => {
    expect(elapsedSeconds(STARTED, new Date('2026-09-01T17:31:05.900Z'))).toBe(65)
  })

  it('returns 0 for a clock behind the start', () => {
    expect(elapsedSeconds(STARTED, new Date('2026-09-01T17:29:00.000Z'))).toBe(0)
  })
})

describe('systemNow', () => {
  it('reads the system clock', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(STARTED))

    expect(systemNow().toISOString()).toBe(STARTED)
  })
})

describe('SessionTimer', () => {
  it('shows now minus started_at as a clock', () => {
    render(<SessionTimer startedAt={STARTED} now={() => new Date('2026-09-01T18:12:17.000Z')} />)

    expect(screen.getByRole('timer')).toHaveTextContent('42:17')
  })

  it('moves on every tick from the clock, not from a count', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date('2026-09-01T17:30:10.000Z'))
    render(<SessionTimer startedAt={STARTED} />)
    expect(screen.getByRole('timer')).toHaveTextContent('0:10')

    act(() => {
      vi.setSystemTime(new Date('2026-09-01T18:30:10.000Z'))
      vi.advanceTimersByTime(TICK_MS)
    })

    expect(screen.getByRole('timer')).toHaveTextContent('1:00:11')
  })

  it('stops ticking once unmounted', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const now = vi.fn(() => new Date('2026-09-01T17:31:00.000Z'))
    const view = render(<SessionTimer startedAt={STARTED} now={now} />)

    view.unmount()
    const calls = now.mock.calls.length
    vi.advanceTimersByTime(TICK_MS * 3)

    expect(now.mock.calls.length).toBe(calls)
  })

  it('passes its label to the timer', () => {
    render(
      <SessionTimer startedAt={STARTED} aria-label="Elapsed time" now={() => new Date(STARTED)} />,
    )

    expect(screen.getByRole('timer', { name: 'Elapsed time' })).toHaveTextContent('0:00')
  })
})

describe('startedText', () => {
  it('reads the start as a 24 hour clock time', () => {
    expect(startedText('2026-09-01T17:30:00')).toBe('17:30')
  })
})
