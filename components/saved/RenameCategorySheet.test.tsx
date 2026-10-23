import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db, SIGNED_OUT_KEY } from '../../lib/db/dexie'
import { listVideoCategories, SignedOutOnThisDevice } from '../../lib/db/repository'
import { sampleCategory } from '../../tests/fixtures/videos'

import { NAME_TAKEN, RENAME_FAILED, RenameCategory } from './RenameCategorySheet'

vi.mock('../../lib/supabase/client', () => ({
  createClient: () => {
    throw new Error('no network in a component test')
  },
}))

const GYM = sampleCategory('Gym tricks', 'data-violet', '11111111-1111-4111-8111-111111111111')
const HOME = sampleCategory('Home', 'data-blue', '22222222-2222-4222-8222-222222222222')

beforeEach(async () => {
  await db.open()
  await Promise.all([db.videoCategories.clear(), db.outbox.clear(), db.syncMeta.clear()])
  await db.videoCategories.bulkPut([GYM, HOME])
})

async function openRename() {
  render(<RenameCategory category={GYM} />)
  await userEvent.click(screen.getByRole('button', { name: 'Rename Gym tricks' }))
  return screen.getByRole('dialog', { name: 'Rename category' })
}

async function rename(name: string) {
  const field = screen.getByLabelText('Name')
  await userEvent.clear(field)
  await userEvent.type(field, name)
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
}

describe('RenameCategory', () => {
  it('shows "Rename" only when 1 category is selected', () => {
    const { rerender } = render(<RenameCategory category={null} />)
    expect(screen.queryByRole('button', { name: /Rename/ })).not.toBeInTheDocument()

    rerender(<RenameCategory category={GYM} />)
    expect(screen.getByRole('button', { name: 'Rename Gym tricks' })).toHaveClass('min-h-11')
  })

  it('opens a 1 field sheet with the current name', async () => {
    await openRename()

    expect(screen.getByLabelText('Name')).toHaveValue('Gym tricks')
    expect(screen.getByLabelText('Name')).toHaveAttribute('maxLength', '40')
  })

  it('renames the category and closes', async () => {
    await openRename()

    await rename('Gym hacks')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect((await listVideoCategories()).map((row) => row.name)).toEqual(['Gym hacks', 'Home'])
  })

  it('shows "Another category has this name." for CategoryNameTaken', async () => {
    await openRename()

    await rename('home')

    expect(await screen.findByText(NAME_TAKEN)).toBeVisible()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('refuses an empty name under the field', async () => {
    await openRename()

    await userEvent.clear(screen.getByLabelText('Name'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')
    })
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription(
      'Enter a name for the category.',
    )
  })

  it('shows the signed out message', async () => {
    await db.syncMeta.put({ key: SIGNED_OUT_KEY, value: '2026-10-20T10:00:00.000Z' })
    await openRename()

    await rename('Gym hacks')

    expect(await screen.findByText(new SignedOutOnThisDevice().message)).toBeVisible()
  })

  it('says the rename failed for an unknown error', async () => {
    vi.spyOn(db.videoCategories, 'put').mockRejectedValueOnce(new Error('disk full'))
    await openRename()

    await rename('Gym hacks')

    expect(await screen.findByText(RENAME_FAILED)).toBeVisible()
  })

  it('closes from the close button', async () => {
    await openRename()

    await userEvent.click(screen.getByRole('button', { name: 'Close Rename category' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
