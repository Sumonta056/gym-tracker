# Step E3 — Gym time from sessions in `/log`, no offer

**Branch:** `fix/e3-gym-time-in-log`, in worktree `../gym-tracker-e3`, cut from `fix/feedback-fixes` ·
**Wave:** 6 · **Size:** M · **Depends on:** W0, C2, E2, B4 · **Unlocks:** E4, F1 ·
**Agent to use:** `test-writer` for the tests, `sync-auditor` on the repository change,
then `ui-reviewer`
**Items:** 9 · **Skills to load:** `design-system`

## Before you start

### The worktree

```bash
cd /Users/cefalo_1/Documents/Projects/gym-tracker
git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-e3 -b fix/e3-gym-time-in-log fix/feedback-fixes
cd ../gym-tracker-e3
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
{ grep -q "export function effectiveGymSeconds" lib/metrics/gymTime.ts && grep -q "export function hasSession" lib/metrics/gymTime.ts; } || echo "FAIL: C2 is not merged (no effectiveGymSeconds or hasSession in lib/metrics/gymTime.ts)"
{ grep -q "export const CARDIO_PRESETS" components/ui/DurationPicker.tsx && grep -q "export const SESSION_STEP_SECONDS" components/ui/DurationPicker.tsx && test ! -f components/ui/DurationField.tsx; } || echo "FAIL: E2 is not merged (no CARDIO_PRESETS or SESSION_STEP_SECONDS, or DurationField.tsx still exists)"
{ grep -q "export const SAVED_MESSAGE" components/ui/Toast.tsx && test -f tests/e2e/saved-toast.spec.ts; } || echo "FAIL: B4 is not merged (no SAVED_MESSAGE in components/ui/Toast.tsx)"
echo "Dependency checks finished."
```

If any check fails, the step it names is not merged into `fix/feedback-fixes`. Stop. Report which check
failed. Do not do that step's work here.

### Already done check

```bash
grep -q "export function sessionsText" components/DailyEntryForm.tsx && echo "DONE: E3 is already on this branch"
```

If it passes, stop and report.

## Context to read first

1. **Names this step uses from earlier steps** below.
2. `docs/specs/2026-10-05-feedback-fixes-design.md`, section 3.2, and item 9.
3. Load the `design-system` skill.
4. `.claude/rules/architecture.md` — the repository rule. The form reads sessions
   through `lib/db/repository.ts` only.
5. `lib/metrics/gymTime.ts` from C2 — `effectiveGymSeconds`.
6. `components/DailyEntryForm.tsx` and its test, as E2 left them.
7. `components/workout/GymTimeOffer.tsx`, `lib/workout/gymTime.ts` and their tests.
8. `lib/db/repository.ts`: `gymTimeOfferFor`, `gymTimeOfferOn`, `acceptGymTimeOffer`,
   `NoGymTimeOffer`, `listSessions`. And `lib/db/repository.test.ts`,
   `describe('finishing a session and the gym time offer')` and
   `describe('a session that runs past midnight')`.
9. `components/workout/LiveSession.tsx`, `finish`, `takeSessionTime`, `keepLogTime`,
   and its test, `describe('the gym time offer after Finish')` and
   `describe('finishSummary')`.

## Names this step uses from earlier steps

From C2, `lib/metrics/gymTime.ts`:

```ts
export type GymTimeSource = 'typed' | 'sessions' | 'none'
export function effectiveGymSeconds(
  entry: Pick<DailyEntry, 'gym_seconds'> | undefined,
  sessions: Pick<WorkoutSession, 'entry_date' | 'started_at' | 'ended_at' | 'deleted_at'>[],
): { seconds: number; source: GymTimeSource }
```

A typed value, also a typed `0`, wins with source `'typed'`. A session counts when
`ended_at !== null && deleted_at === null`. `lib/metrics/gymTime.ts` imports
`sessionLengthSeconds` from `lib/workout/gymTime.ts`, so that function stays.

From E2:

- `components/ui/DurationPicker.tsx` exports `DurationPicker`, `SESSION_PRESETS`,
  `CARDIO_PRESETS = [900, 1800, 2700, 3600]` and `SESSION_STEP_SECONDS` (60, or the step
  the owner chose in E2: read the merged file). The picker is a `group` named by its
  label. Its value is an `<output>`, role `status`. With `allowClear` and a value, it
  shows a `Clear <label>` button.
