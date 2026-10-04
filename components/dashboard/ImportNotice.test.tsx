import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ImportNotice, ImportNoticeView } from './ImportNotice'

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

const OUTCOME = { created: 16, overwritten: 0, merged: 0, skipped: 0, leftOut: 0 }

describe('ImportNoticeView', () => {
  it('keeps an empty status region mounted while no result is known', () => {
    render(<ImportNoticeView outcome={null} />)
    const region = screen.getByRole('status')
    expect(region).toBeEmptyDOMElement()
    expect(region).toHaveAttribute('aria-live', 'polite')
  })

  it('fills the same region with the result text', () => {
    const { rerender } = render(<ImportNoticeView outcome={null} />)
    const region = screen.getByRole('status')
    rerender(<ImportNoticeView outcome={OUTCOME} />)
    expect(screen.getByRole('status')).toBe(region)
    expect(region).toHaveTextContent(
      'The sheet is imported: 16 new, 0 overwritten, 0 merged, 0 skipped, 0 left out.',
    )
    expect(screen.getByTestId('import-notice')).toHaveClass('mb-3')
  })
})

describe('ImportNotice', () => {
  it('shows the import result from the address as text', async () => {
    window.history.replaceState(null, '', '/?imported=16.0.0.0.0')
    render(<ImportNotice />)
    expect(await screen.findByTestId('import-notice')).toHaveTextContent(
      'The sheet is imported: 16 new, 0 overwritten, 0 merged, 0 skipped, 0 left out.',
    )
  })

  it('drops the result from the address, so a reload does not show it again', async () => {
    window.history.replaceState(null, '', '/?imported=1.2.3.4.5')
    render(<ImportNotice />)
    await screen.findByTestId('import-notice')
    expect(window.location.search).toBe('')
  })

  it('shows nothing but the empty region without an import result', () => {
    window.history.replaceState(null, '', '/')
    render(<ImportNotice />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(screen.queryByTestId('import-notice')).not.toBeInTheDocument()
  })
})
