import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ChartCard, SPARSE_HINT, SparseValue } from './ChartCard'

describe('ChartCard', () => {
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
