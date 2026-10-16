import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { NoteCard } from './NoteCard'

describe('NoteCard', () => {
  it('shows the note under a level 2 heading named Note', () => {
    render(<NoteCard note="Felt strong." />)
    expect(screen.getByRole('heading', { level: 2, name: 'Note' })).toBeInTheDocument()
    expect(screen.getByText('Felt strong.')).toBeVisible()
  })

  it('keeps a line break in the note', () => {
    render(<NoteCard note={'Felt strong.\nLeft knee sore.'} />)
    const text = screen.getByText(/Felt strong\./)
    expect(text).toHaveClass('whitespace-pre-line')
    expect(text.textContent).toContain('\n')
  })
})
