# Step C2 — `effectiveGymSeconds`, one source of gym time

**Branch:** `fix/c2-gym-time-metric`, in worktree `../gym-tracker-c2`, cut from `fix/feedback-fixes` ·
**Wave:** 1 · **Size:** S · **Depends on:** W0 · **Unlocks:** C3, E3 (and through them
G3a and H1) · **Agent to use:** `test-writer`
**Items:** 9

## Before you start

### The worktree

```bash
cd /Users/cefalo_1/Documents/Projects/gym-tracker
git pull --ff-only 2>/dev/null; git worktree add ../gym-tracker-c2 -b fix/c2-gym-time-metric fix/feedback-fixes
cd ../gym-tracker-c2
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
echo "Dependency checks finished."
```

If any check fails, the step it names is not merged into `fix/feedback-fixes`. Stop. Report which check
failed. Do not do that step's work here.

### Already done check

```bash
test -f lib/metrics/gymTime.ts && echo "DONE: C2 is already on this branch"
```

If it passes, stop and report.

## Context to read first

1. `.claude/rules/testing.md` — `lib/metrics/**` is test first, 100 percent lines.
2. `docs/specs/2026-10-05-feedback-fixes-design.md`, sections 3.2 and 3.3.
3. The signatures in **Do** step 2 are fixed. C3, E3, G3a and H1 import
   `effectiveGymSeconds`, `hasSession` and `GymTimeSource` by these exact names and
   shapes. Use them exactly.
4. `lib/workout/gymTime.ts` — `sessionLengthSeconds`. Reuse it. It already returns
   `null` with no `ended_at` and clamps a negative length to 0.
5. `lib/workout/gymTime.test.ts` — the `session()` fixture style.

## Names this step uses from earlier steps

- W0: `pnpm verify:parallel`.
- Before this step, in `lib/workout/gymTime.ts`:
  `export function sessionLengthSeconds(session: Pick<WorkoutSession, 'started_at' | 'ended_at'>): number | null`.
  It returns `null` with no `ended_at`, and clamps a negative length to 0.
- This step runs in the same wave as A1, B1, C1 and E1. It shares no file with them.

## State before the step

- Gym time has 2 sources. The typed `daily_entries.gym_seconds`, and the finished
  sessions of the day. They meet only when the user taps "Use" on the gym time offer.
- `weekTotals` counts a session only from a typed `gym_seconds > 0`.
- Nothing computes one gym time from both sources.

## Goal

1 pure function gives the gym time of 1 day from the typed value and the sessions of
that day. 1 more function says whether that day "has a session". No screen changes in
this step. C3, E3, G3 and H1 wire the readers.

## The rules

| Input                                                       | `seconds`            | `source`     |
| ----------------------------------------------------------- | -------------------- | ------------ |
| `gym_seconds` is a number, including `0`                    | that number          | `'typed'`    |
| `gym_seconds` is null or no entry, 1+ finished live session | sum of their lengths | `'sessions'` |
| `gym_seconds` is null or no entry, no finished live session | `0`                  | `'none'`     |

- A typed value wins, also when it is `0`. A typed `0` means "no gym today". The
  user typed it, so the sessions do not override it.
- A session counts when `deleted_at` is null and `ended_at` is not null. A live
  session with no `ended_at` adds nothing and does not make the source `'sessions'`.
- A session that ends before it starts adds `0`, from `sessionLengthSeconds`.
- `hasSession` is `effectiveGymSeconds(...).seconds > 0`. That is the one meaning of
  "session" for the gap chart and the Totals card, from C3 on.
- The caller passes the sessions of 1 `entry_date` only. The function does not read
  `entry_date`. It stays in the `Pick` so callers pass real session rows.
- The stored row never changes. Nothing new syncs.

## Do

1. Run the `test-writer` agent with the acceptance list below. The tests come first.
   Copy them from **Tests**.
