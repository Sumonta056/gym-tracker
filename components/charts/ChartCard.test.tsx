import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { setReducedMotion } from '../../tests/fixtures/motion'

import { ChartCard, SPARSE_HINT, SparseValue } from './ChartCard'
import { DRAW_CLASS, LABEL_FADE_MS, LINE_DRAW_MS } from './useLineDraw'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function drawn(label = 'Steps per day') {
  return (
    <ChartCard title="Steps" empty={false} emptyText="Nothing yet." label={label}>
      <svg>
        <text>706</text>
      </svg>
    </ChartCard>
  )
}

describe('ChartCard', () => {
  it('marks the chart for its first draw when the user has no motion preference', () => {
    setReducedMotion(false)
    render(drawn())
    expect(screen.getByRole('img')).toHaveClass(DRAW_CLASS)
  })

  it('keeps every chart label in the document while the lines draw', () => {
    setReducedMotion(false)
    render(drawn())
    expect(screen.getByText('706')).toBeInTheDocument()
  })

  it('does not replay the draw on a re-render', () => {
    vi.useFakeTimers()
    setReducedMotion(false)
    const { rerender } = render(drawn())
    act(() => {
      vi.advanceTimersByTime(LINE_DRAW_MS + LABEL_FADE_MS)
    })
    rerender(drawn('Steps per day, updated'))
    expect(screen.getByRole('img')).not.toHaveClass(DRAW_CLASS)
  })

  it('runs no draw and puts every label in the document at once with reduced motion', () => {
    setReducedMotion(true)
    render(drawn())
    expect(screen.getByRole('img')).not.toHaveClass(DRAW_CLASS)
    expect(screen.getByText('706')).toBeInTheDocument()
  })

  it('shows the empty text and no chart when empty', () => {
    render(
      <ChartCard title="Steps" summary="0 total" empty emptyText="Nothing yet." label="Steps">
        <svg />
      </ChartCard>,
    )
    expect(screen.getByText('Nothing yet.')).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByText('0 total')).not.toBeInTheDocument()
  })

  it('wraps the chart in an image named by its label', () => {
    render(
      <ChartCard title="Steps" empty={false} emptyText="Nothing yet." label="Steps per day">
        <svg />
      </ChartCard>,
    )
    expect(screen.getByRole('img', { name: 'Steps per day' })).toBeInTheDocument()
  })

  it('names the chart by a heading', () => {
    render(
      <ChartCard title="Steps" empty={false} emptyText="Nothing yet." label="Steps per day">
        <svg />
      </ChartCard>,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Steps' })).toBeInTheDocument()
  })

  it('shows the legend and the footer beside the chart', () => {
    render(
      <ChartCard
        title="Steps"
        empty={false}
        emptyText="Nothing yet."
        label="Steps per day"
        legend={[{ name: 'Steps', dot: 'bg-data-cyan' }]}
        footer={<p>Footer</p>}
      >
        <svg />
      </ChartCard>,
    )
    expect(screen.getByRole('listitem')).toHaveTextContent('Steps')
    expect(screen.getByText('Footer')).toBeVisible()
  })

  it('shows the latest value and the hint instead of the chart when the series is too short', () => {
    render(
      <ChartCard
        title="Weight"
        summary="73.4 kg"
        empty={false}
        emptyText="Nothing yet."
        label="Weight per day"
        legend={[{ name: 'Weight', dot: 'bg-data-violet' }]}
        sparse={<SparseValue parts={[{ value: '73.4', unit: 'kg' }]} />}
      >
        <svg />
      </ChartCard>,
    )
    expect(screen.getByText(SPARSE_HINT)).toBeVisible()
    expect(SPARSE_HINT).toBe('Log one more day to see a trend.')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('separates the parts of a sparse value with a dot', () => {
    const { container } = render(
      <SparseValue
        parts={[
          { value: '113', unit: 'avg' },
          { value: '168', unit: 'max' },
        ]}
      />,
    )
    expect(container).toHaveTextContent('113 avg · 168 max')
  })
})
