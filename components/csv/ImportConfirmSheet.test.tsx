import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  BUSY_TEXT,
  CONFIRM_TITLE,
  daysWord,
  ImportConfirmSheet,
  MERGE_MEANS,
  OVERWRITE_MEANS,
} from './ImportConfirmSheet'

import type { ImportConfirmSheetProps } from './ImportConfirmSheet'

const COUNTS = { created: 12, overwritten: 1, merged: 2, skipped: 1, leftOut: 1 }

function setup(props: Partial<ImportConfirmSheetProps> = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ImportConfirmSheet
      open
      counts={COUNTS}
      busy={false}
      error={null}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  )
  return { onConfirm, onCancel }
}

function dialog() {
  return within(screen.getByRole('dialog', { name: CONFIRM_TITLE }))
}

describe('ImportConfirmSheet', () => {
  it('renders nothing while closed', () => {
    setup({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('states the counts new, overwritten, merged, skipped and left out', () => {
    setup()
    const terms = dialog()
      .getAllByRole('term')
      .map((term) => term.textContent)
    const values = dialog()
      .getAllByRole('definition')
      .map((value) => value.textContent)
    expect(terms).toEqual(['New', 'Overwritten', 'Merged', 'Skipped', 'Left out, with an error'])
    expect(values).toEqual(['12', '1', '2', '1', '1'])
  })

  it('says how many days it writes', () => {
    setup()
    expect(
      dialog().getByText('15 days will be written to this device and queued to sync.'),
    ).toBeInTheDocument()
    expect(dialog().getByRole('button', { name: 'Import 15 days' })).toBeEnabled()
  })

  it('says what Overwrite and Merge do', () => {
    setup()
    expect(dialog().getByText(OVERWRITE_MEANS)).toBeInTheDocument()
    expect(dialog().getByText(MERGE_MEANS)).toBeInTheDocument()
  })

  it('reports a confirm and a cancel', async () => {
    const { onConfirm, onCancel } = setup()
    await userEvent.click(dialog().getByRole('button', { name: 'Import 15 days' }))
    await userEvent.click(dialog().getByRole('button', { name: 'Cancel' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('locks the import, the cancel and the close while the import runs, and says why', async () => {
    const { onCancel, onConfirm } = setup({ busy: true })
    const importing = dialog().getByRole('button', { name: 'Importing…' })
    expect(importing).toHaveAttribute('aria-disabled', 'true')
    expect(importing).toBeEnabled()
    await userEvent.click(importing)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(dialog().getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(dialog().getByRole('button', { name: `Close ${CONFIRM_TITLE}` })).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    expect(onCancel).not.toHaveBeenCalled()
    expect(dialog().getByRole('status')).toHaveTextContent(BUSY_TEXT)
  })

  it('keeps focus on the import button while it runs and after it fails', () => {
    const { rerender } = render(
      <ImportConfirmSheet
        open
        counts={COUNTS}
        busy={false}
        error={null}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    const button = dialog().getByRole('button', { name: 'Import 15 days' })
    button.focus()
    rerender(
      <ImportConfirmSheet
        open
        counts={COUNTS}
        busy
        error={null}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(dialog().getByRole('button', { name: 'Importing…' })).toHaveFocus()
    rerender(
      <ImportConfirmSheet
        open
        counts={COUNTS}
        busy={false}
        error="The import could not be saved."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(dialog().getByRole('button', { name: 'Import 15 days' })).toHaveFocus()
    expect(dialog().getByRole('alert')).toHaveTextContent('The import could not be saved.')
  })

  it('pins the actions in the sheet footer so they stay in view on a short phone', () => {
    setup()
    const footer = within(screen.getByTestId('sheet-footer'))
    expect(footer.getByRole('button', { name: 'Import 15 days' })).toBeInTheDocument()
    expect(footer.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('closes on its close button when idle', async () => {
    const { onCancel } = setup()
    await userEvent.click(dialog().getByRole('button', { name: `Close ${CONFIRM_TITLE}` }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('refuses a confirm that writes no day', async () => {
    const { onConfirm } = setup({
      counts: { created: 0, overwritten: 0, merged: 0, skipped: 2, leftOut: 0 },
    })
    const button = dialog().getByRole('button', { name: 'Import 0 days' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(button)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('shows an error as an alert', () => {
    setup({ error: 'The import could not be saved.' })
    expect(dialog().getByRole('alert')).toHaveTextContent('The import could not be saved.')
  })
})

describe('daysWord', () => {
  it('writes one day in the singular', () => {
    expect(daysWord(1)).toBe('1 day')
    expect(daysWord(2)).toBe('2 days')
  })
})
