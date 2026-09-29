import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { loadText, NO_LOAD, RecordBadge, repsText, SetRow } from './SetRow'

describe('loadText', () => {
  it('shows kilograms on a metric profile', () => {
    expect(loadText(72.5, 'metric')).toBe('72.5 kg')
  })

  it('shows pounds to two decimals on an imperial profile', () => {
    expect(loadText(60, 'imperial')).toBe('132.28 lb')
  })

  it('names a set with no load', () => {
    expect(loadText(null, 'metric')).toBe(NO_LOAD)
  })
})

describe('repsText', () => {
  it('uses the singular for one rep', () => {
    expect(repsText(1)).toBe('1 rep')
  })

  it('uses the plural for more', () => {
    expect(repsText(8)).toBe('8 reps')
  })
})

describe('RecordBadge', () => {
  it('carries the text PR, not colour alone', () => {
    render(<RecordBadge />)

    expect(screen.getByText('PR')).toBeInTheDocument()
  })
})

describe('SetRow', () => {
  function renderRow(isRecord: boolean) {
    render(
      <ul>
        <SetRow position={3} set={{ reps: 8, weight_kg: 75 }} unit="metric" isRecord={isRecord} />
      </ul>,
    )
    return screen.getByRole('listitem')
  }

  it('shows the position, the load and the reps', () => {
    const row = renderRow(false)

    expect(row).toHaveTextContent('Set 3')
    expect(row).toHaveTextContent('75 kg')
    expect(row).toHaveTextContent('8 reps')
  })

  it('shows the PR badge on a record set', () => {
    renderRow(true)

    expect(screen.getByText('PR')).toBeInTheDocument()
  })

  it('shows no badge on an ordinary set', () => {
    renderRow(false)

    expect(screen.queryByText('PR')).not.toBeInTheDocument()
  })

  it('holds a row at least 44 px tall', () => {
    expect(renderRow(false)).toHaveClass('min-h-11')
  })
})
