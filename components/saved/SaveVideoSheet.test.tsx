import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db, SIGNED_OUT_KEY } from '../../lib/db/dexie'
import {
  addSavedVideo,
  listSavedVideos,
  listVideoCategories,
  SignedOutOnThisDevice,
} from '../../lib/db/repository'
import { sampleCategory, sampleVideo } from '../../tests/fixtures/videos'

import { SAVE_FAILED, SaveVideoSheet, saveToDevice } from './SaveVideoSheet'

import type { SaveVideo } from './SaveVideoSheet'
import type { VideoCategory } from '../../lib/db/dexie'
import type { ListedVideo } from '../../lib/db/repository'

vi.mock('../../lib/supabase/client', () => ({
  createClient: () => {
    throw new Error('no network in a component test')
  },
}))

const GYM = sampleCategory('Gym tricks', 'data-violet', '11111111-1111-4111-8111-111111111111')
const YOGA_ID = '33333333-3333-4333-8333-333333333333'
const HOME = sampleCategory('Home', 'data-blue', '22222222-2222-4222-8222-222222222222')

beforeEach(async () => {
  await db.open()
  await Promise.all([
    db.savedVideos.clear(),
    db.videoCategories.clear(),
    db.outbox.clear(),
    db.syncMeta.clear(),
  ])
})

function show({
  video = null,
  categories = [GYM, HOME],
  tags = [],
  save,
}: {
  video?: ListedVideo | null
  categories?: VideoCategory[]
  tags?: string[]
  save?: SaveVideo
} = {}) {
  const onClose = vi.fn()
  const onSaved = vi.fn()
  render(
    <SaveVideoSheet
      open
      video={video}
      categories={categories}
      tags={tags}
      onClose={onClose}
      onSaved={onSaved}
      save={save}
    />,
  )
  return { onClose, onSaved, dialog: screen.getByRole('dialog') }
}

function categoryGroup() {
  return screen.getByRole('group', { name: 'Category' })
}

async function fillLinkAndTitle(link = 'https://youtu.be/x', title = 'Morning yoga flow') {
  await userEvent.type(screen.getByLabelText('Link'), link)
  await userEvent.type(screen.getByLabelText('Title'), title)
}

async function submit() {
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
}

