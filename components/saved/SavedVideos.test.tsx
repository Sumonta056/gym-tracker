import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db, SIGNED_OUT_KEY } from '../../lib/db/dexie'
import {
  addSavedVideo,
  deleteSavedVideo,
  listSavedVideos,
  SignedOutOnThisDevice,
  updateSavedVideo,
} from '../../lib/db/repository'

import {
  DELETE_FAILED,
  NO_MATCH,
  NO_VIDEOS,
  READ_FAILED,
  RESTORE_FAILED,
  SavedVideos,
  VIDEO_REMOVED,
} from './SavedVideos'

import type * as Repository from '../../lib/db/repository'
import type { Priority } from '../../lib/schema/savedVideo'

const failing = vi.hoisted(() => ({ read: false }))

vi.mock('../../lib/db/repository', async (importOriginal) => {
  const actual = await importOriginal<typeof Repository>()
  return {
    ...actual,
    listSavedVideos: () =>
      failing.read ? Promise.reject(new Error('blocked')) : actual.listSavedVideos(),
  }
})

vi.mock('../../lib/supabase/client', () => ({
  createClient: () => {
    throw new Error('no network in a component test')
  },
}))

beforeEach(async () => {
  failing.read = false
  await db.open()
  await Promise.all([
    db.savedVideos.clear(),
    db.videoCategories.clear(),
    db.outbox.clear(),
    db.syncMeta.clear(),
  ])
})

let clock = Date.parse('2026-10-20T09:00:00.000Z')

async function save(
  title: string,
  category: string,
  priority: Priority = 'normal',
  tags: string[] = [],
) {
  clock += 60000
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(clock)
  try {
    return await addSavedVideo({
      url: `https://youtu.be/${title.replace(/\s+/g, '-')}`,
      title,
      tags,
      priority,
      category: { name: category },
    })
  } finally {
    vi.useRealTimers()
  }
}

async function seedSeven() {
  await save('Hip opener before legs', 'Stretching', 'low', ['legs'])
  await save('20 min home workout', 'Home', 'normal', ['fullbody'])
  await save('Grip trick for pull ups', 'Gym tricks', 'normal', ['back'])
  await save('5 min box breathing', 'Meditation', 'normal', ['evening'])
  await save('Bench press form fix', 'Gym tricks', 'high', ['chest', 'gym'])
  await save('Rest time between sets', 'Gym tricks', 'low', ['gym'])
  await save('Shoulder mobility warm up', 'Stretching', 'low', ['shoulders'])
}

function list() {
  return screen.getByRole('list', { name: 'Saved videos' })
}

function titles(): string[] {
  return within(list())
    .getAllByRole('link')
    .map((link) => link.querySelector('span')?.textContent ?? '')
}

function chip(name: RegExp) {
  return within(screen.getByRole('group', { name: 'Category' })).getByRole('button', { name })
}

async function ready() {
  render(<SavedVideos />)
  await screen.findByRole('list', { name: 'Saved videos' })
}

async function deleteVia(title: string) {
  await userEvent.click(screen.getByRole('button', { name: `More for ${title}` }))
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
}