- `components/DailyEntryForm.tsx` holds `gym_seconds` and `walk_seconds` as
  `number | null` form values. Each is a `Controller` around a `DurationPicker`, with
  `control` from `useForm`. The gym time offer still fills the gym picker through
  `takeSessionTime`. This step deletes the offer.
- `DurationField` is gone.

From B4:

- `components/workout/LiveSession.tsx` takes `onFinished?: () => void`. With no prop,
  Finish calls `router.push(WORKOUTS_PATH)`. Keep that default.
- `components/ui/Toast.tsx`: a save calls `useToast().show(SAVED_MESSAGE)`. The line
  "Saved on this device." stays.

Before this step: `listSessions(from: string, to: string): Promise<WorkoutSession[]>` in
`lib/db/repository.ts` returns the not-deleted sessions whose `entry_date` is in the
range. `formatDuration(seconds, 'short' | 'clock')` lives in `lib/duration.ts`.

## State before the step

- `/log` shows a typed gym time only. A day with sessions and no typed gym time shows
  an empty picker.
- 2 places offer the newest session length as gym time: a card on `/log` and a sheet
  after Finish. A tap on "Use" writes `gym_seconds` into the daily row. That is a
  second source of gym time, and it takes 1 session, not the sum.
- After B4, Finish moves to `/workouts` with `router.push`, unless the offer sheet
  opens first. F1 later adds a finish summary.
- `effectiveGymSeconds` exists (C2), and the other readers use it.

## Goal

`/log` shows the gym time the rest of the app uses: the typed value, or else the sum of
the finished sessions of that day. The user can override it and clear the override. The
offer is gone, so nothing writes a session length into the daily row.

## The callers this step removes

`grep -rnE "gymTimeOffer|GymTimeOffer|acceptGymTimeOffer|NoGymTimeOffer|GymTimeSheet|OFFER_REGION|FINISHED_TITLE|GYM_TIME_SAVE_FAILED|newestFinished|finishSummary" app components lib tests`
lists every one. On the code before this step it gives:

| File                                       | What uses the offer                                                                                |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `components/workout/GymTimeOffer.tsx`      | `GymTimeOfferCard`, `GymTimeSheet` and 5 constants. The whole file.                                |
| `components/workout/GymTimeOffer.test.tsx` | Its test. The whole file.                                                                          |
| `components/DailyEntryForm.tsx`            | `gymTimeOfferOn`, `acceptGymTimeOffer`, `GymTimeOfferCard`, `offerBlock`, 4 states                 |
| `components/DailyEntryForm.test.tsx`       | The repository mock, `OFFER`, `firstOffer`, `firstUse` and 8 offer tests                           |
| `components/workout/LiveSession.tsx`       | 2 source members, `FinishOffer`, `finishSummary`, `takeSessionTime`, `keepLogTime`, `GymTimeSheet` |
| `components/workout/LiveSession.test.tsx`  | `GYM_TIME_SAVE_FAILED`, `finishSummary`, 2 `describe` blocks                                       |
| `lib/db/repository.ts`                     | 3 functions, `NoGymTimeOffer`, the `GymTimeOffer` type export, the `gymTime` import                |
| `lib/db/repository.test.ts`                | 3 imports, 2 `describe` blocks                                                                     |
| `lib/workout/gymTime.ts` and its test      | `GymTimeOffer`, `gymTimeOffer`, `newestFinished`. `sessionLengthSeconds` stays (C2).               |
| `lib/csv/import.test.ts`                   | 3 keys in its repository mock                                                                      |
| `app/(app)/log/page.test.tsx`              | 2 keys in its repository mock                                                                      |
| `app/styleguide/page.tsx` and its test     | `SAMPLE_GYM_OFFER`, the `gym-offer-sample` block, 2 states, 1 test                                 |
| `tests/e2e/workout.spec.ts`                | The `Session finished` dialog and its `Not now` button                                             |
| `docs/design/prototype/index.html`         | The offer card in plate 02 and plate 08                                                            |