describe('SaveVideoSheet', () => {
  it('opens empty with Normal selected and the first category chip unselected', async () => {
    const { dialog } = show()

    expect(dialog).toHaveAccessibleName('Save a video')
    expect(screen.getByLabelText('Link')).toHaveValue('')
    expect(screen.getByLabelText('Title')).toHaveValue('')
    expect(screen.getByRole('radio', { name: 'Normal' })).toBeChecked()
    expect(within(categoryGroup()).getByRole('button', { name: 'Gym tricks' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await waitFor(() => {
      expect(screen.getByLabelText('Link')).toHaveFocus()
    })
  })

  it('shows the field error and aria-invalid for a link without http or https', async () => {
    show()

    for (const bad of ['javascript:alert(1)', 'instagram://reel/x', 'www.youtube.com/x']) {
      await userEvent.clear(screen.getByLabelText('Link'))
      await userEvent.type(screen.getByLabelText('Link'), bad)
      await submit()

      const link = screen.getByLabelText('Link')
      await waitFor(() => {
        expect(link).toHaveAttribute('aria-invalid', 'true')
      })
      expect(link).toHaveAccessibleDescription('Enter a link that starts with http or https.')
    }
  })

  it('refuses a title of 121 characters', async () => {
    const save = vi.fn<SaveVideo>()
    show({ save })

    await userEvent.type(screen.getByLabelText('Link'), 'https://youtu.be/x')
    await userEvent.type(screen.getByLabelText('Title'), 'a'.repeat(121))
    await userEvent.click(within(categoryGroup()).getByRole('button', { name: 'Home' }))
    await submit()

    expect(await screen.findByText('A title cannot be longer than 120 characters.')).toBeVisible()
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true')
    expect(save).not.toHaveBeenCalled()
  })

  it('asks for a category when none is picked', async () => {
    show()

    await fillLinkAndTitle()
    await submit()

    expect(await within(categoryGroup()).findByRole('alert')).toHaveTextContent('Pick a category.')
  })

  it('shows the "+ New" input, max 40 characters, and selects the new name', async () => {
    show()

    await userEvent.click(within(categoryGroup()).getByRole('button', { name: '+ New' }))

    const name = screen.getByRole('textbox', { name: 'New category name' })
    expect(name).toHaveAttribute('maxLength', '40')
    await waitFor(() => {
      expect(name).toHaveFocus()
    })

    await userEvent.click(within(categoryGroup()).getByRole('button', { name: 'Home' }))
    expect(screen.queryByRole('textbox', { name: 'New category name' })).not.toBeInTheDocument()
  })

  it('hides the "+ New" chip while the name input is open', async () => {
    show()

    await userEvent.click(within(categoryGroup()).getByRole('button', { name: '+ New' }))

    expect(within(categoryGroup()).queryByRole('button', { name: '+ New' })).not.toBeInTheDocument()
    expect(within(categoryGroup()).getByRole('button', { name: 'Home' })).toBeInTheDocument()
  })

  it('restores the chip, clears the name and focuses the chip on cancel', async () => {
    show()

    await userEvent.click(within(categoryGroup()).getByRole('button', { name: '+ New' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'New category name' }), 'Yoga')
    await userEvent.click(
      within(categoryGroup()).getByRole('button', { name: 'Cancel new category' }),
    )

    const chip = within(categoryGroup()).getByRole('button', { name: '+ New' })
    expect(screen.queryByRole('textbox', { name: 'New category name' })).not.toBeInTheDocument()
    await waitFor(() => {
      expect(chip).toHaveFocus()
    })
    expect(within(categoryGroup()).getByRole('button', { name: 'Home' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    await userEvent.click(chip)
    expect(screen.getByRole('textbox', { name: 'New category name' })).toHaveValue('')
  })

  it('goes back to the category picked before "+ New" on cancel', async () => {
    show()

    await userEvent.click(within(categoryGroup()).getByRole('button', { name: 'Home' }))
    await userEvent.click(within(categoryGroup()).getByRole('button', { name: '+ New' }))
    await userEvent.click(
      within(categoryGroup()).getByRole('button', { name: 'Cancel new category' }),
    )

    expect(within(categoryGroup()).getByRole('button', { name: 'Home' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('asks for a name when "+ New" is left empty', async () => {
    show()

    await fillLinkAndTitle()
    await userEvent.click(within(categoryGroup()).getByRole('button', { name: '+ New' }))
    await submit()

    const name = screen.getByRole('textbox', { name: 'New category name' })
    await waitFor(() => {
      expect(name).toHaveAttribute('aria-invalid', 'true')
    })
    expect(name).toHaveAccessibleDescription('Enter a name for the category.')
  })

  it('saves a new category by name', async () => {
    show()

    await fillLinkAndTitle()
    await userEvent.click(within(categoryGroup()).getByRole('button', { name: '+ New' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'New category name' }), 'Yoga')
    await submit()

    await waitFor(async () => {
      expect((await listVideoCategories()).map((row) => row.name)).toEqual(['Yoga'])
    })
    const [saved] = await listSavedVideos()
    expect(saved?.category?.name).toBe('Yoga')
  })

  it('suggests used tags and adds one on tap', async () => {
    show({ tags: ['evening', 'legs'] })

    await userEvent.click(screen.getByRole('button', { name: 'Add tag legs' }))

    expect(screen.getByRole('button', { name: 'Remove tag legs' })).toBeInTheDocument()
  })

  it('saves and closes, and the new card shows at once', async () => {
    await db.videoCategories.put(HOME)
    const { onClose, onSaved } = show()

    await fillLinkAndTitle('  https://youtu.be/x  ')
    await userEvent.click(within(categoryGroup()).getByRole('button', { name: 'Home' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Add a tag' }), '#Yoga{Enter}')
    await userEvent.click(screen.getByText('High'))
    await submit()

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce()
    })
    expect(onSaved).toHaveBeenCalledOnce()
    const [saved] = await listSavedVideos()
    expect(saved).toMatchObject({
      url: 'https://youtu.be/x',
      title: 'Morning yoga flow',
      tags: ['yoga'],
      priority: 'high',
      category_id: HOME.id,
    })
  })

  it('opens with the video values in edit mode and saves with updateSavedVideo', async () => {
    await db.videoCategories.bulkPut([GYM, HOME])
    const stored = await addSavedVideo({
      url: 'https://youtu.be/old',
      title: 'Old title',
      tags: ['legs', 'gym'],
      priority: 'low',
      category: { id: GYM.id },
    })
    const [listed] = await listSavedVideos()
    const { dialog, onClose } = show({ video: listed ?? null })

    expect(dialog).toHaveAccessibleName('Edit video')
    expect(screen.getByLabelText('Link')).toHaveValue('https://youtu.be/old')
    expect(screen.getByLabelText('Title')).toHaveValue('Old title')
    expect(within(categoryGroup()).getByRole('button', { name: 'Gym tricks' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('radio', { name: 'Low' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Remove tag legs' })).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Title'))
    await userEvent.type(screen.getByLabelText('Title'), 'New title')
    await userEvent.click(within(categoryGroup()).getByRole('button', { name: 'Home' }))
    await submit()

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce()
    })
    const rows = await listSavedVideos()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: stored.id,
      title: 'New title',
      category_id: HOME.id,
      tags: ['legs', 'gym'],
      priority: 'low',
      created_at: stored.created_at,
    })
  })

  it('asks for a category again when the edited video has none on this device', () => {
    show({ video: sampleVideo('Orphan', { category: null }) })

    for (const chip of within(categoryGroup()).getAllByRole('button')) {
      expect(chip).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('shows the SignedOutOnThisDevice message and keeps the sheet open', async () => {
    await db.videoCategories.put(HOME)
    await db.syncMeta.put({ key: SIGNED_OUT_KEY, value: '2026-10-20T10:00:00.000Z' })
    const { onClose } = show()

    await fillLinkAndTitle()
    await userEvent.click(within(categoryGroup()).getByRole('button', { name: 'Home' }))
    await submit()

    expect(await screen.findByText(new SignedOutOnThisDevice().message)).toBeVisible()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(await listSavedVideos()).toEqual([])
  })

  it('says the save failed for an unknown error, and saves on a second try', async () => {
    const save = vi
      .fn<SaveVideo>()
      .mockRejectedValueOnce(new Error('disk full'))
      .mockImplementation(saveToDevice)
    await db.videoCategories.put(HOME)
    const { onClose } = show({ save })

    await fillLinkAndTitle()
    await userEvent.click(within(categoryGroup()).getByRole('button', { name: 'Home' }))
    await submit()

    expect(await screen.findByText(SAVE_FAILED)).toBeVisible()

    await submit()

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce()
    })
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('saves once on a double tap', async () => {
    let finish: () => void = () => undefined
    const save = vi.fn<SaveVideo>(
      (id, input) =>
        new Promise((resolve) => {
          finish = () => {
            resolve(saveToDevice(id, input))
          }
        }),
    )
    await db.videoCategories.put(HOME)
    show({ save })

    await fillLinkAndTitle()
    await userEvent.click(within(categoryGroup()).getByRole('button', { name: 'Home' }))
    await submit()
    await submit()
    finish()

    await waitFor(() => {
      expect(save).toHaveBeenCalledOnce()
    })
  })

  it('stores a tag still in the field when Save is pressed with no blur', async () => {
    await db.videoCategories.put(HOME)
    const { onClose } = show()

    await fillLinkAndTitle()
    await userEvent.click(within(categoryGroup()).getByRole('button', { name: 'Home' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Add a tag' }), '#Yoga')
    expect(screen.getByRole('textbox', { name: 'Add a tag' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce()
    })
    const [saved] = await listSavedVideos()
    expect(saved?.tags).toEqual(['yoga'])
  })

  it('refuses a lone # still in the tag field on Save, under the field', async () => {
    await db.videoCategories.put(HOME)
    const save = vi.fn<SaveVideo>()
    show({ save })

    await fillLinkAndTitle()
    await userEvent.click(within(categoryGroup()).getByRole('button', { name: 'Home' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Add a tag' }), '#')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const field = screen.getByRole('textbox', { name: 'Add a tag' })
    await waitFor(() => {
      expect(field).toHaveAttribute('aria-invalid', 'true')
    })
    expect(field).toHaveAccessibleDescription('A tag needs at least 1 letter after the #.')
    expect(save).not.toHaveBeenCalled()
  })

  it('refuses an 11th tag still in the field on Save', async () => {
    await db.videoCategories.put(HOME)
    const save = vi.fn<SaveVideo>()
    show({ save })

    await fillLinkAndTitle()
    await userEvent.click(within(categoryGroup()).getByRole('button', { name: 'Home' }))
    const field = screen.getByRole('textbox', { name: 'Add a tag' })
    for (let index = 0; index < 10; index += 1) {
      await userEvent.type(field, `tag${String(index)}{Enter}`)
    }
    await userEvent.type(field, 'eleven')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('A video takes at most 10 tags.')).toBeVisible()
    expect(save).not.toHaveBeenCalled()
  })

  it('saves "+ New" with the name of a live category under that category, with no second chip', async () => {
    await db.videoCategories.put(sampleCategory('Yoga', 'data-cyan', YOGA_ID))
    const [yoga] = await listVideoCategories()
    const { onClose } = show({ categories: yoga === undefined ? [] : [yoga] })

    await fillLinkAndTitle()
    await userEvent.click(within(categoryGroup()).getByRole('button', { name: '+ New' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'New category name' }), 'yoga')
    await submit()

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce()
    })
    expect((await listVideoCategories()).map((row) => row.id)).toEqual([YOGA_ID])
    const [saved] = await listSavedVideos()
    expect(saved?.category_id).toBe(YOGA_ID)
    expect(saved?.category?.name).toBe('Yoga')
  })

  it('closes from the close button', async () => {
    const { onClose } = show()

    await userEvent.click(screen.getByRole('button', { name: 'Close Save a video' }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
