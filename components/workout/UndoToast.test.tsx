import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ToastRoom, UNDO_MS, UndoToast } from './UndoToast'

afterEach(() => {
  vi.useRealTimers()
})

function renderToast(props: Partial<Parameters<typeof UndoToast>[0]> = {}) {
  const onUndo = vi.fn()
  const onDismiss = vi.fn()
  const view = render(
    <UndoToast
      toast={{ key: 'a', message: 'Set 2 deleted.' }}
      onUndo={onUndo}
      onDismiss={onDismiss}
      {...props}
    />,
  )
  return { ...view, onUndo, onDismiss }
}

describe('UndoToast', () => {
  it('holds its message in a status region, so it is read out', () => {
    renderToast()

    expect(screen.getByRole('status')).toHaveTextContent('Set 2 deleted.')
  })

  it('keeps the status region in place with no toast, so a new one is announced', () => {
    renderToast({ toast: null })

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('calls Undo from its button', async () => {
    const { onUndo } = renderToast()

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))

    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it('gives Undo a 44 px target and an explicit type', () => {
    renderToast()

    const undo = screen.getByRole('button', { name: 'Undo' })
    expect(undo).toHaveClass('min-h-11')
    expect(undo).toHaveAttribute('type', 'button')
  })

  it('goes away after 5 seconds', () => {
    vi.useFakeTimers()
    const { onDismiss } = renderToast()

    act(() => {
      vi.advanceTimersByTime(UNDO_MS - 1)
    })
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(UNDO_MS).toBe(5000)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('starts the 5 seconds again for a new toast', () => {
    vi.useFakeTimers()
    const { onDismiss, rerender, onUndo } = renderToast()

    act(() => {
      vi.advanceTimersByTime(UNDO_MS - 1000)
    })
    rerender(
      <UndoToast
        toast={{ key: 'b', message: 'Set 1 deleted.' }}
        onUndo={onUndo}
        onDismiss={onDismiss}
      />,
    )
    act(() => {
      vi.advanceTimersByTime(UNDO_MS - 1)
    })
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('calls the latest dismiss handler', () => {
    vi.useFakeTimers()
    const first = vi.fn()
    const latest = vi.fn()
    const toast = { key: 'a', message: 'Set 2 deleted.' }
    const { rerender } = render(<UndoToast toast={toast} onUndo={vi.fn()} onDismiss={first} />)

    rerender(<UndoToast toast={toast} onUndo={vi.fn()} onDismiss={latest} />)
    act(() => {
      vi.advanceTimersByTime(UNDO_MS)
    })

    expect(first).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledTimes(1)
  })

  it('sets no timer with no toast', () => {
    vi.useFakeTimers()
    const { onDismiss } = renderToast({ toast: null })

    act(() => {
      vi.advanceTimersByTime(UNDO_MS * 2)
    })

    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('stops the timer once the toast goes away', () => {
    vi.useFakeTimers()
    const { onDismiss, unmount } = renderToast()

    unmount()
    vi.advanceTimersByTime(UNDO_MS)

    expect(onDismiss).not.toHaveBeenCalled()
  })
})

describe('UndoToast timing and focus', () => {
  it('holds while the pointer is over Undo, and gives the full time again after', () => {
    vi.useFakeTimers()
    const { onDismiss } = renderToast()
    const toast = screen.getByRole('button', { name: 'Undo' })

    fireEvent.pointerEnter(toast)
    act(() => {
      vi.advanceTimersByTime(UNDO_MS * 3)
    })
    expect(onDismiss).not.toHaveBeenCalled()

    fireEvent.pointerLeave(toast)
    act(() => {
      vi.advanceTimersByTime(UNDO_MS)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('holds while the user has moved the focus onto it', () => {
    vi.useFakeTimers()
    render(<button type="button">Before</button>)
    const { onDismiss } = renderToast()
    const undo = screen.getByRole('button', { name: 'Undo' })

    act(() => {
      screen.getByRole('button', { name: 'Before' }).focus()
    })
    act(() => {
      undo.focus()
    })
    act(() => {
      vi.advanceTimersByTime(UNDO_MS * 3)
    })
    expect(onDismiss).not.toHaveBeenCalled()

    act(() => {
      undo.blur()
    })
    act(() => {
      vi.advanceTimersByTime(UNDO_MS)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('takes the focus when the deleted row took it away, and still goes after 5 seconds', () => {
    vi.useFakeTimers()
    const { onDismiss } = renderToast()

    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus()
    act(() => {
      vi.advanceTimersByTime(UNDO_MS)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('leaves the focus where it is when it is still on the page', () => {
    render(<button type="button">Keep me</button>)
    const keep = screen.getByRole('button', { name: 'Keep me' })
    keep.focus()

    renderToast()

    expect(keep).toHaveFocus()
  })
})

describe('ToastRoom', () => {
  it('reserves room under the last button while a toast shows, so nothing is covered', () => {
    const { rerender } = render(<ToastRoom shown />)
    expect(screen.getByTestId('toast-room')).toHaveClass('h-20')

    rerender(<ToastRoom shown={false} />)
    expect(screen.queryByTestId('toast-room')).not.toBeInTheDocument()
  })
})