2. Create `lib/metrics/gymTime.ts`:

   ```ts
   import { sessionLengthSeconds } from '../workout/gymTime'

   import type { DailyEntry, WorkoutSession } from '../db/dexie'

   export type GymTimeSource = 'typed' | 'sessions' | 'none'

   type GymTimeSession = Pick<
     WorkoutSession,
     'entry_date' | 'started_at' | 'ended_at' | 'deleted_at'
   >

   const NONE = { seconds: 0, source: 'none' } as const

   function finishedLengths(sessions: GymTimeSession[]): number[] {
     return sessions.flatMap((session) => {
       const length = session.deleted_at === null ? sessionLengthSeconds(session) : null

       return length === null ? [] : [length]
     })
   }

   export function effectiveGymSeconds(
     entry: Pick<DailyEntry, 'gym_seconds'> | undefined,
     sessions: GymTimeSession[],
   ): { seconds: number; source: GymTimeSource } {
     const typed = entry?.gym_seconds ?? null

     if (typed !== null) {
       return { seconds: typed, source: 'typed' }
     }

     const lengths = finishedLengths(sessions)

     if (lengths.length === 0) {
       return NONE
     }

     return {
       seconds: lengths.reduce((total, length) => total + length, 0),
       source: 'sessions',
     }
   }

   export function hasSession(
     entry: Pick<DailyEntry, 'gym_seconds'> | undefined,
     sessions: GymTimeSession[],
   ): boolean {
     return effectiveGymSeconds(entry, sessions).seconds > 0
   }
   ```

   If ESLint asks for `readonly` arrays, keep the signature and add `readonly` only
   if the lint rule fails without it. Name the change in the commit report under
   "Things to consider", so the later steps know. Do not edit
   `docs/plan/feedback/index.md`.

3. Do not change `lib/workout/gymTime.ts`. E3 removes the offer and keeps
   `sessionLengthSeconds`.
4. Do not wire any reader. C3 does the week totals and the gap chart.

## Acceptance criteria

- [ ] A typed `gym_seconds` wins over the sessions, with source `'typed'`.
- [ ] A typed `0` wins over a finished session, with seconds `0` and source `'typed'`.
- [ ] 2 finished sessions on a day with no typed value give the sum, not the newest.
- [ ] A live session with no `ended_at` adds 0, and alone gives source `'none'`.
- [ ] A soft-deleted session is ignored.
- [ ] A session that ends before it starts adds 0, not a negative.
- [ ] No entry and no sessions give `{ seconds: 0, source: 'none' }`.
- [ ] An entry with a null `gym_seconds` and no sessions gives source `'none'`.
- [ ] `hasSession` is true for a day with a finished session and no typed value.
- [ ] `hasSession` is false for a typed `0`, even with a finished session.
- [ ] `hasSession` is false for a day with only a live session.
- [ ] `lib/metrics/gymTime.ts` reaches 100 % lines, branches and functions. Check:
      `pnpm test:cov`.
- [ ] The exported names match **Do** step 2. Check:
      `grep -cE "export (type GymTimeSource|function effectiveGymSeconds|function hasSession)" lib/metrics/gymTime.ts`
      prints `3`.
- [ ] No other file changes. Check: `git diff --name-only fix/feedback-fixes` lists only
      `lib/metrics/gymTime.ts` and `lib/metrics/gymTime.test.ts`.

## Tests

`lib/metrics/gymTime.test.ts`. One `it` per criterion.

