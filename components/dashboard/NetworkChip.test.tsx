import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { NetworkChip } from './NetworkChip'

function setOnline(value: boolean): void {
  Object.defineProperty(globalThis.navigator, 'onLine', { configurable: true, value })
}

beforeEach(() => {
  setOnline(true)
})

describe('NetworkChip', () => {
  it('shows nothing while the browser is online', () => {
    render(<NetworkChip />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows the offline chip when the browser is offline', () => {
    setOnline(false)
    render(<NetworkChip />)
    expect(screen.getByRole('status')).toHaveTextContent('OFFLINE')
  })

  it('follows the browser when the network drops and returns', () => {
    render(<NetworkChip />)
    act(() => {
      setOnline(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByRole('status')).toHaveTextContent('OFFLINE')
    act(() => {
      setOnline(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
