import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { MUSCLE_GROUPS } from '../../lib/schema/exercise'

import { ALL_LABEL, MUSCLE_GROUP_LABEL, MuscleGroupChips, fadeEdge } from './MuscleGroupChips'

describe('MuscleGroupChips', () => {
  it('is a toggle group with one button per muscle group and All first', () => {
    render(
      <MuscleGroupChips includeAll label="Muscle group" value={null} onValueChange={vi.fn()} />,
    )
    const buttons = within(screen.getByRole('group', { name: 'Muscle group' })).getAllByRole(
      'button',
    )
    expect(buttons.map((button) => button.textContent)).toEqual([
      ALL_LABEL,
      ...MUSCLE_GROUPS.map((group) => MUSCLE_GROUP_LABEL[group]),
    ])
    buttons.forEach((button) => {
      expect(button).toHaveAttribute('type', 'button')
    })
  })

  it('marks the chosen chip with aria-pressed', () => {
    render(
      <MuscleGroupChips includeAll label="Muscle group" value="back" onValueChange={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: 'Back' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('reports null for All and the group for a chip', async () => {
    const onValueChange = vi.fn()
    render(
      <MuscleGroupChips
        includeAll
        label="Muscle group"
        value="back"
        onValueChange={onValueChange}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Arms' }))
    await userEvent.click(screen.getByRole('button', { name: 'All' }))

    expect(onValueChange.mock.calls).toEqual([['arms'], [null]])
  })

  it('leaves out All when asked', () => {
    render(
      <MuscleGroupChips
        includeAll={false}
        label="Muscle group"
        value={null}
        onValueChange={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: 'All' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(MUSCLE_GROUPS.length)
  })

  it('keeps every chip at least 44 px tall', () => {
    render(
      <MuscleGroupChips includeAll label="Muscle group" value={null} onValueChange={vi.fn()} />,
    )
    screen.getAllByRole('button').forEach((button) => {
      expect(button.className).toContain('min-h-11')
    })
  })

  it('ties every chip to the error it is given', () => {
    render(
      <>
        <p id="chip-error">Pick a muscle group.</p>
        <MuscleGroupChips
          includeAll={false}
          label="Muscle group"
          value={null}
          describedBy="chip-error"
          onValueChange={vi.fn()}
        />
      </>,
    )
    screen.getAllByRole('button').forEach((button) => {
      expect(button).toHaveAccessibleDescription('Pick a muscle group.')
    })
  })
})

describe('fadeEdge', () => {
  it('fades nothing when the row fits', () => {
    expect(fadeEdge({ scrollLeft: 0, scrollWidth: 300, clientWidth: 300 })).toBe('none')
  })

  it('fades the end when more chips sit to the right', () => {
    expect(fadeEdge({ scrollLeft: 0, scrollWidth: 600, clientWidth: 300 })).toBe('end')
  })

  it('fades the start when the row is scrolled to its end', () => {
    expect(fadeEdge({ scrollLeft: 300, scrollWidth: 600, clientWidth: 300 })).toBe('start')
  })

  it('fades both edges in the middle of the row', () => {
    expect(fadeEdge({ scrollLeft: 150, scrollWidth: 600, clientWidth: 300 })).toBe('both')
  })

  it('ignores a scroll of less than 1 px, the rounding of a zoomed screen', () => {
    expect(fadeEdge({ scrollLeft: 0.5, scrollWidth: 600.5, clientWidth: 600 })).toBe('none')
  })
})

describe('MuscleGroupChips fade', () => {
  function sizeRow(
    row: HTMLElement,
    box: { scrollLeft: number; scrollWidth: number; clientWidth: number },
  ) {
    Object.defineProperty(row, 'scrollWidth', { configurable: true, value: box.scrollWidth })
    Object.defineProperty(row, 'clientWidth', { configurable: true, value: box.clientWidth })
    Object.defineProperty(row, 'scrollLeft', { configurable: true, value: box.scrollLeft })
  }

  it('shows no fade before the row is measured', () => {
    render(
      <MuscleGroupChips includeAll label="Muscle group" value={null} onValueChange={vi.fn()} />,
    )

    expect(screen.getByRole('group', { name: 'Muscle group' })).toHaveAttribute('data-fade', 'none')
  })

  it('fades the end, then the start, as the user scrolls the row', () => {
    render(
      <MuscleGroupChips includeAll label="Muscle group" value={null} onValueChange={vi.fn()} />,
    )
    const row = screen.getByRole('group', { name: 'Muscle group' })

    sizeRow(row, { scrollLeft: 0, scrollWidth: 600, clientWidth: 300 })
    fireEvent.scroll(row)
    expect(row).toHaveAttribute('data-fade', 'end')

    sizeRow(row, { scrollLeft: 300, scrollWidth: 600, clientWidth: 300 })
    fireEvent.scroll(row)
    expect(row).toHaveAttribute('data-fade', 'start')
  })

  it('measures again when the row changes size', () => {
    let resize: () => void = () => undefined
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback
        }
        observe() {
          return undefined
        }
        disconnect() {
          return undefined
        }
      },
    )
    render(
      <MuscleGroupChips includeAll label="Muscle group" value={null} onValueChange={vi.fn()} />,
    )
    const row = screen.getByRole('group', { name: 'Muscle group' })

    sizeRow(row, { scrollLeft: 0, scrollWidth: 600, clientWidth: 300 })
    act(() => {
      resize()
    })

    expect(row).toHaveAttribute('data-fade', 'end')
    vi.unstubAllGlobals()
  })

  it('pads the scroll edge so a focused chip stops clear of the fade', () => {
    render(
      <MuscleGroupChips includeAll label="Muscle group" value={null} onValueChange={vi.fn()} />,
    )

    expect(screen.getByRole('group', { name: 'Muscle group' })).toHaveClass('scroll-px-8')
  })

  it('keeps every chip a real button that the keyboard reaches under the fade', () => {
    render(
      <MuscleGroupChips includeAll label="Muscle group" value={null} onValueChange={vi.fn()} />,
    )

    const buttons = within(screen.getByRole('group', { name: 'Muscle group' })).getAllByRole(
      'button',
    )
    buttons.forEach((button) => {
      expect(button).not.toHaveAttribute('tabindex', '-1')
      expect(button).toHaveClass('min-h-11')
    })
  })
})
