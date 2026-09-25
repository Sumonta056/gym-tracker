# Gym Tracker — Design Specification

Date: 2026-09-20
Status: approved, not started
Design mockups: https://claude.ai/artifact/8pajWGN8ykJNhxaGLSNNG4

---

## 1. Context

Today the user records gym data in an Excel sheet. One row per gym day, 8 columns:
Day, Walk Time, Gym Time, Avg Heart Rate, Highest Rate, Weight, Calories Burnt, Steps.
The sheet holds 16 rows from August 12 to September 13.

The sheet has three problems:

1. It is not on the phone at the gym.
2. It gives no charts, no streak and no trend.
3. It records no exercise detail. The user cannot see if the bench press load goes up.

The goal is a personal installable web app that replaces the sheet, records a live
workout, syncs to the cloud, and shows progress charts.

## 2. Decisions

| Topic        | Decision                                                                  |
| ------------ | ------------------------------------------------------------------------- |
| Platform     | Next.js Progressive Web App only. No App Store, no Play Store.            |
| Scope        | Daily summary (8 columns) **and** a live exercise log (sets, reps, load). |
| Users        | One user, but with real login and row level security.                     |
| Data entry   | Manual form, plus a one-time CSV import of the 16 old rows.               |
| Offline      | Offline first. IndexedDB is the local truth. An outbox syncs to Supabase. |
| Sync engine  | Dexie plus a hand-written outbox. No third service.                       |
| Units        | Metric only (kg, km). Store metric. Add an imperial display toggle later. |
| CSV import   | Import, mark unclear rows, let the user fix them on a review screen.      |
| Look         | Dark, high contrast, lime accent. Figtree. See section 6.                 |
| Layout       | Mobile first. A laptop gets a sidebar layout, not a stretched phone.      |
| Delivery     | Phase 0 foundation, then Phase 1, then Phase 2. See `docs/plan/`.         |
| Design drift | A `design-system` skill plus a prototype file plus a `/styleguide` route. |

### Known data problem

The Walk Time and Gym Time columns mix two formats:
`15.54`, `1:03:13`, `01.44.50`, `1.15.37`, `02.37.00`.
Some values are `mm.ss`. Some values are `h.mm.ss`.

The database stores **integer seconds**. The CSV importer guesses the format, flags
each unclear row, and shows a review screen before it commits anything.

## 3. Tech stack

| Layer               | Choice                                        | Reason                                                     |
| ------------------- | --------------------------------------------- | ---------------------------------------------------------- |
| Framework           | Next.js 15, App Router, TypeScript strict     | Best Progressive Web App support. Installs on iPhone.      |
| Styling             | Tailwind CSS v4                               | Fast, and the dark theme lives in CSS tokens.              |
| Components          | shadcn/ui                                     | Accessible primitives the user owns and can restyle.       |
| Progressive Web App | `@serwist/next`                               | The maintained Workbox wrapper. `next-pwa` is dead.        |
| Local database      | Dexie 4 (IndexedDB)                           | The local source of truth. Works with no network.          |
| Cloud               | Supabase (Postgres, Auth, Row Level Security) | Chosen by the user.                                        |
| Charts              | Recharts                                      | Simple API, good enough for every chart in section 7.      |
| Motion              | `motion` (Framer Motion)                      | The set counter and the streak need motion.                |
| Forms               | react-hook-form + zod                         | One zod schema validates the form, the outbox and the CSV. |
| Tests               | Vitest, Testing Library, Playwright           | Playwright covers install and offline.                     |
| Deploy              | Vercel                                        | Zero setup with Next.js.                                   |

## 4. Architecture

```
┌─────────────────────────────────────────────────────┐
│  Next.js PWA  (React Server + Client Components)    │
│                                                      │
│   Screens  ──►  Repository layer  ──►  Dexie        │
│                        │                (IndexedDB)  │
│                        └──► writes also land in      │
│                             the `outbox` table       │
└───────────────────────────┬─────────────────────────┘
                            │
                    Sync worker (client)
                    drains the outbox on:
                    - app start
                    - the window `online` event
                    - every 30 s while online
                            │
                            ▼
                 ┌────────────────────────┐
                 │  Supabase Postgres     │
                 │  Row Level Security    │
                 │  user_id = auth.uid()  │
                 └────────────────────────┘
```

**Rule.** No screen calls Supabase directly. Every screen calls the repository layer.
The repository writes to Dexie and returns at once. The sync worker is the only code
that talks to Supabase. This keeps the whole app fast and testable.

