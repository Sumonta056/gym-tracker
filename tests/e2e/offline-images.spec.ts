import { COACH_PLANS } from '../../lib/plans/coach'

import { expect, test, waitForServiceWorker } from './support/signedIn'

type Answer = { url: string; status: number; type: string; bytes: number }

const ONE_IMAGE_PER_PLAN = COACH_PLANS.map((plan) => {
  const step = plan.groups[0]?.steps[0]
  if (step === undefined) {
    throw new Error(`the plan ${plan.id} has no step`)
  }
  return step.images.start
})

const EVERY_IMAGE = COACH_PLANS.flatMap((plan) =>
  plan.groups.flatMap((group) =>
    group.steps.flatMap((step) => [step.images.start, step.images.end]),
  ),
)

test.use({
  serviceWorkers: async ({ browserName }, provide) => {
    await provide(browserName === 'webkit' ? 'block' : 'allow')
  },
})

test('serves 1 step image of each plan from the precache with the network down', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit',
    'Playwright WebKit runs these suites with service workers blocked, so nothing is precached.',
  )

  await page.goto('/')
  await waitForServiceWorker(page)

  const precached = await page.evaluate(async () => {
    const urls: string[] = []
    for (const name of await caches.keys()) {
      const requests = await (await caches.open(name)).keys()
      urls.push(...requests.map((request) => new URL(request.url).pathname))
    }
    return urls
  })
  expect(precached.filter((url) => url.startsWith('/exercises/')).sort()).toEqual(
    [...EVERY_IMAGE].sort(),
  )

  await context.setOffline(true)

  const answers = await page.evaluate(async (urls) => {
    const results: Answer[] = []
    for (const url of urls) {
      const response = await fetch(url)
      const body = await response.arrayBuffer()
      results.push({
        url,
        status: response.status,
        type: response.headers.get('content-type') ?? '',
        bytes: body.byteLength,
      })
    }
    return results
  }, ONE_IMAGE_PER_PLAN)

  expect(answers).toHaveLength(4)
  for (const answer of answers) {
    expect(answer.status, answer.url).toBe(200)
    expect(answer.type, answer.url).toMatch(/^image\//)
    expect(answer.bytes, answer.url).toBeGreaterThan(0)
  }
})
