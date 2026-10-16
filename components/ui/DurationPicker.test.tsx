import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import {
  DurationPicker,
  NOT_SET,
  presetLabel,
  REST_PRESETS,
  stepSeconds,
  stepWords,
} from './DurationPicker'

function Harness({
  initial = 90,
  allowClear = false,
  min,
  max,
  step,
  errorId,
  onSeen = () => undefined,
}: {
  initial?: number | null
  allowClear?: boolean
  min?: number
  max?: number
  step?: number
  errorId?: string
  onSeen?: (seconds: number | null) => void
}) {
  const [value, setValue] = useState<number | null>(initial)

  return (
    <DurationPicker
      id="rest"
      label="Rest time"
      value={value}
      onChange={(next) => {
        onSeen(next)
        setValue(next)
      }}
      presets={REST_PRESETS}
      allowClear={allowClear}
      min={min}
      max={max}
      step={step}
      errorId={errorId}
    />
  )
}

function group() {
  return screen.getByRole('group', { name: 'Rest time' })
}

describe('stepWords', () => {
  it('names a step under a minute in seconds', () => {
    expect(stepWords(15)).toBe('15 seconds')
    expect(stepWords(1)).toBe('1 second')
  })

  it('names a whole minute step in minutes', () => {
    expect(stepWords(60)).toBe('1 minute')
    expect(stepWords(300)).toBe('5 minutes')
  })
})

describe('presetLabel', () => {
  it('writes a whole minute short and any other value as a clock', () => {
    expect(presetLabel(90)).toBe('1:30')
    expect(presetLabel(60)).toBe('1m')
    expect(presetLabel(3600)).toBe('1h')
    expect(presetLabel(5400)).toBe('1h 30m')
  })
})

describe('stepSeconds', () => {
  it('starts from min when there is no value', () => {
    expect(stepSeconds(null, 15, 0, 3600)).toBe(15)
  })

  it('gives min on the first step up from no value', () => {
    expect(stepSeconds(null, 300, 300, 86400)).toBe(300)
  })

  it('gives one step on the first step up from no value when min is below the step', () => {
    expect(stepSeconds(null, 60, 0, 86400)).toBe(60)
  })

  it('gives min on a step down from no value', () => {
    expect(stepSeconds(null, -300, 300, 86400)).toBe(300)
  })

  it('keeps the first step from no value under max', () => {
    expect(stepSeconds(null, 300, 0, 120)).toBe(120)
  })

  it('never goes below min or above max', () => {
    expect(stepSeconds(10, -15, 0, 3600)).toBe(0)
    expect(stepSeconds(3590, 15, 0, 3600)).toBe(3600)
  })
})