**Conflict rule.** Last write wins, compared on `updated_at`. This is safe because
there is one user. A `deleted_at` column gives soft delete, so a delete also syncs.

**Identity rule.** The client generates every `id` as a UUID. An offline write keeps
its identity when it syncs later, so a retry never creates a duplicate row.

## 5. Data model

```sql
profiles
  id               uuid    pk, references auth.users
  display_name     text
  unit_system      text    default 'metric'
  height_cm        numeric
  target_weight_kg numeric
  step_goal        integer default 12000
  updated_at       timestamptz

daily_entries
  id              uuid    pk
  user_id         uuid    references auth.users
  entry_date      date            -- unique per (user_id, entry_date)
  walk_seconds    integer
  gym_seconds     integer
  avg_heart_rate  integer
  max_heart_rate  integer
  weight_kg       numeric(5,2)
  calories_burnt  integer
  steps           integer
  note            text
  created_at      timestamptz
  updated_at      timestamptz
  deleted_at      timestamptz

exercises
  id              uuid    pk
  user_id         uuid    null      -- null means a seeded global exercise
  name            text
  muscle_group    text              -- chest, back, legs, shoulders, arms, core, cardio
  is_archived     boolean default false
  updated_at      timestamptz

workout_sessions
  id              uuid    pk
  user_id         uuid
  entry_date      date              -- joins to daily_entries
  started_at      timestamptz
  ended_at        timestamptz
  status          text              -- active | finished
  updated_at      timestamptz
  deleted_at      timestamptz

workout_sets
  id              uuid    pk
  session_id      uuid    references workout_sessions
  exercise_id     uuid    references exercises
  set_index       integer
  reps            integer
  weight_kg       numeric(6,2)
  rpe             integer null      -- rate of perceived effort, 1 to 10
  completed_at    timestamptz
  updated_at      timestamptz
  deleted_at      timestamptz
```

Every table gets a Row Level Security policy: `user_id = auth.uid()`.
`workout_sets` checks ownership through its parent session.

## 6. Design system

One hybrid style. It takes the hero number and the 2x2 stat grid from Neon Pulse, the
micro-labels and the dense data panels from Command Deck, and the filled accent card
and the large radii from Card Stack.

### Typography

Figtree, weights 400, 500, 600, 700, 800. Google Fonts.
`font-variant-numeric: tabular-nums` on the body, so numbers do not jump.

| Role         | Size      | Weight | Tracking               |
| ------------ | --------- | ------ | ---------------------- |
| Hero number  | 44–50 px  | 800    | -2.2 to -2.6 px        |
| Screen title | 23 px     | 700    | -0.6 px                |
| Card number  | 25 px     | 700    | -0.9 px                |
| Body         | 14–15 px  | 500    | 0                      |
| Micro label  | 9.5–10 px | 700    | 1.5–1.6 px, upper case |

### Color tokens

| Token           | Value     | Use                             |
| --------------- | --------- | ------------------------------- |
| `--ground`      | `#0B0B0D` | page background                 |
| `--surface`     | `#15151A` | cards, inputs                   |
| `--surface-2`   | `#1E1E25` | pressed state, secondary button |
| `--border`      | `#24242C` | every card and input border     |
| `--text`        | `#F4F4F7` | primary text                    |
| `--muted`       | `#8C8C99` | labels, secondary text          |
| `--dim`         | `#6E6E7B` | inactive tab, hint text         |
| `--accent`      | `#C6F135` | action, today, gym time         |
| `--accent-ink`  | `#10160A` | text on the accent fill         |
| `--data-cyan`   | `#22D3EE` | walk, steps, volume load        |
| `--data-violet` | `#A78BFA` | weight, 7-day average           |
| `--warn`        | `#FB923C` | cardio zone, warning            |
| `--danger`      | `#F87171` | peak zone, destructive          |
| `--ok`          | `#4ADE80` | sync status                     |

### Shape and spacing

- Card radius 20 px. Hero card radius 24 px. Input radius 15–16 px. Pill 999 px.
- Screen side padding 20 px. Gap between cards 11–12 px.
- Every tap target is 44 px or taller.
- Card border is always 1 px. A selected card uses the accent as its border.

### Components

- **Status chip.** A 6 px dot plus an upper-case word. Green `SYNCED`, orange
  `OFFLINE`. It is visible on every data screen.
- **Tab bar.** Five slots. The middle slot is a filled accent button that starts a
  live session. The other four are icon plus a 10 px label.