describe('SavedVideos', () => {
  it('shows "7 videos · 4 categories" under the heading', async () => {
    await seedSeven()
    await ready()

    expect(screen.getByRole('heading', { level: 1, name: 'Saved' })).toBeInTheDocument()
    expect(screen.getByText('7 videos · 4 categories')).toBeInTheDocument()
  })

  it('lists High, then Normal, then Low', async () => {
    await seedSeven()
    await ready()

    expect(titles()).toEqual([
      'Bench press form fix',
      '5 min box breathing',
      'Grip trick for pull ups',
      '20 min home workout',
      'Shoulder mobility warm up',
      'Rest time between sets',
      'Hip opener before legs',
    ])
  })

  it('shows All first, then each category A to Z with its count', async () => {
    await seedSeven()
    await ready()

    const names = within(screen.getByRole('group', { name: 'Category' }))
      .getAllByRole('button')
      .map((button) => button.textContent)
    expect(names).toEqual(['All 7', 'Gym tricks 3', 'Home 1', 'Meditation 1', 'Stretching 2'])
  })

  it('filters to 1 category when its chip is pressed, and the chip is aria-pressed', async () => {
    await seedSeven()
    await ready()

    await userEvent.click(chip(/^Gym tricks/))

    expect(chip(/^Gym tricks/)).toHaveAttribute('aria-pressed', 'true')
    expect(chip(/^All/)).toHaveAttribute('aria-pressed', 'false')
    expect(titles()).toEqual([
      'Bench press form fix',
      'Grip trick for pull ups',
      'Rest time between sets',
    ])
  })

  it('offers Rename only while 1 category is selected', async () => {
    await seedSeven()
    await ready()

    expect(screen.queryByRole('button', { name: /^Rename/ })).not.toBeInTheDocument()

    await userEvent.click(chip(/^Home/))

    expect(screen.getByRole('button', { name: 'Rename Home' })).toBeInTheDocument()
  })

  it('narrows the list as the owner types a tag in "Search titles and tags"', async () => {
    await seedSeven()
    await ready()

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search titles and tags' }), '#gym')

    expect(titles()).toEqual(['Bench press form fix', 'Rest time between sets'])
  })

  it('finds a video by a title word', async () => {
    await seedSeven()
    await ready()

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search titles and tags' }), 'GRIP')

    expect(titles()).toEqual(['Grip trick for pull ups'])
  })

  it('says "No videos yet." with the + Save button when there are none', async () => {
    render(<SavedVideos />)

    expect(await screen.findByText(NO_VIDEOS)).toBeInTheDocument()
    expect(screen.getByText('0 videos · 0 categories')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Save a video' })).toHaveLength(2)
    expect(screen.queryByRole('group', { name: 'Category' })).not.toBeInTheDocument()
  })

  it('opens the form from the empty state', async () => {
    render(<SavedVideos />)
    await screen.findByText(NO_VIDEOS)

    const [, fromEmpty] = screen.getAllByRole('button', { name: 'Save a video' })
    await userEvent.click(fromEmpty ?? document.body)

    expect(screen.getByRole('dialog', { name: 'Save a video' })).toBeInTheDocument()
  })

  it('says "Nothing matches." when a filter or search finds none', async () => {
    await seedSeven()
    await ready()

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search titles and tags' }), 'zumba')

    expect(screen.getByText(NO_MATCH)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Saved videos' })).not.toBeInTheDocument()
  })

  it('falls back to All when the last video of the selected category is deleted', async () => {
    await seedSeven()
    await ready()

    await userEvent.click(chip(/^Home/))
    await deleteVia('20 min home workout')

    await waitFor(() => {
      expect(chip(/^All/)).toHaveAttribute('aria-pressed', 'true')
    })
    expect(
      within(screen.getByRole('group', { name: 'Category' })).queryByRole('button', {
        name: /^Home/,
      }),
    ).not.toBeInTheDocument()
    expect(titles()).toHaveLength(6)
  })

  it('falls back to All when the last video of the selected category moves by edit', async () => {
    await seedSeven()
    await ready()
    const [home] = (await listSavedVideos()).filter((video) => video.category?.name === 'Home')

    await userEvent.click(chip(/^Home/))
    await act(async () => {
      await updateSavedVideo(home?.id ?? '', {
        url: home?.url ?? '',
        title: home?.title ?? '',
        tags: home?.tags ?? [],
        priority: home?.priority ?? 'normal',
        category: { name: 'Stretching' },
      })
    })

    await waitFor(() => {
      expect(chip(/^All/)).toHaveAttribute('aria-pressed', 'true')
    })
    expect(titles()).toHaveLength(7)
  })

  it('soft deletes at once with no confirm and shows the undo toast', async () => {
    await seedSeven()
    await ready()

    await deleteVia('Grip trick for pull ups')

    expect(await screen.findByTestId('undo-toast')).toHaveTextContent(VIDEO_REMOVED)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(titles()).not.toContain('Grip trick for pull ups')
    })
    const stored = await db.savedVideos.toArray()
    expect(stored).toHaveLength(7)
    expect(stored.filter((row) => row.deleted_at !== null)).toHaveLength(1)
  })

  it('brings the video and its chip back on Undo', async () => {
    await seedSeven()
    await ready()

    await userEvent.click(chip(/^Meditation/))
    await deleteVia('5 min box breathing')
    await waitFor(() => {
      expect(chip(/^All/)).toHaveAttribute('aria-pressed', 'true')
    })

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))

    await waitFor(() => {
      expect(chip(/^Meditation/)).toBeInTheDocument()
    })
    expect(titles()).toContain('5 min box breathing')
    expect(screen.queryByTestId('undo-toast')).not.toBeInTheDocument()
  })

  it('names a signed-out device when a delete is refused', async () => {
    await seedSeven()
    await ready()
    await db.syncMeta.put({ key: SIGNED_OUT_KEY, value: '2026-10-20T10:00:00.000Z' })

    await deleteVia('Grip trick for pull ups')

    expect(await screen.findByText(new SignedOutOnThisDevice().message)).toBeInTheDocument()
    expect(titles()).toContain('Grip trick for pull ups')
  })

  it('says the delete failed for an unknown error', async () => {
    await seedSeven()
    await ready()
    vi.spyOn(db.savedVideos, 'put').mockRejectedValueOnce(new Error('disk full'))

    await deleteVia('Grip trick for pull ups')

    expect(await screen.findByText(DELETE_FAILED)).toBeInTheDocument()
  })

  it('names a signed-out device when an undo is refused', async () => {
    await seedSeven()
    await ready()
    await deleteVia('Grip trick for pull ups')
    await screen.findByTestId('undo-toast')
    await db.syncMeta.put({ key: SIGNED_OUT_KEY, value: '2026-10-20T10:00:00.000Z' })

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))

    expect(await screen.findByText(new SignedOutOnThisDevice().message)).toBeInTheDocument()
  })

  it('says the video could not be restored when Undo fails', async () => {
    await seedSeven()
    await ready()
    await deleteVia('Grip trick for pull ups')
    await screen.findByTestId('undo-toast')
    vi.spyOn(db.savedVideos, 'put').mockRejectedValueOnce(new Error('disk full'))

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))

    expect(await screen.findByText(RESTORE_FAILED)).toBeInTheDocument()
    expect(screen.queryByText(DELETE_FAILED)).not.toBeInTheDocument()
  })

  it('drops the toast when it times out', async () => {
    await seedSeven()
    await ready()
    await deleteVia('Grip trick for pull ups')
    const toast = await screen.findByTestId('undo-toast')

    await waitFor(
      () => {
        expect(toast).not.toBeInTheDocument()
      },
      { timeout: 7000 },
    )
  }, 10000)

  it('opens the form in edit mode from the menu and saves the change', async () => {
    await seedSeven()
    await ready()

    await userEvent.click(screen.getByRole('button', { name: 'More for 20 min home workout' }))
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))

    const dialog = screen.getByRole('dialog', { name: 'Edit video' })
    const title = within(dialog).getByLabelText('Title')
    expect(title).toHaveValue('20 min home workout')
    await userEvent.clear(title)
    await userEvent.type(title, '25 min home workout')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(titles()).toContain('25 min home workout')
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('saves a new video from + Save and shows it at once', async () => {
    render(<SavedVideos />)
    await screen.findByText(NO_VIDEOS)

    const [header] = screen.getAllByRole('button', { name: 'Save a video' })
    await userEvent.click(header ?? document.body)
    const dialog = screen.getByRole('dialog', { name: 'Save a video' })
    await userEvent.type(within(dialog).getByLabelText('Link'), 'https://youtu.be/x')
    await userEvent.type(within(dialog).getByLabelText('Title'), 'Morning yoga flow')
    await userEvent.click(within(dialog).getByRole('button', { name: '+ New' }))
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'New category name' }), 'Yoga')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('list', { name: 'Saved videos' })).toHaveTextContent(
      'Morning yoga flow',
    )
    expect(screen.getByText('1 video · 1 category')).toBeInTheDocument()
  })

  it('shows the old category and tag in the form when it opens a 2nd time', async () => {
    render(<SavedVideos />)
    await screen.findByText(NO_VIDEOS)

    const [header] = screen.getAllByRole('button', { name: 'Save a video' })
    await userEvent.click(header ?? document.body)
    const first = screen.getByRole('dialog', { name: 'Save a video' })
    await userEvent.type(within(first).getByLabelText('Link'), 'https://youtu.be/x')
    await userEvent.type(within(first).getByLabelText('Title'), 'Morning yoga flow')
    await userEvent.click(within(first).getByRole('button', { name: '+ New' }))
    await userEvent.type(within(first).getByRole('textbox', { name: 'New category name' }), 'Yoga')
    await userEvent.type(within(first).getByRole('textbox', { name: 'Add a new tag' }), 'morning')
    await userEvent.click(within(first).getByRole('button', { name: 'Save' }))
    await screen.findByRole('list', { name: 'Saved videos' })

    const [again] = screen.getAllByRole('button', { name: 'Save a video' })
    await userEvent.click(again ?? document.body)
    const second = screen.getByRole('dialog', { name: 'Save a video' })

    expect(within(second).getByRole('button', { name: 'Yoga' })).toBeInTheDocument()
    expect(within(second).getByRole('button', { name: '#morning' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('shows every tag used before as a chip in the form, with no cap', async () => {
    await seedSeven()
    await save('Morning abs', 'Home', 'normal', ['morning', 'abs'])
    await ready()

    await userEvent.click(
      screen.getAllByRole('button', { name: 'Save a video' })[0] ?? document.body,
    )
    const dialog = screen.getByRole('dialog', { name: 'Save a video' })
    const tags = within(within(dialog).getByRole('group', { name: 'Tags' }))
      .getAllByRole('button')
      .map((button) => button.textContent)

    expect(tags).toEqual([
      '#abs',
      '#back',
      '#chest',
      '#evening',
      '#fullbody',
      '#gym',
      '#legs',
      '#morning',
      '#shoulders',
    ])
  })

  it('offers only the categories that still have a live video in the form', async () => {
    await seedSeven()
    await deleteSavedVideo(
      (await listSavedVideos()).find((row) => row.title === '5 min box breathing')?.id ?? '',
    )
    await ready()

    await userEvent.click(
      screen.getAllByRole('button', { name: 'Save a video' })[0] ?? document.body,
    )
    const dialog = screen.getByRole('dialog', { name: 'Save a video' })
    const names = within(within(dialog).getByRole('group', { name: 'Category' }))
      .getAllByRole('button')
      .map((button) => button.textContent)

    expect(names).toEqual(['Gym tricks', 'Home', 'Stretching', '+ New'])
  })

  it('renders a video whose category is not on this device, counted in All', async () => {
    await seedSeven()
    const [first] = await listSavedVideos()
    await db.savedVideos.update(first?.id ?? '', { category_id: 'not-here' })
    await ready()

    expect(chip(/^All/)).toHaveTextContent('All 7')
    expect(titles()).toHaveLength(7)
  })

  it('says so when the saved videos cannot be read', async () => {
    failing.read = true
    render(<SavedVideos />)

    expect(await screen.findByText(READ_FAILED)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Saved' })).toBeInTheDocument()
  })

  it('still opens the form from + Save when the list cannot be read', async () => {
    failing.read = true
    render(<SavedVideos />)
    await screen.findByText(READ_FAILED)

    await userEvent.click(screen.getByRole('button', { name: 'Save a video' }))

    expect(screen.getByRole('dialog', { name: 'Save a video' })).toBeInTheDocument()
  })

  it('keeps the deleted row soft deleted until undo', async () => {
    await seedSeven()
    const [first] = await listSavedVideos()
    await deleteSavedVideo(first?.id ?? '')
    await ready()

    expect(titles()).toHaveLength(6)
  })
})