`lib/sync/**` uses none of them. Run the grep again at the start of the step. If it
lists a file that is not in this table, add the file to this step and say so in the
report.

## Do

1. Run the `test-writer` agent with the acceptance list below. The tests come first.
2. `components/DailyEntryForm.tsx`:
   - Delete the offer: the `offer`, `offerRead`, `offerBusy` and `offerError` states,
     the offer effect, `takeSessionTime`, `offerBlock`, both `offerBlock(...)` calls,
     `setOfferRead` in `save`, and the imports of `acceptGymTimeOffer`,
     `gymTimeOfferOn`, `GYM_TIME_SAVE_FAILED`, `GymTimeOfferCard` and `GymTimeOffer`.
   - Read the sessions of the day through the repository. `listSessions(date, date)`
     already returns the not-deleted sessions of 1 `entry_date`, so no new repository
     function is needed:

     ```tsx
     const [sessions, setSessions] = useState<WorkoutSession[]>([])

     useEffect(() => {
       let cancelled = false

       void listSessions(entryDate, entryDate).then(
         (found) => {
           if (!cancelled) {
             setSessions(found)
           }
         },
         () => {
           if (!cancelled) {
             setSessions([])
           }
         },
       )

       return () => {
         cancelled = true
       }
     }, [entryDate])
     ```

   - Add 2 exported pure helpers above the component:

     ```ts
     export function finishedCount(sessions: readonly WorkoutSession[]): number {
       return sessions.filter((session) => session.ended_at !== null && session.deleted_at === null)
         .length
     }

     export function sessionsText(count: number, seconds: number): string {
       const word = count === 1 ? '1 session' : `${String(count)} sessions`

       return `From ${word} · ${formatDuration(seconds, 'short')}`
     }
     ```

   - Replace the gym `Controller` from E2 with a block that has 2 states. The typed value
     is the form value. The derived value comes from `effectiveGymSeconds` with no
     entry, so it is the session sum or 0:

     ```tsx
     const gymValue = watch('gym_seconds')
     const fromSessions = effectiveGymSeconds(undefined, sessions)
     const sessionCount = finishedCount(sessions)
     ```

     ```tsx
     {
       gymValue === null && fromSessions.source === 'sessions' ? (
         <div
           role="group"
           aria-labelledby="gym_seconds-label"
           className="flex w-full min-w-0 flex-col gap-[7px]"
         >
           <MicroLabel id="gym_seconds-label">Gym time</MicroLabel>
           <div className="bg-surface border-border rounded-input flex items-center justify-between gap-3 border p-3">
             <div className="min-w-0">
               <output className="text-text block text-lg font-extrabold tracking-[-0.4px]">
                 {formatDuration(fromSessions.seconds, 'clock')}
               </output>
               <p className="text-muted text-xs">
                 {sessionsText(sessionCount, fromSessions.seconds)}
               </p>
             </div>
             <button
               type="button"
               className={PILL}
               onClick={() => {
                 setValue('gym_seconds', fromSessions.seconds, { shouldDirty: true })
               }}
             >
               Set a value
             </button>
           </div>
         </div>
       ) : (
         <div className="flex flex-col gap-2">
           <Controller
             control={control}
             name="gym_seconds"
             render={({ field }) => (
               <DurationPicker
                 id="gym_seconds"
                 label="Gym time"
                 value={field.value}
                 onChange={field.onChange}
                 presets={SESSION_PRESETS}
                 step={SESSION_STEP_SECONDS}
                 allowClear
               />
             )}
           />
           {gymValue !== null && fromSessions.source === 'sessions' ? (
             <p className="text-muted text-xs">
               {`The sessions say ${formatDuration(fromSessions.seconds, 'short')}. Clear to use them.`}
             </p>
           ) : null}
         </div>
       )
     }
     ```

     ```ts
     const PILL =
       'bg-surface-2 border-border text-text inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border px-4 text-[13px] font-bold whitespace-nowrap'
     ```

     - "Set a value" copies the derived seconds into the picker. The user then moves
       it. Nothing is saved until Save.
     - Clear in the picker sets `null`, so the derived state comes back.
     - Both states are a `group` named "Gym time" with 1 `status` element, so a test
       and a screen reader find the value the same way.
     - A save with no typed value stores `gym_seconds: null`. The stored row never holds
       a derived value (spec 3.2).