- **Stat card.** Micro label, then a 25 px number, then an optional 5 px progress bar
  or a sparkline.

### Responsive contract

| Range          | Layout                                                                                 |
| -------------- | -------------------------------------------------------------------------------------- |
| Under 640 px   | One column. 20 px gutters. Bottom tab bar with a centre action.                        |
| 640 to 1023 px | Two-column card grid. Bottom tab bar stays. 28 px gutters.                             |
| 1024 px and up | Left sidebar 240 px. Content capped at 1100 px, centred. Three columns. No bottom bar. |

Mobile first. The phone style is the base. `md:` and `lg:` add upward only.
The tab bar adds `env(safe-area-inset-bottom)`. No horizontal scroll from 320 px to
2560 px. Every tap target is 44 px or taller at every breakpoint. Charts fill their
container and never take a fixed pixel width.

### How the design stays consistent

Three artefacts guard it. Phase 0 builds all three.

1. `.claude/skills/design-system/` — the skill that loads before any UI work. It
   holds the tokens, the component recipes, the responsive contract and a pass or
   fail checklist.
2. `docs/design/prototype/index.html` — a standalone file showing all seven screens.
   It imports no project code, so it cannot drift. It is the visual contract.
3. `/styleguide` — a live route rendering every token and primitive. It is the drift
   detector. The prototype shows the target. The style guide shows the truth. If the
   two differ, one of them is a bug.

No component holds a raw hex value. Charts read `lib/design/tokens.ts`, which a unit
test keeps in step with `app/globals.css`.

## 7. Screens

| #   | Route            | Purpose                                                                       |
| --- | ---------------- | ----------------------------------------------------------------------------- |
| 0   | `/sign-in`       | Email and password, magic link fallback. Plus the iPhone install hint.        |
| 1   | `/`              | Dashboard: hero gym time, streak, 2 stat cards, heart rate zones, week totals |
| 2   | `/log`           | The 8-column daily form. It offers the finished session length for Gym Time.  |
| 3   | `/workout`       | Live session: timer, set rows, rest timer, running volume                     |
| 4   | `/workout` sheet | Exercise picker: search, muscle filter, recent list                           |
| 5   | `/analytics`     | Day / Week / Month tabs with the charts of section 8                          |
| 6   | `/profile`       | Units, targets, CSV import and export, sync state, sign out                   |

## 8. Charts

**Phase 1**

- Weight per day, with a 7-day moving average line. Raw weight is noisy: the sheet
  swings 72.45 to 74.56 within a month.
- Calories burnt per day, as bars.
- Steps per day, as bars.
- Average and highest heart rate, as two lines.
- Heart rate zone split for the day, as a stacked bar.
- Streak: a calendar heat map plus a current streak count.
- Week totals: sessions, gym minutes, calories, steps.

Every chart must read on the first day of use and with a full month: day labels, value
labels, a goal or average line, and a clear state for sparse data. The rules are in
`.claude/skills/design-system/references/charts.md`.

**Phase 2**

- Volume load per session: the sum of reps times weight. The single best number
  for lifting progress.
- Estimated one-rep maximum per exercise, by the Epley formula
  `weight x (1 + reps / 30)`.
- Personal record per exercise: best load and best volume, with the date.
- Muscle group balance: the share of weekly volume by muscle group.
- Gap between sessions, as a histogram. The sheet shows 2 to 4 day gaps.
- Calories per gym minute.

## 9. Delivery

Three phases. Each phase has its own step-by-step plan file. Do not start a phase
before the previous phase passes its checklist.

| Phase | File                      | Content                                                                                        |
| ----- | ------------------------- | ---------------------------------------------------------------------------------------------- |
| 0     | `docs/plan/00-phase-0.md` | Tooling, the Claude workspace, the design system, the prototype, the Progressive Web App shell |
| 1     | `docs/plan/01-phase-1.md` | Auth, the 8-column form, offline sync, the dashboard, the Phase 1 charts                       |
| 2     | `docs/plan/02-phase-2.md` | The exercise library, the live set logger, the rest timer, the Phase 2 charts, the CSV import  |

`PROGRESS.md` names the next step. It is the entry point for every new session.

### Phase 0 in short

Phase 0 ships no feature. It stops mistakes. It delivers:

- pnpm, TypeScript strict, ESLint flat config, Prettier, Husky, lint-staged and
  commitlint with a fixed scope list.
- Vitest with per-path coverage floors, and Playwright with three device projects:
  iPhone 14, Pixel 7 and desktop 1440.
