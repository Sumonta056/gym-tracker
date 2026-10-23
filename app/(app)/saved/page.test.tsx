import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../../../lib/db/dexie'

import SavedPage, { metadata } from './page'

vi.mock('../../../lib/supabase/client', () => ({
  createClient: () => {
    throw new Error('no network in a page test')
  },
}))

beforeEach(async () => {
  await db.open()
  await Promise.all([db.savedVideos.clear(), db.videoCategories.clear()])
})

describe('SavedPage', () => {
  it('shows the heading "Saved"', () => {
    render(<SavedPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Saved' })).toBeInTheDocument()
  })

  it('names the tab "Saved"', () => {
    expect(metadata.title).toBe('Saved')
  })

  it('builds no frame of its own, because the route group layout owns it', async () => {
    render(<SavedPage />)

    await screen.findByText('No videos yet.')
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})
