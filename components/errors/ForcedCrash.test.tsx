import { render, screen } from '@testing-library/react'
import { Component } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { FORCED_CRASH_MESSAGE, ForcedCrash } from './ForcedCrash'

import type { ReactNode } from 'react'

class Catch extends Component<{ children: ReactNode }, { message: string | null }> {
  override state: { message: string | null } = { message: null }

  static getDerivedStateFromError(error: Error) {
    return { message: error.message }
  }

  override render() {
    return this.state.message === null ? this.props.children : <p>{this.state.message}</p>
  }
}

describe('ForcedCrash', () => {
  it('throws a render error once it is mounted in the browser', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <Catch>
        <ForcedCrash />
      </Catch>,
    )

    expect(await screen.findByText(FORCED_CRASH_MESSAGE)).toBeInTheDocument()
    quiet.mockRestore()
  })
})