- GitHub Actions running format, lint, typecheck, coverage, build, end-to-end tests
  and a Lighthouse audit.
- The Claude workspace: `CLAUDE.md`, `.claude/rules/`, `.claude/skills/`,
  `.claude/agents/` and `.claude/settings.json` hooks.
- The design system: tokens, primitives, the `design-system` skill, the standalone
  prototype file and the `/styleguide` route.
- The report gate. See section 10.

## 10. The report gate

No change may be recorded in git until a report exists for exactly the staged change.

1. Run `pnpm verify`.
2. Run the `commit-report` skill. It writes `reports/<date>-<slug>.html`.
3. A `PreToolUse` hook compares the SHA-256 of the staged diff against
   `reports/.last-report-hash`. A mismatch blocks the action.

The report holds five sections, in this order:

| Section               | Content                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| What this change does | Plain language, one line per change                                                                          |
| Improvements          | What is better now                                                                                           |
| Fallbacks             | What was cut, deferred, stubbed or worked around                                                             |
| Things to consider    | Risk, follow-up, anything the user must decide                                                               |
| Evidence              | Test counts, the coverage table, the changed file list, mobile and desktop screenshots when a screen changed |

The report uses the same design tokens, so it is readable and familiar.

## 11. Files

```
.claude/
  rules/        architecture.md  testing.md  git.md  accessibility.md
  skills/       design-system/  commit-report/  add-screen/  db-migration/
  agents/       ui-reviewer.md  sync-auditor.md  test-writer.md
  hooks/        commit-gate.sh
  settings.json
.github/
  workflows/ci.yml  workflows/lighthouse.yml  pull_request_template.md
docs/
  specs/        the specification
  plan/         00-phase-0.md  01-phase-1.md  02-phase-2.md
  design/prototype/index.html   the visual contract
scripts/
  commit-report.ts
reports/                        generated, not in git
app/
  (auth)/sign-in/page.tsx
  (app)/page.tsx                 dashboard
  (app)/log/page.tsx
  (app)/workout/page.tsx         Phase 2
  (app)/analytics/page.tsx
  (app)/profile/page.tsx
  styleguide/page.tsx            development only
  ~offline/page.tsx
  layout.tsx  globals.css  manifest.ts
components/
  charts/      forms/      ui/      motion/      workout/
lib/
  design/tokens.ts     the token source for chart code
  db/dexie.ts          local schema
  db/repository.ts     the only API the screens use
  sync/worker.ts       drains the outbox
  sync/outbox.ts
  supabase/client.ts   server.ts   middleware.ts
  schema/*.ts          shared zod schemas
  duration.ts          parse and format mm.ss, h.mm.ss, 1:03:13
  csv/import.ts        Phase 2
  metrics/*.ts         streak, moving average, volume load, Epley
supabase/
  migrations/0001_phase1.sql
  migrations/0002_phase2.sql
tests/
  unit/    e2e/
```

Two helpers carry most of the risk. Write them test-first:

- `lib/duration.ts` — every format in the Excel sheet is a test case.
- `lib/sync/worker.ts` — test a failed push, a retry, and a duplicate push.

## 12. Verification

**Unit (Vitest)**

- `duration.ts` parses all 5 formats found in the sheet and rejects bad input.
- `metrics/streak.ts` handles a gap, a same-day double entry and a time zone edge.
- `metrics/epley.ts` and `volumeLoad.ts` match hand-calculated values.
- The CSV importer flags the ambiguous rows and only those.

**Integration (Vitest with fake-indexeddb)**

- A write with the network down lands in Dexie and in the outbox.
- The sync worker pushes the outbox once and clears it.
- A failed push keeps the row in the outbox and retries.
- A repeated push of the same UUID does not create a second Postgres row.

**End to end (Playwright)**

1. Sign in with email and password. The magic link is the fallback.
2. Record a day. Confirm the dashboard number changes.
3. Set the browser context offline. Record a second day. Confirm it appears.
4. Go online. Confirm the chip turns green and Supabase holds both rows.
5. Phase 2: start a session, add 3 sets, finish it, confirm the volume load.
6. Run a Lighthouse Progressive Web App audit. It must pass installability.

**By hand on a real iPhone**

- Open the deployed URL in Safari. Use Share, then Add to Home Screen.
- Open it from the home screen. Confirm it runs with no browser chrome.
- Sign in from the home screen app with the password. Confirm it opens the dashboard.
- Turn on flight mode. Record a set. Turn flight mode off. Confirm it syncs.