3. `components/workout/LiveSession.tsx`:
   - Delete `gymTimeOfferFor` and `acceptGymTimeOffer` from `LiveSessionSource` and
     from `REPOSITORY_LIVE_SOURCE`, and from the repository import.
   - Delete `FinishOffer`, `finishSummary`, the `finishOffer`, `offerBusy` and
     `offerError` states, `takeSessionTime`, `keepLogTime` and the `<GymTimeSheet>`.
     Delete the imports that are then unused: `GYM_TIME_SAVE_FAILED`, `GymTimeSheet`,
     `GymTimeOffer` and `prettyDate`.
   - `finish` hands back as soon as the session is finished:

     ```tsx
     source.finishSession(session.id).then(
       () => {
         onFinished()
       },
       (cause: unknown) => {
         setBusy(false)
         setError(failure(cause, FINISH_FAILED))
       },
     )
     ```

     Keep the default `onFinished` that B4 set. F1 adds the summary on top of this.
4. Delete `components/workout/GymTimeOffer.tsx` and its test.
5. `lib/db/repository.ts`: delete `gymTimeOfferFor`, `gymTimeOfferOn`,
   `acceptGymTimeOffer`, `NoGymTimeOffer`, `export type { GymTimeOffer }`, the
   `import type { GymTimeOffer }` and the `import { gymTimeOffer, newestFinished,
sessionLengthSeconds }`. Keep `dayFields`: `importDays` uses it. Keep `liveSession`:
   the set writes use it.
6. `lib/workout/gymTime.ts`: C2 made `lib/metrics/gymTime.ts` import
   `sessionLengthSeconds` from it. Keep `sessionLengthSeconds` and its `describe` block.
   Delete `GymTimeOffer`, `isLiveFinished`, `gymTimeOffer`, `newestFinished`, the
   `MAX_DURATION_SECONDS` and `DailyEntry` imports, and their tests. Then
   `grep -rn "sessionLengthSeconds" app components lib` lists `lib/metrics/gymTime.ts`
   and nothing from the offer.
7. `lib/csv/import.test.ts` and `app/(app)/log/page.test.tsx`: delete the offer keys from
   the repository mocks. Add `listSessions: vi.fn(() => Promise.resolve([]))` to the
   `/log` page mock.
8. `app/styleguide/page.tsx`: delete `SAMPLE_GYM_OFFER`, the `gym-offer-sample` block,
   the `<GymTimeSheet>`, `sampleOfferOpen`, `sampleOfferUsed` and the imports. Delete
   "opens the finish sheet sample and closes it from either choice" from its test.
9. `tests/e2e/workout.spec.ts`, "keeps every set of a session logged offline through a
   finish and a reload": delete the 3 lines that wait for the `Session finished` dialog
   and click `Not now`. After `Finish session` the next line expects `/workouts`. Then,
   before `page.reload()`, add the check that `/log` shows the session:

   ```ts
   await navLink(page, 'Log the day').first().click()
   await expect(page.getByRole('group', { name: 'Gym time' })).toContainText(/From 1 session · /)
   await page.goto('/workouts')
   ```

   The session lasts about 1 hour less the seconds the test spends on its sets, so the
   check matches the words, not the minutes.

10. `docs/design/prototype/index.html`:
    - Plate 02 "Daily log": delete the offer card. Replace the gym picker with the
      derived state: the micro label "Gym time", the value `1:12:05`, the line
      "From 2 sessions · 1h 12m" and a `pill` button "Set a value".
    - Plate 08 "Finish and the gym time offer": rename it `Finish`. Delete the
      `scrim` and the `bottomsheet`. Keep the session screen behind them, and add under
      the frame the muted line "Finish goes straight to /workouts." F1 puts its summary
      sheet into this plate.

## Acceptance criteria

- [ ] `sessionsText(1, 3600)` is "From 1 session · 1h". `sessionsText(2, 4325)` is
      "From 2 sessions · 1h 12m".
