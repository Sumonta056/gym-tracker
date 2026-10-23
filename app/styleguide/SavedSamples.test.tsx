import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { SAMPLE_VIDEOS, SavedListSample, SaveFormSample } from './SavedSamples'

describe('SavedListSample', () => {
  it('shows the chips and a High, a Normal and a Low card', () => {
    render(<SavedListSample />)

    const sample = within(screen.getByTestId('saved-list-sample'))
    expect(sample.getByText('7 videos · 4 categories')).toBeInTheDocument()
    expect(sample.getByRole('group', { name: 'Category' })).toHaveTextContent('All 7')
    const cards = sample.getAllByRole('listitem')
    expect(cards).toHaveLength(SAMPLE_VIDEOS.length)
    expect(within(cards[0] as HTMLElement).getByText('High')).toBeInTheDocument()
    expect(within(cards.at(-1) as HTMLElement).getByText('Low')).toBeInTheDocument()
  })

  it('shows the empty state', () => {
    render(<SavedListSample />)

    expect(
      within(screen.getByTestId('saved-empty-sample')).getByText('No videos yet.'),
    ).toBeInTheDocument()
  })
})

describe('SaveFormSample', () => {
  it('opens the save form empty', async () => {
    render(<SaveFormSample />)

    await userEvent.click(screen.getByRole('button', { name: 'Open the save form' }))

    const dialog = screen.getByRole('dialog', { name: 'Save a video' })
    expect(within(dialog).getByLabelText('Link')).toHaveValue('')
    expect(within(dialog).getByRole('button', { name: 'Add tag stretch' })).toBeInTheDocument()
  })

  it('opens the edit form with the first sample video', async () => {
    render(<SaveFormSample />)

    await userEvent.click(screen.getByRole('button', { name: 'Open the edit form' }))

    const dialog = screen.getByRole('dialog', { name: 'Edit video' })
    expect(within(dialog).getByLabelText('Title')).toHaveValue(SAMPLE_VIDEOS[0]?.title)
  })

  it('closes after a sample save with no write', async () => {
    render(<SaveFormSample />)

    await userEvent.click(screen.getByRole('button', { name: 'Open the edit form' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('closes after a sample save of a new category', async () => {
    render(<SaveFormSample />)

    await userEvent.click(screen.getByRole('button', { name: 'Open the save form' }))
    const dialog = within(screen.getByRole('dialog'))
    await userEvent.type(dialog.getByLabelText('Link'), 'https://youtu.be/x')
    await userEvent.type(dialog.getByLabelText('Title'), 'Yoga flow')
    await userEvent.click(dialog.getByRole('button', { name: '+ New' }))
    await userEvent.type(dialog.getByRole('textbox', { name: 'New category name' }), 'Yoga')
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
