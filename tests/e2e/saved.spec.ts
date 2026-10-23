import { randomUUID } from 'node:crypto'

import { expect, readStore, test as signedIn, waitForServiceWorker } from './support/signedIn'

import type { LocalOutbox } from './support/signedIn'
import type { Page } from '@playwright/test'

signedIn.use({
  serviceWorkers: async ({ browserName }, provide) => {
    await provide(browserName === 'webkit' ? 'block' : 'allow')
  },
})

type LocalVideo = { id: string; title: string; category_id: string; deleted_at: string | null }

type LocalCategory = { id: string; name: string }

type NewVideo = {
  title: string
  category: { pick: string } | { add: string }
  tags?: readonly string[]
  priority?: 'High' | 'Normal' | 'Low'
  link?: string
}

function tokenOf(): string {
  return randomUUID().replace(/-/g, '').slice(0, 10)
}

async function openSaved(page: Page): Promise<void> {
  await page.goto('/saved')
  await expect(page.getByRole('heading', { level: 1, name: 'Saved' })).toBeVisible()
  await expect(page.getByText(/^\d+ videos? · \d+ categor(y|ies)$/)).toBeVisible()
}

async function saveVideo(page: Page, video: NewVideo): Promise<void> {
  await page.getByRole('button', { name: 'Save a video' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Save a video' })
  await expect(sheet).toBeVisible()
  await sheet.getByLabel('Link').fill(video.link ?? `https://www.youtube.com/watch?v=${tokenOf()}`)
  await sheet.getByLabel('Title').fill(video.title)
  const categories = sheet.getByRole('group', { name: 'Category' })

  if ('add' in video.category) {
    await categories.getByRole('button', { name: '+ New' }).click()
    await sheet.getByRole('textbox', { name: 'New category name' }).fill(video.category.add)
  } else {
    await categories.getByRole('button', { name: video.category.pick, exact: true }).click()
  }

  for (const tag of video.tags ?? []) {
    await sheet.getByRole('textbox', { name: 'Add a tag' }).fill(tag)
    await sheet.getByRole('textbox', { name: 'Add a tag' }).press('Enter')
  }

  if (video.priority !== undefined) {
    await sheet.getByText(video.priority, { exact: true }).click()
  }

  await sheet.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(sheet).toBeHidden()
}

function search(page: Page) {
  return page.getByRole('searchbox', { name: 'Search titles and tags' })
}

function savedList(page: Page) {
  return page.getByRole('list', { name: 'Saved videos' })
}

function cardTitles(page: Page): Promise<string[]> {
  return savedList(page)
    .getByRole('link')
    .evaluateAll((links) => links.map((link) => link.querySelector('span')?.textContent ?? ''))
}

function chipNamed(page: Page, name: string) {
  return page
    .getByRole('group', { name: 'Category', exact: true })
    .getByRole('button', { name: new RegExp(`^${name} \\d+$`) })
}

async function localRows(page: Page, token: string) {
  const videos = await readStore<LocalVideo>(page, 'savedVideos')
  const categories = await readStore<LocalCategory>(page, 'videoCategories')

  return {
    videos: videos.filter((row) => row.title.includes(token)),
    categories: categories.filter((row) => row.name.includes(token)),
  }
}

const test = signedIn.extend<{ token: string }>({
  token: async ({ page, account }, provide) => {
    const token = tokenOf()
    await provide(token)
    const { videos, categories } = page.url().startsWith('http')
      ? await localRows(page, token)
      : { videos: [], categories: [] }
    await page.goto('about:blank')
    await account.removeSavedVideos(
      videos.map((row) => row.id),
      categories.map((row) => row.id),
    )
  },
})

test('saves a video with a new category and shows it at once', async ({ page, token }) => {
  await openSaved(page)

  await saveVideo(page, {
    title: `Morning yoga flow ${token}`,
    category: { add: `Yoga ${token}` },
    tags: ['#Morning'],
  })

  const card = savedList(page).getByRole('listitem').filter({ hasText: token })
  await expect(card).toHaveCount(1)
  await expect(card).toContainText(`Yoga ${token}`)
  await expect(card).toContainText('#morning')
  await expect(chipNamed(page, `Yoga ${token}`)).toBeVisible()
})

test('orders High above Normal above Low in All and in a category', async ({ page, token }) => {
  const category = `Order ${token}`
  await openSaved(page)

  await saveVideo(page, { title: `Low ${token}`, category: { add: category }, priority: 'Low' })
  await saveVideo(page, { title: `High ${token}`, category: { pick: category }, priority: 'High' })
  await saveVideo(page, { title: `Normal ${token}`, category: { pick: category } })

  await search(page).fill(token)
  await expect
    .poll(() => cardTitles(page))
    .toEqual([`High ${token}`, `Normal ${token}`, `Low ${token}`])

  await search(page).fill('')
  await chipNamed(page, category).click()
  await expect(chipNamed(page, category)).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(() => cardTitles(page))
    .toEqual([`High ${token}`, `Normal ${token}`, `Low ${token}`])
})

test('finds a video by a title word and by a tag', async ({ page, token }) => {
  const category = `Find ${token}`
  await openSaved(page)

  await saveVideo(page, {
    title: `Kettlebell swing${token}`,
    category: { add: category },
    tags: [`bell${token}`],
  })
  await saveVideo(page, {
    title: `Rowing drill ${token}`,
    category: { pick: category },
    tags: [`row${token}`],
  })

  await search(page).fill(`SWING${token}`)
  await expect.poll(() => cardTitles(page)).toEqual([`Kettlebell swing${token}`])

  await search(page).fill(`#row${token}`)
  await expect.poll(() => cardTitles(page)).toEqual([`Rowing drill ${token}`])
})

test('deletes a video and Undo restores it', async ({ page, token }) => {
  const title = `Delete me ${token}`
  await openSaved(page)
  await saveVideo(page, { title, category: { add: `Undo ${token}` } })
  await search(page).fill(token)
  await expect.poll(() => cardTitles(page)).toEqual([title])

  await page.getByRole('button', { name: `More for ${title}` }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(page.getByTestId('undo-toast')).toContainText('Video deleted.')
  await expect(page.getByRole('link', { name: new RegExp(title) })).toHaveCount(0)
  expect((await localRows(page, token)).videos[0]?.deleted_at).not.toBeNull()

  await page.getByRole('button', { name: 'Undo', exact: true }).click()

  await expect.poll(() => cardTitles(page)).toEqual([title])
  expect((await localRows(page, token)).videos[0]?.deleted_at).toBeNull()
})

test('shows no chip for a category with no videos', async ({ page, token }) => {
  const category = `Lonely ${token}`
  const title = `Only video ${token}`
  await openSaved(page)
  await saveVideo(page, { title: `Keeper ${token}`, category: { add: `Keep ${token}` } })
  await saveVideo(page, { title, category: { add: category } })
  await chipNamed(page, category).click()

  await page.getByRole('button', { name: `More for ${title}` }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(chipNamed(page, category)).toHaveCount(0)
  await expect(chipNamed(page, 'All')).toHaveAttribute('aria-pressed', 'true')
  await expect(chipNamed(page, `Keep ${token}`)).toBeVisible()
  expect((await localRows(page, token)).categories).toHaveLength(2)
})

test('wraps a 120-character title with no space at 320 px with no sideways scroll', async ({
  page,
  token,
}) => {
  const title = `${'W'.repeat(120 - token.length)}${token}`
  const tag = `${'t'.repeat(30 - token.length)}${token}`
  await page.setViewportSize({ width: 320, height: 720 })
  await openSaved(page)

  await saveVideo(page, { title, category: { add: `Wide ${token}` }, tags: [tag] })
  await search(page).fill(token)

  const card = savedList(page).getByRole('listitem').filter({ hasText: token })
  await expect(card).toHaveCount(1)
  const box = await card.boundingBox()
  expect(box?.width ?? 0).toBeLessThanOrEqual(320)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0)
})

test('saves offline with a new category, then syncs with no duplicate row', async ({
  page,
  context,
  account,
  token,
}) => {
  const title = `Offline save ${token}`
  await openSaved(page)
  await context.setOffline(true)

  await saveVideo(page, { title, category: { add: `Offline ${token}` } })
  await search(page).fill(token)
  await expect.poll(() => cardTitles(page)).toEqual([title])

  const { videos, categories } = await localRows(page, token)
  expect(videos).toHaveLength(1)
  expect(categories).toHaveLength(1)
  const videoId = videos[0]?.id ?? ''
  const categoryId = categories[0]?.id ?? ''

  await context.setOffline(false)

  await expect
    .poll(() => account.savedVideosByIds([videoId]), {
      message: 'the video reaches Supabase',
      timeout: 20000,
    })
    .toEqual([expect.objectContaining({ id: videoId, category_id: categoryId, title })])
  expect(await account.videoCategoriesByIds([categoryId])).toEqual([
    expect.objectContaining({ id: categoryId, name: `Offline ${token}` }),
  ])
  expect(await account.savedVideosTitled(token)).toHaveLength(1)
  await expect
    .poll(async () => {
      const queue = await readStore<LocalOutbox>(page, 'outbox')
      return queue.filter((entry) => [videoId, categoryId].includes(entry.row_id)).length
    })
    .toBe(0)
})

test('renders /saved with the network down after the first visit', async ({
  page,
  context,
  browserName,
  token,
}) => {
  test.skip(
    browserName === 'webkit',
    'Playwright WebKit runs these suites with service workers blocked, so nothing is cached.',
  )

  await page.goto('/')
  await waitForServiceWorker(page)
  await openSaved(page)
  await saveVideo(page, { title: `Cached ${token}`, category: { add: `Cache ${token}` } })

  await context.setOffline(true)

  await openSaved(page)
  await search(page).fill(token)
  await expect.poll(() => cardTitles(page)).toEqual([`Cached ${token}`])
})