- [ ] `finishedCount` skips a session with no `ended_at` and a soft-deleted session.
- [ ] `/log` reads the sessions of its date through `listSessions(date, date)`.
- [ ] A day with 2 finished sessions and no typed gym time shows their sum, with
      "From 2 sessions · 1h 12m".
- [ ] "Set a value" opens the picker at the derived seconds.
- [ ] Clear in the picker brings the derived state back.
- [ ] A save in the derived state stores `gym_seconds: null`.
- [ ] A typed value wins, and the line under it names the session time.
- [ ] A day with no sessions shows the plain picker with "Not set".
- [ ] A failed session read shows the plain picker and no error.
- [ ] Finish hands straight back to its owner. No sheet opens.
- [ ] Finish writes no daily entry and queues no `daily_entries` write.
- [ ] A session past midnight is listed under its own `entry_date`.
- [ ] The repository exports no offer function, and the grep in "The callers this step
      removes" returns nothing.
- [ ] The e2e workout test finishes with no sheet and `/log` shows "From 1 session".
- [ ] `lib/workout/gymTime.ts` keeps `sessionLengthSeconds`, and
      `lib/metrics/gymTime.ts` still imports it. Check:
      `grep -n "sessionLengthSeconds" lib/metrics/gymTime.ts lib/workout/gymTime.ts`.
- [ ] No `lib/sync/**` file changes. Check: `git diff --name-only fix/feedback-fixes -- lib/sync`
      prints nothing.
- [ ] The `sync-auditor` agent finds no repository write without its outbox entry.
- [ ] Finish with no `onFinished` prop still moves to `/workouts` with `router.push`,
      as B4 left it. Test: B4's `router.push` test in `LiveSession.test.tsx` stays
      green.
- [ ] The prototype plate 02 shows the derived gym time, and plate 08 is named
      `Finish` with no sheet. Manual: screenshots in the report.
- [ ] The `ui-reviewer` agent reports no drift on `components/DailyEntryForm.tsx`.

## Tests

`components/DailyEntryForm.test.tsx`. Delete `OFFER`, `SESSION_ID`, `firstOffer`,
`firstUse`, the offer mocks and every test whose name says "offer" or "Use". Add
`listSessions` to the mock and these tests:

