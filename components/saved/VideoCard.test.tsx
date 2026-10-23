import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { openTarget } from '../../lib/links/openTarget'
import { sampleCategory, sampleVideo } from '../../tests/fixtures/videos'

import { VideoCard } from './VideoCard'

import type { ListedVideo } from '../../lib/db/repository'

const GYM = sampleCategory('Gym tricks', 'data-violet')

function show(video: ListedVideo, standalone = false) {
  const onEdit = vi.fn()
  const onDelete = vi.fn()
  render(
    <ul>
      <VideoCard video={video} standalone={standalone} onEdit={onEdit} onDelete={onDelete} />
    </ul>,
  )
  return { onEdit, onDelete }
}

describe('VideoCard', () => {
  it('is a link whose href and target come from openTarget', () => {
    const video = sampleVideo('Bench press', {
      url: 'https://www.instagram.com/reel/Cx4f9',
      category: GYM,
    })
    show(video)

    const link = screen.getByRole('link', { name: /Bench press/ })
    const expected = openTarget(video.url, { standalone: false })
    expect(link).toHaveAttribute('href', expected.href)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('passes the standalone flag to openTarget', () => {
    const video = sampleVideo('Box breathing', { url: 'https://example.com/a' })
    show(video, true)

    const link = screen.getByRole('link', { name: /Box breathing/ })
    expect(link).toHaveAttribute('href', openTarget(video.url, { standalone: true }).href)
  })

  it('adds no rel when the link opens in the same window', () => {
    show(sampleVideo('Blocked', { url: 'javascript:alert(1)' }))

    const link = screen.getByRole('link', { name: /Blocked/ })
    expect(link).toHaveAttribute('href', 'about:blank')
    expect(link).not.toHaveAttribute('target')
    expect(link).not.toHaveAttribute('rel')
  })

  it('shows the title, the category dot and name, and the tags', () => {
    show(sampleVideo('Bench press', { category: GYM, tags: ['chest', 'gym'] }))

    const link = screen.getByRole('link', { name: /Bench press/ })
    expect(within(link).getByText('Bench press')).toBeInTheDocument()
    expect(within(link).getByTestId('video-category')).toHaveTextContent('Gym tricks')
    expect(within(link).getByTestId('category-dot')).toHaveClass('bg-data-violet')
    expect(within(link).getByText('#chest')).toBeInTheDocument()
    expect(within(link).getByText('#gym')).toBeInTheDocument()
  })

  it('shows a "High" badge for high, a "Low" badge for low, and none for normal', () => {
    show(sampleVideo('High one', { priority: 'high' }))
    show(sampleVideo('Low one', { priority: 'low' }))
    show(sampleVideo('Normal one', { priority: 'normal' }))

    const high = screen.getByRole('link', { name: /High one/ })
    const low = screen.getByRole('link', { name: /Low one/ })
    const normal = screen.getByRole('link', { name: /Normal one/ })
    expect(within(high).getByText('High')).toHaveClass('bg-accent', 'text-accent-ink')
    expect(within(low).getByText('Low')).toHaveClass('bg-surface-2', 'text-muted')
    expect(within(normal).queryByText('High')).not.toBeInTheDocument()
    expect(within(normal).queryByText('Low')).not.toBeInTheDocument()
    expect(within(normal).queryByText('Normal')).not.toBeInTheDocument()
  })

  it('greys the title of a low video', () => {
    show(sampleVideo('Low one', { priority: 'low' }))

    expect(screen.getByText('Low one')).toHaveClass('text-muted')
  })

  it('shows no category line when the category is null', () => {
    show(sampleVideo('Orphan', { category: null, tags: ['yoga'] }))

    expect(screen.queryByTestId('video-category')).not.toBeInTheDocument()
    expect(screen.queryByTestId('category-dot')).not.toBeInTheDocument()
    expect(screen.getByText('#yoga')).toBeInTheDocument()
  })

  it('wraps a long unbroken title inside the card', () => {
    const title = 'x'.repeat(120)
    show(sampleVideo(title))

    expect(screen.getByText(title)).toHaveClass('break-words')
    expect(screen.getByRole('link', { name: new RegExp(title) })).toHaveClass('min-w-0')
  })

  it('has a 44 px "More for <title>" button that opens Edit and Delete', async () => {
    const { onEdit, onDelete } = show(sampleVideo('Grip trick', { category: GYM }))
    const more = screen.getByRole('button', { name: 'More for Grip trick' })

    expect(more).toHaveClass('size-11')
    expect(screen.getByRole('link', { name: /Grip trick/ })).not.toContainElement(more)

    await userEvent.click(more)
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(onEdit).toHaveBeenCalledOnce()

    await userEvent.click(more)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledOnce()
  })
})
