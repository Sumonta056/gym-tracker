import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  HOLD_MS,
  loadText,
  NO_LOAD,
  RecordBadge,
  repsText,
  setRowLabel,
  SetRow,
  SLOP_PX,
  SWIPE_PX,
} from './SetRow'

describe('loadText', () => {
  it('shows kilograms on a metric profile', () => {
    expect(loadText(72.5, 'metric')).toBe('72.5 kg')
  })

  it('shows pounds to two decimals on an imperial profile', () => {
    expect(loadText(60, 'imperial')).toBe('132.28 lb')
  })

  it('names a set with no load', () => {
    expect(loadText(null, 'metric')).toBe(NO_LOAD)
  })
})

describe('repsText', () => {
  it('uses the singular for one rep', () => {
    expect(repsText(1)).toBe('1 rep')
  })

  it('uses the plural for more', () => {
    expect(repsText(8)).toBe('8 reps')
  })
})

describe('RecordBadge', () => {
  it('carries the text PR, not colour alone', () => {
    render(<RecordBadge />)

    expect(screen.getByText('PR')).toBeInTheDocument()
  })

  it('carries another text when it is given one', () => {
    render(<RecordBadge label="New today" />)

    expect(screen.getByText('New today')).toBeInTheDocument()
  })
})

describe('setRowLabel', () => {
  it('names the position, the load and the reps', () => {
    expect(setRowLabel(3, { reps: 8, weight_kg: 75 }, 'metric', false)).toBe(
      'Edit set 3, 75 kg, 8 reps',
    )
  })

  it('names a record in words, not colour alone', () => {
    expect(setRowLabel(1, { reps: 1, weight_kg: null }, 'metric', true)).toBe(
      'Edit set 1, No load, 1 rep, personal record',
    )
  })
})

