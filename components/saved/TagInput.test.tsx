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
  return screen.getByRole('textbox', { name: 'Add a tag' })
}

describe('TagInput', () => {
  it('adds a typed tag on Enter, lower case with no #', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await userEvent.type(input(), '#Yoga{Enter}')

    expect(onChange).toHaveBeenLastCalledWith(['yoga'])
    expect(screen.getByRole('button', { name: 'Remove tag yoga' })).toHaveTextContent('#yoga')
    expect(input()).toHaveValue('')
  })

  it('adds a tag on a comma', async () => {
    render(<Harness />)

    await userEvent.type(input(), 'legs,')

    expect(screen.getByRole('button', { name: 'Remove tag legs' })).toBeInTheDocument()
  })

  it('adds the typed tag when the field loses focus', async () => {
    render(<Harness />)

    await userEvent.type(input(), 'core')
    await userEvent.tab()

    expect(screen.getByRole('button', { name: 'Remove tag core' })).toBeInTheDocument()
  })

  it('keeps 1 tag when the same word is typed twice', async () => {
    const onChange = vi.fn()
    render(<Harness start={['yoga']} onChange={onChange} />)

    await userEvent.type(input(), 'YOGA{Enter}')

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getAllByRole('button', { name: 'Remove tag yoga' })).toHaveLength(1)
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
    expect(screen.queryByRole('button', { name: 'Remove tag more' })).not.toBeInTheDocument()
  })

  it('removes a tag on tap', async () => {
    render(<Harness start={['yoga', 'legs']} />)

    await userEvent.click(screen.getByRole('button', { name: 'Remove tag yoga' }))

    expect(screen.queryByRole('button', { name: 'Remove tag yoga' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove tag legs' })).toBeInTheDocument()
  })

  it('suggests used tags that are not chosen, and adds one on tap', async () => {
    render(<Harness start={['legs']} suggestions={['evening', 'legs', 'stretch']} />)

    const suggested = screen.getByRole('group', { name: 'Suggested tags' })
    expect(suggested).toHaveTextContent('#evening#stretch')

    await userEvent.click(screen.getByRole('button', { name: 'Add tag stretch' }))

    expect(screen.getByRole('button', { name: 'Remove tag stretch' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add tag stretch' })).not.toBeInTheDocument()
  })

  it('shows no suggestion row when every used tag is chosen', () => {
    render(<Harness start={['legs']} suggestions={['legs']} />)

    expect(screen.queryByRole('group', { name: 'Suggested tags' })).not.toBeInTheDocument()
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
