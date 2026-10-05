# Step E4 — `/log?date=`, previous, next and a date picker

**Branch:** `fix/e4-old-days`, in worktree `../gym-tracker-e4`, cut from `fix/feedback-fixes` ·
**Wave:** 7 · **Size:** M · **Depends on:** W0, E3, C4 · **Unlocks:** E5, F2 ·
**Agent to use:** `test-writer` for the tests, then `ui-reviewer`
**Items:** 6 · **Skills to load:** `design-system`

## Before you start

### The worktree

```bash
cd /Users/cefalo_1/Documents/Projects/gym-tracker
git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-e4 -b fix/e4-old-days fix/feedback-fixes
cd ../gym-tracker-e4
cp ../gym-tracker/.env.local ../gym-tracker/.env.test.local .
export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"
pnpm install
```

If you are already in that worktree on that branch, skip this block. Run every command
below from the worktree root. Each new shell needs the `export PATH` line again before
`pnpm`.

### Dependency checks

Each line prints `FAIL` and the step name when that step is not merged into `fix/feedback-fixes`.

```bash
{ test -f scripts/e2e-lock.mjs && grep -q '"verify:parallel"' package.json; } || echo "FAIL: W0 is not merged (no scripts/e2e-lock.mjs or no verify:parallel script)"
{ grep -q "export function sessionsText" components/DailyEntryForm.tsx && test ! -f components/workout/GymTimeOffer.tsx; } || echo "FAIL: E3 is not merged (no sessionsText, or GymTimeOffer.tsx still exists)"
{ grep -q "export const WEEKDAY_LABELS" components/charts/StreakHeatMap.tsx && grep -q "export function weekRangeLabel" components/dashboard/summary.ts; } || echo "FAIL: C4 is not merged (no WEEKDAY_LABELS or weekRangeLabel)"
echo "Dependency checks finished."
```

If any check fails, the step it names is not merged into `fix/feedback-fixes`. Stop. Report which check
failed. Do not do that step's work here.

### Already done check

```bash
test -f lib/format/logDate.ts && echo "DONE: E4 is already on this branch"
```

If it passes, stop and report.

## Context to read first

1. The route contract in **Names this step uses from earlier steps** below.
2. `docs/specs/2026-10-05-feedback-fixes-design.md`, item 6.
3. Load the `design-system` skill. Read `references/charts.md`, "The frame": nothing
   inside a chart's `role="img"` is focusable.
4. `.claude/rules/accessibility.md` — 44 px targets, real `a` elements.
5. `app/(app)/log/page.tsx` and its test.
6. `components/DailyEntryForm.tsx` and its test, as E3 left them.
7. `lib/schema/dailyEntry.ts` — `localDate`, `isNotFuture`.
8. `lib/metrics/day.ts` — `toDayNumber` already refuses an impossible date such as
   `2026-02-30`.
9. `components/charts/StreakHeatMap.tsx` and its test, as C4 left them.
10. `app/sw.ts` and `serwist.config.mjs`. `@serwist/next` precaches the prerendered
    `/log` page under the URL `/log`.

## Names this step uses from earlier steps

The route contract. Later steps rely on it:

- `/log?date=YYYY-MM-DD` opens that day. A missing, malformed, impossible (such as
  `2026-02-30`) or future date opens today, with no crash. This is review focus 4 of the
  fix track.
- `lib/format/logDate.ts` exports `parseLogDate(value, today)`, `shiftLogDate(date,
days)`, `logPath(date)` and `LOG_PATH`. Later steps import them.
- `DailyEntryForm` takes `{ date: string; onDateChange: (date: string) => void }`. E5
  builds on it.
- F2 later adds `/^session$/` to the same `ignoreURLParametersMatching` list in
  `app/sw.ts`.

From E3, `components/DailyEntryForm.tsx`:

- It reads the sessions of its date with `listSessions(entryDate, entryDate)` in an
  effect keyed on `entryDate`, and exports `finishedCount` and `sessionsText`. This
  step replaces `entryDate` with the `date` prop.
- Its test mocks `lib/db/repository` with `getDay`, `upsertDay` and `listSessions`. The
  gym time offer is gone.

From C4, `components/charts/StreakHeatMap.tsx`:

- The heat map is a CSS grid of real cells inside the `ChartCard` canvas
  (`role="img"`). It exports `WEEKDAY_LABELS` and `cellClass`. The legend names
  `Logged`, `Not logged` and `Ahead`. The footer text is
  `Each column is a week. Weeks start on Monday.`

From D1 (wave 4, merged): `DailyEntry.swim_seconds` is an optional field.

Before this step: `prettyDate(date)` exported from `components/DailyEntryForm.tsx` (for
example `Fri 18 Sep`), `localDate()` in `lib/schema/dailyEntry.ts`, `toDayNumber` in
`lib/metrics/day.ts`, and in `tests/e2e/support/signedIn.ts` the `day` fixture
(`day.date`, `day.plus(n)`), `openWithWeek`, `waitForLocalDays`,
`waitForServiceWorker` and `navLink`. The Stats screen lives at `/analytics`, with the
nav label "Stats".

## State before the step

- `/log` always opens today. `DailyEntryForm` takes an optional `date` prop that no
  route passes.
- No screen opens a past day. The heat map is a chart image with no links.
- `/log` is a static page. The service worker precaches its HTML as `/log`. A request
  for `/log?date=…` does not match that entry, because Serwist ignores only `utm_*` and
  `fbclid` by default. Offline, it falls to `/~offline`.

## Goal

The user opens any past day on `/log`: from the address, with previous and next, with
a date picker, and from the Stats heat map. A missing, malformed, impossible or future
date opens today. It works with no network.

## Decisions

- **The page stays static.** In Next 15 a server page that reads `searchParams` (a
  Promise) becomes dynamic. A dynamic page is not prerendered, so the service worker
  cannot precache it, and `/log` breaks offline. So `page.tsx` stays a server component
  with no `searchParams`, and a client component reads `useSearchParams()` inside a
  `<Suspense>` boundary. Next requires that boundary for a static page.
- **The address changes with `window.history.replaceState`, not `router.replace`.**
  `router.replace` asks the server for the route payload, which fails offline. Next 15
  keeps `useSearchParams` in step with a native `replaceState`. The form state lives in
  the client component, so no server call happens on a day change.
- **The service worker ignores `date` when it matches the precache.** One line in
  `app/sw.ts` makes `/log?date=…` read the precached `/log` HTML. F2 adds `session` to
  the same list for `/workouts?session=`.
- **The heat map gets a row of 7 day links under it, not a link per cell.** A cell is
  about 20 px wide and 17 px tall on a phone, under the 44 px rule. The cells sit inside
  the chart's `role="img"`, where a link is not allowed (`references/charts.md`) and
  axe flags a focusable child. A row of the last 7 days, each a real `<a>` 44 px tall,
  meets both rules and covers the common case: "what did I log on Tuesday". Older days
  are 1 tap away with the date picker on `/log`. Say in the report that the checklist
  line "A heat map cell opens its day" is met by this row.

## Do

1. Run the `test-writer` agent with the acceptance list below. The tests come first.
2. Create `lib/format/logDate.ts`. Every date rule of `/log` lives here:

   ```ts
   import { toDayNumber } from '../metrics/day'

   const MS_PER_DAY = 86400000

   export const LOG_PATH = '/log'

   export function parseLogDate(value: string | null, today: string): string {
     if (value === null || toDayNumber(value) === null || value > today) {
       return today
     }

     return value
   }

   export function shiftLogDate(date: string, days: number): string {
     const day = toDayNumber(date) ?? 0

     return new Date((day + days) * MS_PER_DAY).toISOString().slice(0, 10)
   }

   export function logPath(date: string): string {
     return `${LOG_PATH}?date=${date}`
   }
   ```

