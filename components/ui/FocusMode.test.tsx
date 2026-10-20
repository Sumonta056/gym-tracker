import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { FocusModeProvider, useFocusMode, useFocusModeOn } from './FocusMode'

function Reader() {
  return <p>{useFocusModeOn() ? 'focus' : 'default'}</p>
}

function Asker({ active }: { active: boolean }) {
  useFocusMode(active)
  return null
}

describe('FocusMode', () => {
  it('reads default with no provider', () => {
    render(<Reader />)
    expect(screen.getByText('default')).toBeInTheDocument()
  })

  it('reads default while nothing asks for focus', () => {
    render(
      <FocusModeProvider>
        <Asker active={false} />
        <Reader />
      </FocusModeProvider>,
    )
    expect(screen.getByText('default')).toBeInTheDocument()
  })

  it('reads focus while a mounted child asks for it', () => {
    render(
      <FocusModeProvider>
        <Asker active />
        <Reader />
      </FocusModeProvider>,
    )
    expect(screen.getByText('focus')).toBeInTheDocument()
  })

  it('returns to default once the asking child unmounts', () => {
    const { rerender } = render(
      <FocusModeProvider>
        <Asker active />
        <Reader />
      </FocusModeProvider>,
    )
    rerender(
      <FocusModeProvider>
        <Reader />
      </FocusModeProvider>,
    )
    expect(screen.getByText('default')).toBeInTheDocument()
  })

  it('does nothing when asked with no provider', () => {
    render(<Asker active />)
    expect(document.body).toBeInTheDocument()
  })
})
