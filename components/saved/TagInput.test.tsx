import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { TagInput, TOO_MANY_TAGS } from './TagInput'

function Harness({
  start = [],
  suggestions = [],
  error,
  onChange,
}: {
  start?: string[]
  suggestions?: string[]
  error?: string
  onChange?: (tags: string[]) => void
}) {
  const [tags, setTags] = useState(start)

  return (
    <TagInput
      value={tags}
      suggestions={suggestions}
      error={error}
      onChange={(next) => {
        setTags(next)
        onChange?.(next)
      }}
    />
  )
}

function input() {
  return screen.getByRole('textbox', { name: 'Add a new tag' })
}

describe('TagInput', () => {
  it('adds a typed tag on Enter, lower case with no #', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await userEvent.type(input(), '#Yoga{Enter}')

    expect(onChange).toHaveBeenLastCalledWith(['yoga'])
    expect(screen.getByRole('button', { name: '#yoga', pressed: true })).toBeInTheDocument()
    expect(input()).toHaveValue('')
  })

  it('adds a tag on a comma', async () => {
    render(<Harness />)

    await userEvent.type(input(), 'legs,')

    expect(screen.getByRole('button', { name: '#legs', pressed: true })).toBeInTheDocument()
  })

  it('adds the typed tag when the field loses focus', async () => {
    render(<Harness />)

    await userEvent.type(input(), 'core')
    await userEvent.tab()

    expect(screen.getByRole('button', { name: '#core', pressed: true })).toBeInTheDocument()
  })

  it('keeps 1 tag when the same word is typed twice', async () => {
    const onChange = vi.fn()
    render(<Harness start={['yoga']} onChange={onChange} />)

    await userEvent.type(input(), 'YOGA{Enter}')

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getAllByRole('button', { name: '#yoga', pressed: true })).toHaveLength(1)
  })

  it('refuses a lone # with a message tied to the field', async () => {
    render(<Harness />)

    await userEvent.type(input(), '#{Enter}')

    expect(screen.getByRole('alert')).toHaveTextContent(
      'A tag needs at least 1 letter after the #.',
    )
    expect(input()).toHaveAttribute('aria-invalid', 'true')
    expect(input()).toHaveValue('#')
  })

  it('refuses an 11th tag with a message', async () => {
    const ten = Array.from({ length: 10 }, (_, index) => `tag${String(index)}`)
    render(<Harness start={ten} />)

    await userEvent.type(input(), 'more{Enter}')

    expect(screen.getByRole('alert')).toHaveTextContent(TOO_MANY_TAGS)
    expect(screen.queryByRole('button', { name: '#more', pressed: true })).not.toBeInTheDocument()
  })

  it('removes a tag on tap', async () => {
    render(<Harness start={['yoga', 'legs']} />)

    await userEvent.click(screen.getByRole('button', { name: '#yoga', pressed: true }))

    expect(screen.queryByRole('button', { name: '#yoga', pressed: true })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '#legs', pressed: true })).toBeInTheDocument()
  })

  it('shows every used tag as a chip before any typing, with the chosen ones pressed', () => {
    render(<Harness start={['legs']} suggestions={['evening', 'legs', 'stretch']} />)

    const chips = screen.getAllByRole('button')
    expect(chips.map((chip) => chip.textContent)).toEqual(['#evening', '#legs', '#stretch'])
    expect(chips.map((chip) => chip.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
    ])
  })

  it('adds a used tag on tap', async () => {
    const onChange = vi.fn()
    render(<Harness suggestions={['evening', 'stretch']} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: '#stretch' }))

    expect(onChange).toHaveBeenLastCalledWith(['stretch'])
    expect(screen.getByRole('button', { name: '#stretch', pressed: true })).toBeInTheDocument()
  })

  it('keeps a removed used tag as a chip to tap again', async () => {
    render(<Harness start={['stretch']} suggestions={['stretch']} />)

    await userEvent.click(screen.getByRole('button', { name: '#stretch', pressed: true }))

    expect(screen.getByRole('button', { name: '#stretch', pressed: false })).toBeInTheDocument()
  })

  it('shows more than 8 used tags, with no cap', () => {
    const twelve = Array.from({ length: 12 }, (_, index) => `t${String(index + 10)}`)
    render(<Harness suggestions={twelve} />)

    expect(screen.getAllByRole('button')).toHaveLength(12)
  })

  it('puts a new tag after the used ones', async () => {
    render(<Harness suggestions={['legs']} />)

    await userEvent.type(input(), 'abs{Enter}')

    expect(screen.getAllByRole('button').map((chip) => chip.textContent)).toEqual(['#legs', '#abs'])
  })

  it('refuses an 11th tag tapped from the used ones', async () => {
    const ten = Array.from({ length: 10 }, (_, index) => `tag${String(index)}`)
    render(<Harness start={ten} suggestions={['extra']} />)

    await userEvent.click(screen.getByRole('button', { name: '#extra' }))

    expect(screen.getByRole('alert')).toHaveTextContent(TOO_MANY_TAGS)
    expect(screen.getByRole('button', { name: '#extra', pressed: false })).toBeInTheDocument()
  })

  it('shows no chip row when no tag was ever used', () => {
    render(<Harness />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('clears a stale message when an empty field loses focus', async () => {
    render(<Harness />)

    await userEvent.type(input(), '#{Enter}')
    await userEvent.clear(input())
    await userEvent.tab()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an error passed in by the form', () => {
    render(<Harness error="A video takes at most 10 tags." />)

    expect(screen.getByRole('alert')).toHaveTextContent('A video takes at most 10 tags.')
  })

  it('makes every tag button 44 px tall', () => {
    render(<Harness start={['yoga']} suggestions={['legs']} />)

    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveClass('min-h-11')
    }
  })
})
