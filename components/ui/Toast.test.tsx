import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SAVED_MESSAGE, TOAST_MS, ToastProvider, useToast } from './Toast'

afterEach(() => {
  vi.useRealTimers()
})

function Saver({ message = SAVED_MESSAGE }: { message?: string }) {
  const toast = useToast()

  return (
    <button
      type="button"
      onClick={() => {
        toast.show(message)
      }}
    >
      Save
    </button>
  )
}

function renderToast() {
  return render(
    <ToastProvider>
      <Saver />
    </ToastProvider>,
  )
}

describe('ToastProvider', () => {
  it('shows the message in a status region, so it is read out', () => {
    renderToast()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('status')).toHaveTextContent('Saved')
  })

  it('keeps the status region in place with no message, so a new one is announced', () => {
    renderToast()

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('hides the message after 2 seconds', () => {
    vi.useFakeTimers()
    renderToast()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    act(() => {
      vi.advanceTimersByTime(TOAST_MS - 1)
    })
    expect(screen.getByRole('status')).toHaveTextContent('Saved')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('starts the 2 seconds again when a second save shows the same message', () => {
    vi.useFakeTimers()
    renderToast()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    act(() => {
      vi.advanceTimersByTime(1500)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(screen.getByRole('status')).toHaveTextContent('Saved')
  })

  it('lasts 2 seconds', () => {
    expect(TOAST_MS).toBe(2000)
  })

  it('says Saved', () => {
    expect(SAVED_MESSAGE).toBe('Saved')
  })

  it('sits at the top below the safe area, clear of the undo toast at the bottom', () => {
    renderToast()

    const region = screen.getByRole('status')
    expect(region).toHaveClass('fixed', 'top-[calc(env(safe-area-inset-top)+12px)]')
    expect(region.className).not.toMatch(/\bbottom-/)
  })

  it('sits above an open sheet and never takes a tap', () => {
    renderToast()

    expect(screen.getByRole('status')).toHaveClass('z-[60]', 'pointer-events-none')
  })

  it('draws the message with tokens only', () => {
    renderToast()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Saved')).toHaveClass(
      'bg-surface-2',
      'border-border',
      'text-text',
      'rounded-full',
    )
  })
})

describe('useToast', () => {
  it('does nothing outside a provider', () => {
    render(<Saver />)

    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    }).not.toThrow()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