describe('DurationPicker', () => {
  it('is a group named by its visible label', () => {
    render(<Harness />)
    expect(group()).toBeInTheDocument()
  })

  it('shows the value as a clock, and Not set when there is none', () => {
    const { unmount } = render(<Harness initial={90} />)
    expect(within(group()).getByRole('status')).toHaveTextContent('1:30')
    unmount()
    render(<Harness initial={null} />)
    expect(within(group()).getByRole('status')).toHaveTextContent(NOT_SET)
  })

  it('presses only the preset equal to the value', () => {
    render(<Harness initial={90} />)
    expect(within(group()).getByRole('button', { name: '1:30' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    for (const name of ['1m', '2m', '3m']) {
      expect(within(group()).getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('hands the preset seconds to its owner', async () => {
    const onSeen = vi.fn()
    render(<Harness onSeen={onSeen} />)
    await userEvent.click(within(group()).getByRole('button', { name: '2m' }))
    expect(onSeen).toHaveBeenLastCalledWith(120)
  })

  it('hands max for a preset above max', async () => {
    const onSeen = vi.fn()
    render(<Harness max={100} onSeen={onSeen} />)
    await userEvent.click(within(group()).getByRole('button', { name: '3m' }))
    expect(onSeen).toHaveBeenLastCalledWith(100)
  })

  it('adds and takes off one step', async () => {
    render(<Harness initial={90} />)
    await userEvent.click(screen.getByRole('button', { name: 'Increase Rest time by 15 seconds' }))
    expect(within(group()).getByRole('status')).toHaveTextContent('1:45')
    await userEvent.click(screen.getByRole('button', { name: 'Decrease Rest time by 15 seconds' }))
    await userEvent.click(screen.getByRole('button', { name: 'Decrease Rest time by 15 seconds' }))
    expect(within(group()).getByRole('status')).toHaveTextContent('1:15')
  })

  it('steps an unset value up to min, then by one step', async () => {
    render(<Harness initial={null} min={300} step={300} />)
    const plus = screen.getByRole('button', { name: 'Increase Rest time by 5 minutes' })
    await userEvent.click(plus)
    expect(within(group()).getByRole('status')).toHaveTextContent('5:00')
    await userEvent.click(plus)
    expect(within(group()).getByRole('status')).toHaveTextContent('10:00')
  })

  it('ties an error to the group', () => {
    render(
      <>
        <Harness errorId="rest-error" />
        <p id="rest-error">Too short.</p>
      </>,
    )
    expect(group()).toHaveAccessibleDescription('Too short.')
  })

  it('ties no description to the group with no error', () => {
    render(<Harness />)
    expect(group()).not.toHaveAttribute('aria-describedby')
  })

  it('names the step buttons by a minute step', () => {
    render(<Harness step={60} />)
    expect(screen.getByRole('button', { name: 'Increase Rest time by 1 minute' })).toBeVisible()
  })

  it('turns the minus button off at min and with no value, and the plus button off at max', () => {
    const { unmount } = render(<Harness initial={0} />)
    expect(screen.getByRole('button', { name: /^Decrease/ })).toBeDisabled()
    unmount()
    const second = render(<Harness initial={null} />)
    expect(screen.getByRole('button', { name: /^Decrease/ })).toBeDisabled()
    second.unmount()
    render(<Harness initial={100} max={100} />)
    expect(screen.getByRole('button', { name: /^Increase/ })).toBeDisabled()
  })

  it('clears to null when clear is allowed and a value is set', async () => {
    const onSeen = vi.fn()
    render(<Harness allowClear onSeen={onSeen} />)
    await userEvent.click(screen.getByRole('button', { name: 'Clear Rest time' }))
    expect(onSeen).toHaveBeenLastCalledWith(null)
    expect(screen.queryByRole('button', { name: 'Clear Rest time' })).not.toBeInTheDocument()
  })

  it('moves focus to the picker group when Clear hides itself', async () => {
    render(<Harness allowClear />)
    await userEvent.click(screen.getByRole('button', { name: 'Clear Rest time' }))
    expect(group()).toHaveFocus()
  })

  it('draws the clear button as a trash icon with no visible text', () => {
    render(<Harness allowClear />)
    const clear = screen.getByRole('button', { name: 'Clear Rest time' })
    expect(clear).toHaveTextContent('')
    expect(clear.querySelector('svg')).toHaveAttribute('data-icon', 'trash')
    expect(clear).toHaveClass('text-muted')
  })

  it('keeps the picker group focusable but out of the tab order', () => {
    render(<Harness />)
    expect(group()).toHaveAttribute('tabindex', '-1')
  })

  it('shows no clear button without allowClear', () => {
    render(<Harness />)
    expect(screen.queryByRole('button', { name: /^Clear/ })).not.toBeInTheDocument()
  })

  it('gives every button a type and a 44 px target', () => {
    render(<Harness allowClear />)
    for (const button of within(group()).getAllByRole('button')) {
      expect(button).toHaveAttribute('type', 'button')
      expect(button.className).toMatch(/\b(min-h-11|size-11)\b/)
    }
  })

  it('holds no text field, so no keyboard opens', () => {
    render(<Harness />)
    expect(within(group()).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(group()).queryByRole('spinbutton')).not.toBeInTheDocument()
  })
})