```tsx
vi.mock('../lib/db/repository', () => ({
  getDay: vi.fn(() => Promise.resolve(undefined)),
  upsertDay: vi.fn(() => Promise.resolve()),
  listSessions: vi.fn(() => Promise.resolve([])),
}))

function session(id: string, startedAt: string, endedAt: string | null): WorkoutSession {
  return {
    id,
    entry_date: DATE,
    started_at: startedAt,
    ended_at: endedAt,
    status: endedAt === null ? 'active' : 'finished',
    created_at: startedAt,
    updated_at: endedAt ?? startedAt,
    deleted_at: null,
  }
}

const TWO_SESSIONS = [
  session(
    'a1111111-1111-4111-8111-111111111111',
    '2026-09-19T07:00:00.000Z',
    '2026-09-19T07:30:00.000Z',
  ),
  session(
    'b2222222-2222-4222-8222-222222222222',
    '2026-09-19T17:00:00.000Z',
    '2026-09-19T17:42:05.000Z',
  ),
]

function gymGroup() {
  return within(screen.getByRole('group', { name: 'Gym time' }))
}

describe('sessionsText', () => {
  it('names one session and the short time', () => {
    expect(sessionsText(1, 3600)).toBe('From 1 session · 1h')
  })

  it('names many sessions and the short time', () => {
    expect(sessionsText(2, 4325)).toBe('From 2 sessions · 1h 12m')
  })
})

describe('finishedCount', () => {
  it('counts only finished sessions that are not deleted', () => {
    const live = session('c3333333-3333-4333-8333-333333333333', '2026-09-19T18:00:00.000Z', null)
    const gone = { ...TWO_SESSIONS[0], deleted_at: '2026-09-19T19:00:00.000Z' } as WorkoutSession
    expect(finishedCount([...TWO_SESSIONS, live, gone])).toBe(2)
  })
})

describe('DailyEntryForm gym time', () => {
  it('reads the sessions of its own date through the repository', async () => {
    await renderForm()
    expect(listSessions).toHaveBeenCalledWith(DATE, DATE)
  })

  it('shows the sum of the sessions when no gym time is typed', async () => {
    vi.mocked(listSessions).mockResolvedValue(TWO_SESSIONS)
    await renderForm()

    expect(await screen.findByText('From 2 sessions · 1h 12m')).toBeVisible()
    expect(gymGroup().getByRole('status')).toHaveTextContent('1:12:05')
  })

  it('opens the picker at the session sum on Set a value', async () => {
    vi.mocked(listSessions).mockResolvedValue(TWO_SESSIONS)
    await renderForm()

    await userEvent.click(await screen.findByRole('button', { name: 'Set a value' }))

    expect(gymGroup().getByRole('status')).toHaveTextContent('1:12:05')
    expect(screen.getByRole('button', { name: 'Clear Gym time' })).toBeVisible()
  })

  it('goes back to the session sum on Clear', async () => {
    vi.mocked(listSessions).mockResolvedValue(TWO_SESSIONS)
    await renderForm()
    await userEvent.click(await screen.findByRole('button', { name: 'Set a value' }))

    await userEvent.click(screen.getByRole('button', { name: 'Clear Gym time' }))

    expect(screen.getByText('From 2 sessions · 1h 12m')).toBeVisible()
  })

  it('saves no gym time while the value comes from the sessions', async () => {
    vi.mocked(listSessions).mockResolvedValue(TWO_SESSIONS)
    await renderForm()
    await screen.findByText('From 2 sessions · 1h 12m')

    await userEvent.click(screen.getByRole('button', { name: 'Save entry' }))

    await waitFor(() => {
      expect(upsertDay).toHaveBeenCalledWith(expect.objectContaining({ gym_seconds: null }))
    })
  })

  it('lets a typed value win and names the session time under it', async () => {
    vi.mocked(getDay).mockResolvedValue({ ...STORED, gym_seconds: 3600 })
    vi.mocked(listSessions).mockResolvedValue(TWO_SESSIONS)
    await renderForm()

    await waitFor(() => {
      expect(gymGroup().getByRole('status')).toHaveTextContent('1:00:00')
    })
    expect(screen.getByText('The sessions say 1h 12m. Clear to use them.')).toBeVisible()
  })

  it('shows the plain picker for a day with no session', async () => {
    await renderForm()
    expect(gymGroup().getByRole('status')).toHaveTextContent('Not set')
    expect(screen.queryByRole('button', { name: 'Set a value' })).not.toBeInTheDocument()
  })

  it('shows the plain picker and no error when the sessions cannot be read', async () => {
    vi.mocked(listSessions).mockRejectedValue(new Error('no'))
    await renderForm()
    await waitFor(() => {
      expect(listSessions).toHaveBeenCalled()
    })
    expect(gymGroup().getByRole('status')).toHaveTextContent('Not set')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
```

Add `vi.mocked(listSessions).mockResolvedValue([])` to `beforeEach`. The `session`
fixture holds every field of `WorkoutSession` in `lib/db/dexie.ts`. If an earlier step
added a field to that type, add it to the fixture.

`components/workout/LiveSession.test.tsx`. Replace `describe('the gym time offer after
Finish')` and `describe('finishSummary')` with:

```tsx
describe('Finish', () => {
  const START = '2026-09-01T17:30:00.000Z'
  const END = '2026-09-01T18:42:05.000Z'

  async function finishAnHourLater() {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(START))
    await startSession('2026-09-01')
    vi.setSystemTime(new Date(END))
    const view = await renderLive()

    await userEvent.click(screen.getByRole('button', { name: 'Finish session' }))

    return view
  }

  it('hands straight back to its owner, with no sheet', async () => {
    const { onFinished } = await finishAnHourLater()

    await waitFor(() => {
      expect(onFinished).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('writes no daily entry and queues no daily write', async () => {
    const { onFinished } = await finishAnHourLater()
    await waitFor(() => {
      expect(onFinished).toHaveBeenCalledTimes(1)
    })

    expect(await db.dailyEntries.count()).toBe(0)
    expect(
      (await db.outbox.toArray()).filter((item) => item.table_name === 'daily_entries'),
    ).toEqual([])
  })
})
```

