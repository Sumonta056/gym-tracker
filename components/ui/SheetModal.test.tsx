import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'

import { SheetModal } from './SheetModal'

function setup(open = true) {
  const onClose = vi.fn()
  render(
    <SheetModal open={open} title="Log a set" onClose={onClose}>
      <p>Sheet body</p>
    </SheetModal>,
  )
  return { onClose }
}

describe('SheetModal', () => {
  it('renders nothing when closed', () => {
    setup(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders a modal dialog named by its title when open', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Log a set' })).toHaveAttribute('aria-modal', 'true')
  })

  it('renders its children', () => {
    setup()
    expect(screen.getByText('Sheet body')).toBeInTheDocument()
  })

  it('closes when the close button is pressed', async () => {
    const { onClose } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Close Log a set' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when the backdrop is pressed', async () => {
    const { onClose } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on the escape key', async () => {
    const { onClose } = setup()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores other keys', async () => {
    const { onClose } = setup()
    await userEvent.keyboard('a')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not listen for escape while closed', async () => {
    const { onClose } = setup(false)
    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('sits at the bottom on the phone and centres at the large breakpoint', () => {
    setup()
    expect(screen.getByRole('dialog')).toHaveClass('rounded-t-hero')
    expect(screen.getByRole('dialog')).toHaveClass('lg:rounded-hero')
  })

  it('draws the recipe sheet: top border on the phone, 78 percent tall, 520 px on the desktop', () => {
    setup()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveClass('border-t', 'lg:border', 'max-h-[78%]', 'pt-2.5', 'lg:w-[520px]')
    expect(dialog).not.toHaveClass('rounded-t-[24px]')
  })

  it('shows the grabber on the phone only, hidden from assistive technology', () => {
    setup()
    const grabber = screen.getByTestId('sheet-grabber')
    expect(grabber).toHaveAttribute('aria-hidden', 'true')
    expect(grabber).toHaveClass('lg:hidden')
  })

  it('moves focus into the sheet when it opens', () => {
    setup()
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
  })

  it('has focus inside the sheet by the time the dialog is in the document, on an async open', async () => {
    const flag = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    const previous = flag.IS_REACT_ACT_ENVIRONMENT
    flag.IS_REACT_ACT_ENVIRONMENT = false
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    const focusedInside = await new Promise<boolean>((resolve) => {
      const observer = new MutationObserver(() => {
        const dialog = host.querySelector('[role="dialog"]')
        if (dialog === null) return
        observer.disconnect()
        resolve(dialog.contains(document.activeElement))
      })
      observer.observe(host, { childList: true, subtree: true })
      root.render(
        <SheetModal open title="Log a set" onClose={vi.fn()}>
          <p>Sheet body</p>
        </SheetModal>,
      )
    })

    root.unmount()
    host.remove()
    flag.IS_REACT_ACT_ENVIRONMENT = previous
    expect(focusedInside).toBe(true)
  })

  it('keeps focus inside the sheet on tab and shift tab', async () => {
    render(
      <SheetModal open title="Log a set" onClose={vi.fn()}>
        <button type="button">Save</button>
      </SheetModal>,
    )
    const close = screen.getByRole('button', { name: 'Close Log a set' })
    const save = screen.getByRole('button', { name: 'Save' })
    expect(close).toHaveFocus()
    await userEvent.tab()
    expect(save).toHaveFocus()
    await userEvent.tab()
    expect(close).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(save).toHaveFocus()
  })

  it('moves through every control in the sheet, not only the first and the last', async () => {
    render(
      <SheetModal open title="Log a set" onClose={vi.fn()}>
        <input aria-label="Weight" />
        <button type="button">Save</button>
      </SheetModal>,
    )
    await userEvent.tab()
    expect(screen.getByRole('textbox', { name: 'Weight' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(screen.getByRole('textbox', { name: 'Weight' })).toHaveFocus()
  })

  it('pulls focus back in on shift tab to the last control', async () => {
    render(
      <SheetModal open title="Log a set" onClose={vi.fn()}>
        <button type="button">Save</button>
      </SheetModal>,
    )
    screen.getByRole('button', { name: 'Close' }).focus()
    await userEvent.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()
  })

  it('pulls focus back in when it has escaped the sheet', async () => {
    setup()
    screen.getByRole('button', { name: 'Close' }).focus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Close Log a set' })).toHaveFocus()
  })

  it('returns focus to the opener when it closes', async () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setOpen(true)
            }}
          >
            Open
          </button>
          <SheetModal
            open={open}
            title="Log a set"
            onClose={() => {
              setOpen(false)
            }}
          >
            <p>Sheet body</p>
          </SheetModal>
        </>
      )
    }
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open' })
    await userEvent.click(opener)
    expect(opener).not.toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(opener).toHaveFocus()
  })

  it('keeps focus in place across a parent re-render with a new close handler', () => {
    const { rerender } = render(
      <SheetModal open title="Log a set" onClose={vi.fn()}>
        <input aria-label="Weight" />
      </SheetModal>,
    )
    const field = screen.getByRole('textbox', { name: 'Weight' })
    field.focus()
    rerender(
      <SheetModal open title="Log a set" onClose={vi.fn()}>
        <input aria-label="Weight" />
      </SheetModal>,
    )
    expect(field).toHaveFocus()
  })

  it('calls the latest close handler on escape', async () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(
      <SheetModal open title="Log a set" onClose={first}>
        <p>Sheet body</p>
      </SheetModal>,
    )
    rerender(
      <SheetModal open title="Log a set" onClose={second}>
        <p>Sheet body</p>
      </SheetModal>,
    )
    await userEvent.keyboard('{Escape}')
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('locks the page scroll while open and restores it on close', () => {
    document.body.style.overflow = 'auto'
    const { rerender } = render(
      <SheetModal open title="Log a set" onClose={vi.fn()}>
        <p>Sheet body</p>
      </SheetModal>,
    )
    expect(document.body.style.overflow).toBe('hidden')
    rerender(
      <SheetModal open={false} title="Log a set" onClose={vi.fn()}>
        <p>Sheet body</p>
      </SheetModal>,
    )
    expect(document.body.style.overflow).toBe('auto')
    document.body.style.overflow = ''
  })

  it('disables its close button and backdrop while closing is not allowed', async () => {
    const onClose = vi.fn()
    render(
      <SheetModal open title="Log a set" onClose={onClose} closeDisabled>
        <p>Sheet body</p>
      </SheetModal>,
    )
    expect(screen.getByRole('button', { name: 'Close Log a set' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on escape again once closing is allowed', async () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <SheetModal open title="Log a set" onClose={onClose} closeDisabled>
        <p>Sheet body</p>
      </SheetModal>,
    )
    rerender(
      <SheetModal open title="Log a set" onClose={onClose}>
        <p>Sheet body</p>
      </SheetModal>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('keeps the close button at 44 px', () => {
    setup()
    const close = screen.getByRole('button', { name: 'Close Log a set' })
    expect(close).toHaveClass('h-11')
    expect(close).toHaveClass('w-11')
  })

  it('scrolls the whole sheet and draws no footer when none is given', () => {
    setup()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveClass('overflow-y-auto', 'px-5', 'lg:pb-5')
    expect(dialog).not.toHaveClass('overflow-hidden')
    expect(screen.queryByTestId('sheet-body')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sheet-footer')).not.toBeInTheDocument()
  })

  function withFooter() {
    render(
      <SheetModal
        open
        title="Pick"
        onClose={vi.fn()}
        footer={<button type="button">Create</button>}
      >
        <button type="button">Row</button>
      </SheetModal>,
    )
  }

  it('pins a given footer below a body that scrolls on its own', () => {
    withFooter()
    const dialog = screen.getByRole('dialog')
    const body = screen.getByTestId('sheet-body')
    const footer = screen.getByTestId('sheet-footer')
    expect(dialog).toHaveClass('flex', 'flex-col', 'overflow-hidden')
    expect(dialog).not.toHaveClass('overflow-y-auto')
    expect(body).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto', 'overscroll-contain')
    expect(body).toContainElement(screen.getByRole('button', { name: 'Row' }))
    expect(footer).toContainElement(screen.getByRole('button', { name: 'Create' }))
    expect(footer).toHaveClass('shrink-0', 'pb-[calc(env(safe-area-inset-bottom)+20px)]')
    expect(body.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the header outside the scrolling body when a footer is given', () => {
    withFooter()
    const body = screen.getByTestId('sheet-body')
    expect(body).not.toContainElement(screen.getByRole('heading', { name: 'Pick' }))
    expect(body).not.toContainElement(screen.getByRole('button', { name: 'Close Pick' }))
  })

  it('tabs from the body into the footer and back to the close button', async () => {
    withFooter()
    expect(screen.getByRole('button', { name: 'Close Pick' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Row' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Create' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Close Pick' })).toHaveFocus()
  })

  it('locks the page scroll with a footer too', () => {
    withFooter()
    expect(document.body.style.overflow).toBe('hidden')
  })
})