3. Create `components/LogDay.tsx`. It owns the date and the address:

   ```tsx
   'use client'

   import { useSearchParams } from 'next/navigation'
   import { useCallback, useEffect, useState } from 'react'

   import { logPath, parseLogDate } from '../lib/format/logDate'
   import { localDate } from '../lib/schema/dailyEntry'

   import { DailyEntryForm } from './DailyEntryForm'

   export function LogDay() {
     const params = useSearchParams()
     const asked = params.get('date')
     const [date, setDate] = useState(() => parseLogDate(asked, localDate()))

     useEffect(() => {
       if (asked !== null && asked !== date) {
         window.history.replaceState(null, '', logPath(date))
       }
     }, [asked, date])

     const change = useCallback((next: string) => {
       setDate(next)
       window.history.replaceState(null, '', logPath(next))
     }, [])

     return <DailyEntryForm key={date} date={date} onDateChange={change} />
   }
   ```

   - `key={date}` remounts the form on a day change. The fields of the old day never
     stay on screen when the new day has no row.
   - The effect rewrites a bad date in the address to the day on screen.

4. `app/(app)/log/page.tsx`:

   ```tsx
   import { Suspense } from 'react'

   import { LogDay } from '../../../components/LogDay'

   export default function LogPage() {
     return (
       <Suspense fallback={null}>
         <LogDay />
       </Suspense>
     )
   }
   ```

5. `components/DailyEntryForm.tsx`:
   - The props become `{ date: string; onDateChange: (date: string) => void }`. Delete
     the `entryDate` state. Use `date` where `entryDate` was.
   - Add a day row right after `</header>`. It is a `group`, not a `nav`, because the
     route group layout owns the only navigation:

     ```tsx
     const today = localDate()
     const previous = shiftLogDate(date, -1)
     const next = shiftLogDate(date, 1)
     ```

     ```tsx
     <div
       role="group"
       aria-label="Choose the day"
       className="mt-4 grid grid-cols-[44px_minmax(0,1fr)_44px] items-end gap-2 md:max-w-sm"
     >
       <button
         type="button"
         aria-label={`Previous day, ${prettyDate(previous)}`}
         onClick={() => {
           onDateChange(previous)
         }}
         className={DAY_STEP}
       >
         <span aria-hidden="true">‹</span>
       </button>
       <Field
         label="Day"
         type="date"
         max={today}
         value={date}
         onChange={(event) => {
           const picked = event.target.value

           if (picked !== '') {
             onDateChange(parseLogDate(picked, today))
           }
         }}
       />
       <button
         type="button"
         aria-label={`Next day, ${prettyDate(next)}`}
         disabled={date >= today}
         onClick={() => {
           onDateChange(next)
         }}
         className={DAY_STEP}
       >
         <span aria-hidden="true">›</span>
       </button>
     </div>
     ```

     ```ts
     const DAY_STEP =
       'bg-surface-2 border-border text-text rounded-input inline-flex h-[52px] w-11 items-center justify-center border text-xl font-bold disabled:opacity-50'
     ```

     - iOS Safari ignores `max` on a date input. `parseLogDate` turns a picked future
       day into today, so the form never opens a future day.
     - Changing the day drops unsaved edits of the old day, because the form remounts.
       Say this in the report under "Things to consider".
6. `components/charts/StreakHeatMap.tsx`: add the day row to the card footer, after the
   footer text that C4 left:

   ```tsx
   export const OPEN_DAY_COUNT = 7

   const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const

   export function recentDays(weeks: readonly HeatWeek[], count = OPEN_DAY_COUNT): HeatCell[] {
     return weeks
       .flatMap((week) => week.days)
       .filter((cell) => cell.state !== 'future')
       .slice(-count)
   }

   export function OpenDayLinks({ weeks }: { weeks: readonly HeatWeek[] }) {
     return (
       <div className="flex flex-col gap-2">
         <p id="open-a-day" className="text-muted text-xs">
           Open a day
         </p>
         <ul aria-labelledby="open-a-day" className="grid grid-cols-7 gap-1.5">
           {recentDays(weeks).map((cell) => {
             const at = new Date(`${cell.date}T00:00:00Z`)
             const logged = cell.state === 'logged'

             return (
               <li key={cell.date}>
                 <Link
                   href={logPath(cell.date)}
                   className={cn(
                     'bg-surface-2 rounded-input flex min-h-11 flex-col items-center justify-center border py-1 text-xs font-bold',
                     logged ? 'border-accent text-text' : 'border-border text-muted',
                   )}
                 >
                   <span aria-hidden="true">{WEEKDAY_LETTERS[at.getUTCDay()]}</span>
                   <span aria-hidden="true">{at.getUTCDate()}</span>
                   <span
                     aria-hidden="true"
                     className={cn(
                       'mt-0.5 size-1.5 rounded-full',
                       logged ? 'bg-accent' : 'bg-transparent',
                     )}
                   />
                   <span className="sr-only">{`${prettyDate(cell.date)}, ${logged ? 'logged' : 'not logged'}`}</span>
                 </Link>
               </li>
             )
           })}
         </ul>
       </div>
     )
   }
   ```

   Pass `<OpenDayLinks weeks={weeks} />` in the `footer` of `ChartCard`, outside the
   `role="img"`. Import `Link` from `next/link`, `logPath` from `lib/format/logDate`,
   `prettyDate` from `components/DailyEntryForm` and `cn` from `components/ui/cn`. The
   dot is the shape that carries "logged", so the state is not in colour only.