```ts
import { describe, expect, it } from 'vitest'

import { effectiveGymSeconds, hasSession } from './gymTime'

import type { WorkoutSession } from '../db/dexie'

const DATE = '2026-09-19'

type SessionTimes = Pick<WorkoutSession, 'entry_date' | 'started_at' | 'ended_at' | 'deleted_at'>

function session(overrides: Partial<SessionTimes> = {}): SessionTimes {
  return {
    entry_date: DATE,
    started_at: '2026-09-19T07:00:00.000Z',
    ended_at: '2026-09-19T08:00:00.000Z',
    deleted_at: null,
    ...overrides,
  }
}

const EVENING = session({
  started_at: '2026-09-19T18:00:00.000Z',
  ended_at: '2026-09-19T18:30:00.000Z',
})

const LIVE = session({ started_at: '2026-09-19T19:00:00.000Z', ended_at: null })

describe('effectiveGymSeconds', () => {
  it('lets a typed gym time win over the sessions', () => {
    expect(effectiveGymSeconds({ gym_seconds: 2700 }, [session()])).toEqual({
      seconds: 2700,
      source: 'typed',
    })
  })

  it('reads a typed 0 as no gym, even with a finished session', () => {
    expect(effectiveGymSeconds({ gym_seconds: 0 }, [session()])).toEqual({
      seconds: 0,
      source: 'typed',
    })
  })

  it('adds 2 finished sessions on a day with no typed value', () => {
    expect(effectiveGymSeconds({ gym_seconds: null }, [session(), EVENING])).toEqual({
      seconds: 5400,
      source: 'sessions',
    })
  })

  it('adds 0 for a live session with no end, and calls the day none', () => {
    expect(effectiveGymSeconds(undefined, [LIVE])).toEqual({ seconds: 0, source: 'none' })
  })

  it('ignores a soft-deleted session', () => {
    const deleted = session({ deleted_at: '2026-09-19T09:00:00.000Z' })

    expect(effectiveGymSeconds(undefined, [deleted, EVENING])).toEqual({
      seconds: 1800,
      source: 'sessions',
    })
  })

  it('adds 0 for a session that ends before it starts', () => {
    const backwards = session({ ended_at: '2026-09-19T06:00:00.000Z' })

    expect(effectiveGymSeconds(undefined, [backwards, EVENING])).toEqual({
      seconds: 1800,
      source: 'sessions',
    })
  })

  it('returns 0 and none for no entry and no sessions', () => {
    expect(effectiveGymSeconds(undefined, [])).toEqual({ seconds: 0, source: 'none' })
  })

  it('returns 0 and none for an entry with no gym time and no sessions', () => {
    expect(effectiveGymSeconds({ gym_seconds: null }, [])).toEqual({ seconds: 0, source: 'none' })
  })
})

describe('hasSession', () => {
  it('is true for a finished session on a day with no typed value', () => {
    expect(hasSession(undefined, [session()])).toBe(true)
  })

  it('is false for a typed 0, even with a finished session', () => {
    expect(hasSession({ gym_seconds: 0 }, [session()])).toBe(false)
  })

  it('is false for a day with only a live session', () => {
    expect(hasSession({ gym_seconds: null }, [LIVE])).toBe(false)
  })
})
```

## Verification

1. `pnpm test:cov`. `lib/metrics/**` stays at 100 lines, 95 branches, 100 functions.
   `lib/metrics/gymTime.ts` reaches 100 on all 3.
2. `pnpm verify:parallel`.

## Files touched

- `lib/metrics/gymTime.ts` and its test

## When the step is done

1. `pnpm verify:parallel` is green. It waits for the e2e lock, so it can take longer
   when another step runs its e2e suite. Never skip a check, and never add a
   design-check or test exemption to pass.
2. Run the `commit-report` skill. No UI change, so no screenshots.
3. Commit on `fix/c2-gym-time-metric`:
   ```bash
   git add lib/metrics/gymTime.ts \
     lib/metrics/gymTime.test.ts
   git commit -m "feat(charts): add effectiveGymSeconds as the one source of gym time"
   ```
   If you stage anything after the report, write the hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.
4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `docs/plan/feedback/index.md`.
5. Report: the branch, the commit hash, the verify result, the acceptance boxes ticked,
   and anything the owner must check on the iPhone. No screen changes, so there is nothing to check on the iPhone.