describe('SetRow', () => {
  function renderRow(isRecord: boolean) {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(
      <ul>
        <SetRow
          position={3}
          set={{ reps: 8, weight_kg: 75 }}
          unit="metric"
          isRecord={isRecord}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </ul>,
    )
    return { row: screen.getByRole('button', { name: /^Edit set 3/ }), onEdit, onDelete }
  }

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the position, the load and the reps', () => {
    const { row } = renderRow(false)

    expect(row).toHaveTextContent('3')
    expect(row).toHaveTextContent('75 kg')
    expect(row).toHaveTextContent('8 reps')
  })

  it('shows the PR badge on a record set', () => {
    renderRow(true)

    expect(screen.getByText('PR')).toBeInTheDocument()
  })

  it('shows no badge on an ordinary set', () => {
    renderRow(false)

    expect(screen.queryByText('PR')).not.toBeInTheDocument()
  })

  it('holds a row at least 44 px tall', () => {
    expect(renderRow(false).row).toHaveClass('min-h-11')
  })

  it('is a real button inside the list item', () => {
    const { row } = renderRow(false)

    expect(row.tagName).toBe('BUTTON')
    expect(row).toHaveAttribute('type', 'button')
    expect(screen.getByRole('listitem')).toContainElement(row)
  })

  it('opens the edit on a tap', async () => {
    const { row, onEdit, onDelete } = renderRow(false)

    await userEvent.click(row)

    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('opens the edit from the keyboard', async () => {
    const { onEdit } = renderRow(false)

    await userEvent.tab()
    await userEvent.keyboard('{Enter}')

    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('lets a vertical move scroll the page, so it never blocks the scroll', () => {
    expect(renderRow(false).row).toHaveClass('touch-pan-y')
  })

  it('deletes on a swipe to the left, and opens no edit after it', () => {
    const { row, onEdit, onDelete } = renderRow(false)

    fireEvent.pointerDown(row, { clientX: 200, clientY: 20 })
    fireEvent.pointerMove(row, { clientX: 200 - SWIPE_PX, clientY: 24 })
    fireEvent.pointerUp(row)
    fireEvent.click(row)

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('does nothing on a short swipe', () => {
    const { row, onDelete } = renderRow(false)

    fireEvent.pointerDown(row, { clientX: 200, clientY: 20 })
    fireEvent.pointerMove(row, { clientX: 200 - SWIPE_PX + 1, clientY: 20 })
    fireEvent.pointerUp(row)

    expect(onDelete).not.toHaveBeenCalled()
  })

  it('does nothing on a swipe to the right', () => {
    const { row, onDelete } = renderRow(false)

    fireEvent.pointerDown(row, { clientX: 100, clientY: 20 })
    fireEvent.pointerMove(row, { clientX: 100 + SWIPE_PX * 2, clientY: 20 })

    expect(onDelete).not.toHaveBeenCalled()
  })

  it('does nothing on a mostly vertical move, which is a scroll', () => {
    const { row, onDelete } = renderRow(false)

    fireEvent.pointerDown(row, { clientX: 200, clientY: 20 })
    fireEvent.pointerMove(row, { clientX: 200 - SWIPE_PX, clientY: 20 + SWIPE_PX * 2 })

    expect(onDelete).not.toHaveBeenCalled()
  })

  it('ignores a move with no press first', () => {
    const { row, onDelete } = renderRow(false)

    fireEvent.pointerMove(row, { clientX: 0, clientY: 0 })

    expect(onDelete).not.toHaveBeenCalled()
  })

  it('deletes on a long press, and opens no edit after it', () => {
    vi.useFakeTimers()
    const { row, onEdit, onDelete } = renderRow(false)

    fireEvent.pointerDown(row, { clientX: 200, clientY: 20 })
    act(() => {
      vi.advanceTimersByTime(HOLD_MS)
    })
    fireEvent.pointerUp(row)
    fireEvent.click(row)

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('does not delete on a press released before the hold time', () => {
    vi.useFakeTimers()
    const { row, onDelete } = renderRow(false)

    fireEvent.pointerDown(row, { clientX: 200, clientY: 20 })
    act(() => {
      vi.advanceTimersByTime(HOLD_MS - 1)
    })
    fireEvent.pointerUp(row)
    act(() => {
      vi.advanceTimersByTime(HOLD_MS)
    })

    expect(onDelete).not.toHaveBeenCalled()
  })

  it('cancels the long press when the finger moves past the slop', () => {
    vi.useFakeTimers()
    const { row, onDelete } = renderRow(false)

    fireEvent.pointerDown(row, { clientX: 200, clientY: 20 })
    fireEvent.pointerMove(row, { clientX: 200, clientY: 20 + SLOP_PX + 1 })
    act(() => {
      vi.advanceTimersByTime(HOLD_MS)
    })

    expect(onDelete).not.toHaveBeenCalled()
  })

  it('keeps the long press through a small wobble', () => {
    vi.useFakeTimers()
    const { row, onDelete } = renderRow(false)

    fireEvent.pointerDown(row, { clientX: 200, clientY: 20 })
    fireEvent.pointerMove(row, { clientX: 200 + SLOP_PX, clientY: 20 })
    act(() => {
      vi.advanceTimersByTime(HOLD_MS)
    })

    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('cancels the long press when the browser takes the pointer for a scroll', () => {
    vi.useFakeTimers()
    const { row, onDelete } = renderRow(false)

    fireEvent.pointerDown(row, { clientX: 200, clientY: 20 })
    fireEvent.pointerCancel(row)
    act(() => {
      vi.advanceTimersByTime(HOLD_MS)
    })

    expect(onDelete).not.toHaveBeenCalled()
  })

  it('cancels the long press when the pointer leaves the row', () => {
    vi.useFakeTimers()
    const { row, onDelete } = renderRow(false)

    fireEvent.pointerDown(row, { clientX: 200, clientY: 20 })
    fireEvent.pointerLeave(row)
    act(() => {
      vi.advanceTimersByTime(HOLD_MS)
    })

    expect(onDelete).not.toHaveBeenCalled()
  })

  it('stops the long press when the row goes away', () => {
    vi.useFakeTimers()
    const onDelete = vi.fn()
    const { unmount } = render(
      <ul>
        <SetRow
          position={1}
          set={{ reps: 8, weight_kg: 75 }}
          unit="metric"
          isRecord={false}
          onEdit={vi.fn()}
          onDelete={onDelete}
        />
      </ul>,
    )

    fireEvent.pointerDown(screen.getByRole('button'), { clientX: 0, clientY: 0 })
    unmount()
    vi.advanceTimersByTime(HOLD_MS)

    expect(onDelete).not.toHaveBeenCalled()
  })

  it('keeps the phone menu from opening on a long press', () => {
    const { row } = renderRow(false)

    expect(fireEvent.contextMenu(row)).toBe(false)
  })

  it('opens the edit on the next tap after a swipe', () => {
    const { row, onEdit } = renderRow(false)

    fireEvent.pointerDown(row, { clientX: 200, clientY: 20 })
    fireEvent.pointerMove(row, { clientX: 200 - SWIPE_PX, clientY: 20 })
    fireEvent.click(row)
    fireEvent.click(row)

    expect(onEdit).toHaveBeenCalledTimes(1)
  })
})
