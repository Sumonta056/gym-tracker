import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MuscleTags, muscleName } from './MuscleTags'

function tags() {
  render(<MuscleTags primary={['chest']} secondary={['shoulders', 'middle back']} />)
  return within(screen.getByRole('list', { name: 'Muscles' })).getAllByRole('listitem')
}

describe('muscleName', () => {
  it('capitalises the first letter only', () => {
    expect(muscleName('middle back')).toBe('Middle back')
  })
})

describe('MuscleTags', () => {
  it('shows 1 chip per muscle, the main ones first', () => {
    expect(tags().map((tag) => tag.textContent)).toEqual([
      'Chest, main',
      'Shoulders, helper',
      'Middle back, helper',
    ])
  })

  it('marks the main and the helper chips', () => {
    expect(tags().map((tag) => tag.getAttribute('data-role'))).toEqual([
      'primary',
      'secondary',
      'secondary',
    ])
  })

  it('gives each dot its group colour and hides it from the reader', () => {
    const [chest, shoulders, back] = tags().map((tag) => tag.querySelector('[aria-hidden]'))
    expect(chest?.className).toContain('bg-accent')
    expect(shoulders?.className).toContain('bg-data-blue')
    expect(back?.className).toContain('bg-data-cyan')
  })

  it('draws a helper dot at 55 percent and a main dot solid', () => {
    const [chest, shoulders] = tags().map((tag) => tag.querySelector('[aria-hidden]'))
    expect(chest?.className).not.toContain('opacity-55')
    expect(shoulders?.className).toContain('opacity-55')
  })

  it('draws a helper chip with a dashed border and a main chip with a solid one', () => {
    const [chest, shoulders] = tags()
    expect(shoulders?.className).toContain('border-dashed')
    expect(chest?.className).not.toContain('border-dashed')
    expect(chest?.className).toContain('border-solid')
  })

  it('adds a class name from the caller', () => {
    render(<MuscleTags primary={['chest']} secondary={[]} className="mt-2.5" />)
    expect(screen.getByRole('list').className).toContain('mt-2.5')
  })
})