7. `app/sw.ts`: add the precache option to the `Serwist` constructor:

   ```ts
   precacheOptions: {
     ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^date$/],
   },
   ```

   `app/sw.ts` is in the `EXEMPT` list. The offline e2e test below proves this line.

8. `docs/design/prototype/index.html`:
   - Plate 02 "Daily log": add the day row under the top bar: a `btn-secondary` square
     with `‹`, a `field` with the micro label "Day" and a date input that shows
     `2026-09-20`, and a `btn-secondary` square with `›`, disabled.
   - Plate 05 "Analytics": under the heat map footer that C4 wrote ("Each column is a
     week. Weeks start on Monday."), add the
     "Open a day" row: 7 links `M 14` to `S 20`, each 44 px tall, with the logged days in
     an accent border and a dot.

## Acceptance criteria

- [ ] `parseLogDate` returns today for `null`, an empty string, `soon`, `2026-9-1`,
      `2026-13-01` and `2026-02-30`.
- [ ] `parseLogDate` returns today for a date after today.
- [ ] `parseLogDate` returns a valid past date, and today, as they are.
- [ ] `shiftLogDate` crosses a month end and a year end. `logPath` builds
      `/log?date=YYYY-MM-DD`.
- [ ] `/log?date=` with a valid past date opens that day and reads it with `getDay`.
- [ ] `/log?date=` with a future, an impossible or a garbage date opens today and
      rewrites the address to today.
- [ ] The previous day button opens the day before, and the address follows.
- [ ] The next day button is disabled on today, and opens the day after on a past day.
- [ ] The Day field is capped at today. A picked day opens. An emptied field changes
      nothing.
- [ ] A day change clears the fields of the old day.
- [ ] The day buttons are named with the day they open, and are 44 px or wider and
      52 px tall.
- [ ] The heat map card has 7 links to `/log?date=` for the last 7 days up to today,
      outside the chart image, each 44 px tall, each named with its day and its state.
- [ ] The empty heat map shows no day links.
- [ ] Offline, a cold load of `/log?date=` opens that day.
- [ ] A tap on a heat map day link opens that day on `/log`.
- [ ] `/log` stays a static page. Check: `pnpm build` lists `/log` as static (○), not
      dynamic (ƒ).
- [ ] The service worker ignores `date` in the precache match. Check:
      `grep -nF '/^date$/' app/sw.ts`, and the offline e2e test above.
- [ ] axe reports no serious or critical issue on `/log` and `/analytics`, and
      nothing scrolls sideways at 320 px. Tests: `tests/e2e/a11y.spec.ts` and
      `tests/e2e/responsive.spec.ts` stay green.
- [ ] E3's gym time block works on a past day: the `DailyEntryForm gym time` tests
      stay green with the `date` prop.
- [ ] The `ui-reviewer` agent reports no drift on `components/DailyEntryForm.tsx`,
      `components/LogDay.tsx` and `components/charts/StreakHeatMap.tsx`.

## Tests

`lib/format/logDate.test.ts`, criteria 1 to 4:

```ts
import { describe, expect, it } from 'vitest'

import { logPath, parseLogDate, shiftLogDate } from './logDate'

const TODAY = '2026-10-05'

describe('parseLogDate', () => {
  it.each([null, '', 'soon', '2026-9-1', '2026-13-01', '2026-02-30'])(
    'returns today for %s',
    (value) => {
      expect(parseLogDate(value, TODAY)).toBe(TODAY)
    },
  )

  it('returns today for a date after today', () => {
    expect(parseLogDate('2026-10-06', TODAY)).toBe(TODAY)
  })

  it('returns a valid past date and today as they are', () => {
    expect(parseLogDate('2026-09-19', TODAY)).toBe('2026-09-19')
    expect(parseLogDate(TODAY, TODAY)).toBe(TODAY)
  })
})

describe('shiftLogDate', () => {
  it('crosses a month end and a year end', () => {
    expect(shiftLogDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftLogDate('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('logPath', () => {
  it('builds the log address for a day', () => {
    expect(logPath('2026-09-19')).toBe('/log?date=2026-09-19')
  })
})
```

`components/LogDay.test.tsx`, criteria 5 to 10:

```tsx
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDay } from '../lib/db/repository'
import { logPath, shiftLogDate } from '../lib/format/logDate'
import { localDate } from '../lib/schema/dailyEntry'

import { LogDay } from './LogDay'

const mocks = vi.hoisted(() => ({ search: '' }))

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mocks.search),
}))

vi.mock('../lib/db/repository', () => ({
  getDay: vi.fn(() => Promise.resolve(undefined)),
  upsertDay: vi.fn(() => Promise.resolve()),
  listSessions: vi.fn(() => Promise.resolve([])),
}))

const TODAY = localDate()
const PAST = shiftLogDate(TODAY, -3)

function dayField() {
  return screen.getByLabelText('Day')
}

beforeEach(() => {
  mocks.search = ''
  vi.mocked(getDay).mockResolvedValue(undefined)
  vi.spyOn(window.history, 'replaceState')
})

describe('LogDay', () => {
  it('opens the day in the address and reads it', async () => {
    mocks.search = `date=${PAST}`
    render(<LogDay />)

    expect(dayField()).toHaveValue(PAST)
    await waitFor(() => {
      expect(getDay).toHaveBeenCalledWith(PAST)
    })
  })

  it.each(['2999-01-01', '2026-02-30', 'soon'])(
    'opens today for %s and rewrites the address',
    async (asked) => {
      mocks.search = `date=${asked}`
      render(<LogDay />)

      expect(dayField()).toHaveValue(TODAY)
      await waitFor(() => {
        expect(window.history.replaceState).toHaveBeenCalledWith(null, '', logPath(TODAY))
      })
    },
  )

  it('opens the day before from the previous day button', async () => {
    mocks.search = `date=${PAST}`
    render(<LogDay />)
    const before = shiftLogDate(PAST, -1)

    await userEvent.click(screen.getByRole('button', { name: /^Previous day,/ }))

    expect(dayField()).toHaveValue(before)
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', logPath(before))
    await waitFor(() => {
      expect(getDay).toHaveBeenCalledWith(before)
    })
  })

  it('turns the next day button off on today and on for a past day', async () => {
    const { unmount } = render(<LogDay />)
    expect(screen.getByRole('button', { name: /^Next day,/ })).toBeDisabled()
    unmount()

    mocks.search = `date=${PAST}`
    render(<LogDay />)
    await userEvent.click(screen.getByRole('button', { name: /^Next day,/ }))
    expect(dayField()).toHaveValue(shiftLogDate(PAST, 1))
  })

  it('caps the Day field at today, opens a picked day and ignores an emptied field', () => {
    render(<LogDay />)
    expect(dayField()).toHaveAttribute('max', TODAY)

    fireEvent.change(dayField(), { target: { value: PAST } })
    expect(dayField()).toHaveValue(PAST)

    fireEvent.change(dayField(), { target: { value: '' } })
    expect(dayField()).toHaveValue(PAST)
  })

  it('clears the fields of the old day on a day change', async () => {
    vi.mocked(getDay).mockImplementation((date) =>
      Promise.resolve(
        date === PAST
          ? {
              id: '11111111-1111-4111-8111-111111111111',
              entry_date: PAST,
              walk_seconds: null,
              gym_seconds: null,
              avg_heart_rate: null,
              max_heart_rate: null,
              weight_kg: null,
              calories_burnt: null,
              steps: 12480,
              note: null,
              created_at: '2026-09-19T10:00:00.000Z',
              updated_at: '2026-09-19T10:00:00.000Z',
              deleted_at: null,
            }
          : undefined,
      ),
    )
    mocks.search = `date=${PAST}`
    render(<LogDay />)
    await waitFor(() => {
      expect(screen.getByLabelText('Steps')).toHaveValue('12480')
    })

    await userEvent.click(screen.getByRole('button', { name: /^Previous day,/ }))

    await waitFor(() => {
      expect(screen.getByLabelText('Steps')).toHaveValue('')
    })
  })
})
```

Add every field D1 put on `DailyEntry` (for example `swim_seconds: null`) to the fixture
in the last test, so it type checks.

`components/DailyEntryForm.test.tsx`, criterion 11. `renderForm` passes
`onDateChange={vi.fn()}`. Add:

```tsx
it('names each day button with the day it opens, at the field height', async () => {
  await renderForm()
  const previous = screen.getByRole('button', { name: 'Previous day, Fri 18 Sep' })
  const next = screen.getByRole('button', { name: 'Next day, Sun 20 Sep' })
  for (const button of [previous, next]) {
    expect(button).toHaveClass('h-[52px]', 'w-11')
  }
})

it('hands the previous day to its owner', async () => {
  const onDateChange = vi.fn()
  render(<DailyEntryForm date={DATE} onDateChange={onDateChange} />)
  await userEvent.click(screen.getByRole('button', { name: 'Previous day, Fri 18 Sep' }))
  expect(onDateChange).toHaveBeenCalledWith('2026-09-18')
})
```

`app/(app)/log/page.test.tsx`: mock `next/navigation` with
`useSearchParams: () => new URLSearchParams('')` and keep its 3 tests. "builds no
frame of its own" still finds no `navigation`, because the day row is a `group`.

`components/charts/StreakHeatMap.test.tsx`, criteria 12 and 13:

```tsx
describe('recentDays', () => {
  it('takes the last 7 days up to today and no future day', () => {
    const days = recentDays(full.heatMap)
    expect(days).toHaveLength(7)
    expect(days.at(-1)?.date).toBe(TODAY)
    expect(days.every((cell) => cell.state !== 'future')).toBe(true)
  })
})

it('links the last 7 days to the log, outside the chart image', () => {
  render(<StreakHeatMap weeks={full.heatMap} streak={full.streak} />)
  const list = screen.getByRole('list', { name: 'Open a day' })
  const links = within(list).getAllByRole('link')
  expect(links).toHaveLength(7)
  expect(links.at(-1)).toHaveAttribute('href', `/log?date=${TODAY}`)
  expect(links.at(-1)).toHaveAccessibleName(/, logged$/)
  for (const link of links) {
    expect(link).toHaveClass('min-h-11')
    expect(screen.getByRole('img').contains(link)).toBe(false)
  }
})

it('shows no day links while the heat map is empty', () => {
  render(<StreakHeatMap weeks={empty.heatMap} streak={empty.streak} />)
  expect(screen.queryByRole('list', { name: 'Open a day' })).not.toBeInTheDocument()
})
```

`tests/e2e/log-days.spec.ts`, criteria 5 to 8, 14 and 15. Signed in, with the `day`
fixture, so the page clock reads `day.date` as today:

```ts
import {
  expect,
  navLink,
  openWithWeek,
  test,
  waitForLocalDays,
  waitForServiceWorker,
} from './support/signedIn'

test('opens a past day from the address', async ({ page, account, day }) => {
  await account.seed([{ entry_date: day.plus(-2), steps: 4321 }])
  await page.goto('/')
  await waitForLocalDays(page, [day.plus(-2)])

  await page.goto(`/log?date=${day.plus(-2)}`)

  await expect(page.getByLabel('Day')).toHaveValue(day.plus(-2))
  await expect(page.getByLabel('Steps')).toHaveValue('4321')
})

for (const asked of ['2999-01-01', '2026-02-30', 'soon']) {
  test(`opens today for ${asked}`, async ({ page, day }) => {
    await page.goto(`/log?date=${asked}`)

    await expect(page.getByLabel('Day')).toHaveValue(day.date)
    await expect(page).toHaveURL(new RegExp(`/log\\?date=${day.date}$`))
  })
}

test('moves a day back and forth, and never past today', async ({ page, day }) => {
  await page.goto('/log')
  await expect(page.getByRole('button', { name: /^Next day,/ })).toBeDisabled()

  await page.getByRole('button', { name: /^Previous day,/ }).click()

  await expect(page.getByLabel('Day')).toHaveValue(day.plus(-1))
  await expect(page).toHaveURL(new RegExp(`/log\\?date=${day.plus(-1)}$`))
  await page.getByRole('button', { name: /^Next day,/ }).click()
  await expect(page.getByLabel('Day')).toHaveValue(day.date)
})

test('opens a past day with no network, from a cold load', async ({ page, context, day }) => {
  await page.goto('/')
  await waitForServiceWorker(page)
  await context.setOffline(true)

  await page.goto(`/log?date=${day.plus(-3)}`)

  await expect(page.getByLabel('Day')).toHaveValue(day.plus(-3))
  await context.setOffline(false)
})

test('opens a day from the heat map', async ({ page, account, day }) => {
  await openWithWeek(page, account, day)
  await navLink(page, 'Stats').first().click()
  const links = page.getByRole('list', { name: 'Open a day' }).getByRole('link')
  await expect(links).toHaveCount(7)

  await links.first().click()

  await expect(page).toHaveURL(new RegExp(`/log\\?date=${day.plus(-6)}$`))
  await expect(page.getByLabel('Day')).toHaveValue(day.plus(-6))
})
```

`openWithWeek` seeds a week of rows and opens `/`. `Stats` is the nav label of
`/analytics` in `lib/nav.ts`.

## Verification

1. `pnpm test:cov`. `lib/**` and `components/**` stay at their floors.
2. `pnpm build`. The build output lists `/log` as static (○), not dynamic (ƒ). If it is
   dynamic, the page reads the request somewhere. Fix that before you go on.
3. Open `/log?date=` and `/analytics` at 390, 768 and 1440 px. At 320 px the 7 day links
   fit in 1 row with no sideways scroll.
4. Run the `ui-reviewer` agent on `components/DailyEntryForm.tsx`,
   `components/LogDay.tsx` and `components/charts/StreakHeatMap.tsx`.
5. `pnpm verify:parallel`. `responsive.spec.ts` and `a11y.spec.ts` cover `/log` and
   `/analytics` with the new controls.

## Files touched

- `lib/format/logDate.ts` and its test (new)
- `components/LogDay.tsx` and its test (new)
- `app/(app)/log/page.tsx` and its test
- `components/DailyEntryForm.tsx` and its test
- `components/charts/StreakHeatMap.tsx` and its test
- `app/sw.ts`
- `tests/e2e/log-days.spec.ts` (new)
- `docs/design/prototype/index.html`

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer
   when another step runs its e2e suite. Never skip a check, and never add a
   design-check or test exemption to pass.
2. Run the `commit-report` skill. The report needs screenshots of every changed page at 390, 768 and 1440 px, next to the matching prototype plate: `/log?date=` for a past day next to plate 02, and the Stats heat map card next to plate 05.
3. Commit on `fix/e4-old-days`:
   ```bash
   git add lib/format/logDate.ts \
     lib/format/logDate.test.ts \
     components/LogDay.tsx \
     components/LogDay.test.tsx \
     'app/(app)/log/page.tsx' \
     'app/(app)/log/page.test.tsx' \
     components/DailyEntryForm.tsx \
     components/DailyEntryForm.test.tsx \
     components/charts/StreakHeatMap.tsx \
     components/charts/StreakHeatMap.test.tsx \
     app/sw.ts \
     tests/e2e/log-days.spec.ts \
     docs/design/prototype/index.html
   git commit -m "feat(ui): open any past day on the log"
   ```
   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.
4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked,
   and anything the owner must check on the iPhone. Say that the checklist line "A heat map cell opens its day" is met by the "Open a day" row, and that a day change drops unsaved edits. On the iPhone the owner opens a past day from the address, with previous and next, with the date picker and from the heat map, also in flight mode.