`lib/db/repository.test.ts`. Delete both offer `describe` blocks and the 3 imports.
Delete `NoGymTimeOffer` from the imports. Add:

```ts
describe('a session that runs past midnight', () => {
  it('is listed under its own entry_date, not the date it ended', async () => {
    const session = await finishedSession(
      '2026-09-19',
      new Date(2026, 8, 19, 23, 30).toISOString(),
      new Date(2026, 8, 20, 0, 30).toISOString(),
    )

    expect((await listSessions('2026-09-19', '2026-09-19')).map((row) => row.id)).toEqual([
      session.id,
    ])
    expect(await listSessions('2026-09-20', '2026-09-20')).toEqual([])
  })
})
```

And in `describe('finishSession')`:

```ts
it('writes no daily entry and queues no daily write', async () => {
  const session = await startSession('2026-09-01')

  await finishSession(session.id)

  expect(await db.dailyEntries.count()).toBe(0)
  expect(await dailyQueued()).toEqual([])
})
```

Delete `dailyQueued` or `finishedSession` only if no test uses it after this change.

## Verification

1. `pnpm test:cov`. `lib/**` and `components/**` stay at their floors.
2. The grep in "The callers this step removes" returns nothing.
3. Run the `sync-auditor` agent on `lib/db/repository.ts`. It must find no lost write:
   no repository write left without its outbox entry.
4. Open `/log` at 390, 768 and 1440 px with 2 sessions on the day and no typed gym time.
5. Run the `ui-reviewer` agent on `components/DailyEntryForm.tsx`.
6. `pnpm verify:parallel`.

## Files touched

- `components/DailyEntryForm.tsx` and its test
- `components/workout/LiveSession.tsx` and its test
- `components/workout/GymTimeOffer.tsx` and its test (deleted)
- `lib/db/repository.ts` and its test
- `lib/workout/gymTime.ts` and its test (trimmed to `sessionLengthSeconds`)
- `lib/csv/import.test.ts`, `app/(app)/log/page.test.tsx`
- `app/styleguide/page.tsx` and its test
- `tests/e2e/workout.spec.ts`
- `docs/design/prototype/index.html`

## Things to consider

Name each of these in the report.

- The phase 3 plan conflicts with this step. Its step S3.9 still uses the gym time offer
  that this step removes. S3.9 must use `sessionStats` and `SessionSummary` from F1
  instead. Do not edit the phase 3 plan here. The owner updates it.
- The stored row holds only a typed gym time. The session sum shows on `/log`, but never
  syncs as `gym_seconds`.

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer
   when another step runs its e2e suite. Never skip a check, and never add a
   design-check or test exemption to pass.
2. Run the `commit-report` skill. The report needs screenshots of every changed page at 390, 768 and 1440 px, next to the matching prototype plate: `/log` with a derived gym time and with a typed gym time, and `/workout` after Finish, next to prototype plates 02 and 08.
3. Commit on `fix/e3-gym-time-in-log`:
   ```bash
   git add components/DailyEntryForm.tsx \
     components/DailyEntryForm.test.tsx \
     components/workout/LiveSession.tsx \
     components/workout/LiveSession.test.tsx \
     components/workout/GymTimeOffer.tsx \
     components/workout/GymTimeOffer.test.tsx \
     lib/db/repository.ts \
     lib/db/repository.test.ts \
     lib/workout/gymTime.ts \
     lib/workout/gymTime.test.ts \
     lib/csv/import.test.ts \
     'app/(app)/log/page.test.tsx' \
     app/styleguide/page.tsx \
     app/styleguide/page.test.tsx \
     tests/e2e/workout.spec.ts \
     docs/design/prototype/index.html
   git commit -m "feat(ui): derive gym time from the sessions on the log and drop the offer"
   ```
   `git add` stages the 2 deleted `GymTimeOffer` files as deletions. Also add any file that the grep in "The callers this step removes" found outside the table.
   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.
4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked,
   and anything the owner must check on the iPhone. Name the phase 3 conflict. On the iPhone the owner finishes a workout with no typed gym time, then checks that Finish opens `/workouts` with no sheet and `/log` shows "From 1 session".
