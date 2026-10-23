<p align="center">
  <img src="public/icon-192.png" width="96" height="96" alt="Gym Tracker icon">
</p>

<h1 align="center">Gym Tracker</h1>

<p align="center">
  <b>Your gym log, even with no signal.</b><br>
  A mobile-first gym log that installs like an app. Use it on your phone in the gym and on the web at your desk, even with no signal.
</p>

<p align="center">
  <img alt="Next.js 15" src="https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white">
  <img alt="TypeScript strict" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white">
  <img alt="PWA, offline first" src="https://img.shields.io/badge/PWA-offline%20first-5A0FC8?logo=pwa&logoColor=white">
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3FCF8E?logo=supabase&logoColor=white">
  <a href="https://github.com/Sumonta056/gym-tracker/issues"><img alt="Issues" src="https://img.shields.io/github/issues/Sumonta056/gym-tracker"></a>
</p>

<p align="center">
  <a href="https://gym-tracker-ten-gamma.vercel.app/"><b>Try it out</b></a> ·
  <a href="https://sumonta056.github.io/gym-tracker/"><b>Website</b></a> ·
  <a href="#install-the-app"><b>Install the app</b></a>
</p>

<p align="center">
  <img src="site/screenshots/today-1440.png" alt="The Today screen on a laptop: a sidebar on the left, the gym time hero card, the streak and the stat cards of the day" width="100%">
</p>

---

## Contents

- [Why Gym Tracker](#why-gym-tracker)
- [Features](#features)
- [Install the app](#install-the-app)
- [Quick start for developers](#quick-start-for-developers)
- [How it works](#how-it-works)
- [Tests](#tests)
- [Website](#website)
- [Changelog](#changelog)

## Why Gym Tracker

The gym log lived in an Excel sheet. A sheet is hard to fill in on a phone, between sets, in a basement with no signal. Gym Tracker fixes that:

- **It replaces the spreadsheet.** The 8 columns of the old sheet are one form, and the CSV import brings the old rows with you.
- **It works with no network in the gym.** Every save lands on the phone first. The outbox pushes it when the network comes back.
- **It installs like an app, on phone and web.** No app store. Add it to the Home Screen of an iPhone or Android phone, or install it from Chrome, Edge or Safari on a laptop. It opens full screen in its own window.
- **Each account sees only its own rows.** Registration is open. Every table on the server has a rule: a row is visible only to the account that owns it.

## Features

### Today

See your whole day on one screen: gym time, streak and every number against its goal.

You can:

- See gym time from your finished sessions, or type your own.
- Track steps, calories, weight and walk time against your goals.
- Read your heart rate zones with their bpm ranges.
- Check the week totals: sessions, gym minutes, calories, steps.

<p align="center">
  <img src="site/screenshots/today-390.png" alt="Today on an iPhone: the gym time hero card, the streak and the stat cards" width="300">
</p>

![Today on a laptop: the sidebar, the gym time hero card and the stat cards in 3 columns](site/screenshots/today-1440.png)

### Day view and date picker

Open any earlier day and see it as it was.

You can:

- Step back and forward one day with the arrows.
- Jump to any date with the date picker.
- Open a day from the streak heat map.
- Fix a day you logged wrong.

<p align="center">
  <img src="site/screenshots/day-picker-390.png" alt="An earlier day open on an iPhone, with the date control and its arrows in the top bar" width="300">
</p>

![An earlier day open on a laptop, with the date control in the top bar](site/screenshots/day-picker-1440.png)

### Log the day

Fill in the 8 columns of the old spreadsheet in one form, with no keyboard for times.

You can:

- Set walk, gym and swim time with preset chips and −15 s / +15 s.
- Enter heart rate, weight, calories and steps.
- Add a note to the day.
- See a Saved message after every save.

<p align="center">
  <img src="site/screenshots/log-390.png" alt="The daily log form on an iPhone with the duration chips" width="300">
</p>

![The daily log form on a laptop: training, heart, body and activity cards](site/screenshots/log-1440.png)

### Stats and charts

Day, Week and Month charts that show whether you are getting stronger, including the volume and one-rep max trends you need for progressive overload.

You can:

- Follow your weight with a 7-day average line.
- See volume load, one-rep max and personal records.
- Compare muscle groups and the gaps between sessions.
- Reorder and hide the chart cards.

<p align="center">
  <img src="site/screenshots/analytics-390.png" alt="Stats on an iPhone with the Day, Week and Month tabs" width="300">
</p>

![Stats on a laptop: weight, calories, steps and heart rate charts in 2 columns](site/screenshots/analytics-1440.png)

### Live workout

Track sets and reps as you lift, with a session timer and a rest countdown.

You can:

- Pick an exercise by search, muscle or your recent list.
- Log reps and weight per set, and untick with undo.
- Rest with a countdown timer.
- See the volume add up while you train.

<p align="center">
  <img src="site/screenshots/workout-live-390.png" alt="A live workout on an iPhone: the timer, set rows and the rest timer" width="300">
</p>

![A live workout on a laptop: the set rows and the running volume](site/screenshots/workout-live-1440.png)

### Coach plans

Follow a coach plan one exercise at a time.

You can:

- Let the app suggest the plan you did least recently.
- Join 2 plans on a day you missed.
- See start and end photos, the how-to and a YouTube tutorial link.
- Go Next, Back or Skip at your own pace.

<p align="center">
  <img src="site/screenshots/plan-step-390.png" alt="A guided plan step on an iPhone: the exercise photo, the target and the set rows" width="300">
</p>

![A guided plan step on a laptop: the step list on the left, the photo and the set rows](site/screenshots/plan-step-1440.png)

### Muscle map

See which muscles an exercise works before you lift.

You can:

- See the main muscles and the helpers on a front and back body map.
- Read the muscle names as chips under the map.
- Switch between How to and Muscles on the step photo.

<p align="center">
  <img src="site/screenshots/plan-muscles-390.png" alt="The muscle map of a plan step on an iPhone, front and back" width="300">
</p>

![The muscle map of a plan step on a laptop](site/screenshots/plan-muscles-1440.png)

### Session done

Finish a plan and see what you did.

You can:

- See gym time, volume and sets for the session.
- See each step as done, skipped or not done.
- Spot your new records.
- Go back to Workouts in one tap.

<p align="center">
  <img src="site/screenshots/plan-done-390.png" alt="The session done screen on an iPhone: gym time, volume, new records and the steps" width="300">
</p>

![The session done screen on a laptop](site/screenshots/plan-done-1440.png)

### Saved videos

Keep the Instagram Reels and YouTube videos you want to try, in your own categories.

You can:

- Save a link with a title, a category, tags and a priority.
- See the high priority videos first.
- Filter by category and search titles and tags.
- Tap a card to open the video in its own app.

<p align="center">
  <img src="site/screenshots/saved-390.png" alt="Saved videos on an iPhone with category chips and priority badges" width="300">
</p>

![Saved videos on a laptop: category chips, a search box and a grid of cards](site/screenshots/saved-1440.png)

### CSV import

Bring your old spreadsheet with you, from Profile › Import the old sheet, when the import is turned on for the app.

You can:

- Import times written as 15.54, 1:03:13 or 01.44.50.
- Fix every unclear row on a review screen before anything is saved.
- Export every table as CSV in one zip.

The import shows in Profile only when the build sets `NEXT_PUBLIC_ENABLE_CSV_IMPORT=1`.

<p align="center">
  <img src="site/screenshots/import-390.png" alt="The CSV import review on an iPhone with the unclear rows flagged" width="300">
</p>

![The CSV import review on a laptop](site/screenshots/import-1440.png)

### Profile and goals

Set your goals once and every chart and card uses them.

You can:

- Set goals for steps, calories, gym time, walk time, sessions per week and weight.
- Give your birth year for the heart rate zones.
- See the sync state and the error list.
- Sign out safely: unsynced saves are pushed first.

<p align="center">
  <img src="site/screenshots/profile-390.png" alt="Profile on an iPhone: goals, the sync state and sign out" width="300">
</p>

![Profile on a laptop with the goals and the sync state](site/screenshots/profile-1440.png)

### Offline sync

Every save lands on your device first, so the app never waits for the network.

You can:

- Log in flight mode, in a basement gym, anywhere.
- See where your data is from the chip on every data screen.
- Trust that a retry never makes a duplicate row.

How it works is under [How it works](#how-it-works).

## Install the app

The app is free, with open registration: **<https://gym-tracker-ten-gamma.vercel.app/>**. No app store and no download. On every device, start the same way:

1. Open <https://gym-tracker-ten-gamma.vercel.app/>.
2. Tap **Create an account** and enter your name, email and a password of 8 or more characters. Or sign in if you have one.

Then add it to your device:

**iPhone and iPad** (use Safari; other browsers on iPhone and iPad cannot add an app to the Home Screen)

3. Tap **Share**, the square with an arrow. On iPhone it is in the bottom bar, on iPad at the top right.
4. Scroll the share sheet and tap **Add to Home Screen**.
5. Tap **Add**.

**Android** (use Chrome)

3. Tap **⋮**, the 3 dots at the top right.
4. Tap **Install app**. On some phones it says **Add to Home screen**.
5. Tap **Install**.

**Laptop: Chrome or Edge** (Windows, macOS, Linux or ChromeOS)

3. Click the **install icon** at the right end of the address bar, a small screen with a down arrow.
4. Or use the menu. In Chrome: **⋮** → **Cast, save and share** → **Install Gym Tracker**. In Edge: **…** → **Apps** → **Install Gym Tracker**.
5. Click **Install**.

**Mac: Safari** (Safari 17 or newer, macOS Sonoma or later)

3. In the menu bar, click **File**.
4. Click **Add to Dock**.
5. Click **Add**.

**What you get**

- **Opens full screen.** Its own icon and its own window, like any app. No browser bar.
- **Works with no signal.** Log in the gym with no network. Every save stays on your device.
- **Syncs when back online.** The saves go up by themselves when the network comes back.
- **One account, every device.** Sign in on your phone and your laptop and see the same data.

## Quick start for developers

Needs Node 24 (the exact version is in `.nvmrc`, `24.21.0`) and pnpm 10, and a Supabase project.

```sh
git clone https://github.com/Sumonta056/gym-tracker.git
cd gym-tracker
pnpm install
cp .env.example .env.local
pnpm dev
```

Fill in `.env.local`:

| Variable                        | What it is                                                   |
| ------------------------------- | ------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Your Supabase project URL. Required.                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key. Required.                            |
| `SUPABASE_PROJECT_ID`           | Your project id. `pnpm types:db` needs it to generate types. |
| `SUPABASE_DB_URL`               | Not read by the app or any script today. Leave it empty.     |

Two optional flags: `NEXT_PUBLIC_ENABLE_CSV_IMPORT=1` shows the CSV import in Profile, and `NEXT_PUBLIC_ENABLE_STYLEGUIDE=1` turns on the `/styleguide` route.

The database schema is in `supabase/migrations/`. The signed-in end-to-end tests use a test account: put `E2E_EMAIL` and `E2E_PASSWORD` in `.env.test.local`.

## How it works

Gym Tracker is offline first. No screen talks to the server. Every save goes to a database inside the browser and returns at once; a sync worker pushes it later.

```
screen → lib/db/repository.ts → Dexie (IndexedDB) + outbox → lib/sync/worker.ts → Supabase
```

- **The repository writes to Dexie and returns at once.** The row and its outbox entry share one transaction: never one without the other.
- **Only `lib/sync/worker.ts` talks to Supabase.** It drains the outbox when the app starts, when the network comes back, and every 30 seconds while online. ESLint stops any screen from importing Supabase.
- **The client makes every `id` as a UUID**, before the write. An offline save keeps its identity when it syncs, so a retry never makes a duplicate row.
- **A delete is a mark, not a removal.** It sets `deleted_at`, so it syncs too.
- **Every table has a Row Level Security policy** of `user_id = auth.uid()`. Each account sees only its own rows.
- **Durations are whole seconds and weight is metric** in storage. `lib/duration.ts` owns every parse and format.

```
app/                   Next.js App Router routes
  (app)/               Signed-in screens: Today, log, analytics, workout(s), saved, profile
  (auth)/              Sign in and sign up
  styleguide/          Every primitive, checked against the prototype
  sw.ts                The service worker (Serwist)
components/            Screens and primitives, one folder per area (ui, charts, plans, saved …)
lib/
  db/                  Dexie schema and the repository: the only data door for a screen
  sync/                The outbox and the sync worker: the only code that calls Supabase
  schema/              One zod schema per entity, shared by forms, the outbox and the import
  metrics/             Every derived number: streak, volume, records, plan suggestion
  csv/                 The sheet import and the zip export
  duration.ts          Every duration parse and format
supabase/migrations/   The SQL schema with its Row Level Security policies
public/                Icons and the exercise images, precached for the gym
tests/e2e/             Playwright specs
docs/                  Specs, phase plans, the design prototype and the source data
scripts/               The design check, the test rule, the commit report and the website build
site/                  Website and screenshots (deployed to GitHub Pages)
```

The full rules, with the allowed and forbidden imports: [`.claude/rules/architecture.md`](.claude/rules/architecture.md).

## Tests

Vitest for units, Playwright for the browser, on 3 projects: iPhone 14, Pixel 7 and desktop 1440.

```sh
pnpm static     # format, lint, typecheck, the design check and the test rule
pnpm test:cov   # unit tests with the coverage floors
pnpm e2e        # the end-to-end suite; axe must report no serious or critical issue
pnpm verify     # all of the above, plus the production build
```

Every source file under `lib/`, `components/` and `app/` has a test beside it; `pnpm test:required` fails when one is missing. The coverage floors fail the run:

| Path              | Lines | Branches | Functions |
| ----------------- | ----- | -------- | --------- |
| `lib/duration.ts` | 100   | 100      | 100       |
| `lib/metrics/**`  | 100   | 95       | 100       |
| `lib/sync/**`     | 95    | 90       | 95        |
| `lib/**` (rest)   | 85    | 75       | 85        |
| `components/**`   | 85    | 75       | 85        |
| `app/**`          | 85    | 75       | 85        |

Full detail: [`.claude/rules/testing.md`](.claude/rules/testing.md).

## Website

The website lives in `site/` and deploys to <https://sumonta056.github.io/gym-tracker/>.

- **`pnpm site:build`** copies `site/` to `_site/` and fails if a private coach photo reaches the output.
- **`pnpm site:shots`** captures `site/screenshots/` from the real app. It signs in the test account, blocks every Supabase write, and writes 1440 px shots at 1800 px wide and 390 px shots at 780 px wide. `--only today-390,saved-1440` takes a few; `--build` builds the app first.
- **`pnpm site:check`** fails when a `feat` commit under `app/` or `components/` lands with no change to `site/` or `README.md`. A feat with nothing to show adds `Site-update: none` to its commit body. CI runs it on every push to `main`.
- **`.github/workflows/pages.yml`** builds and deploys `_site/` after the `CI` workflow passes on a push to `main`.

**The image licence rule.** The coach photos in `docs/data/coach-images/` and `public/exercises/` have an unknown source. They never reach the website. The screenshots use the public domain photos of Free Exercise DB in `docs/data/fedb-images/` instead, and the build fails if a coach image reaches `_site/`.

## Changelog

- **Phase 4: saved videos** (2026-10-23)
  - A Saved tab for the Instagram Reels and YouTube videos you find, by your own categories.
  - A title, tags and a priority per video; search, filter, edit, and delete with undo.
  - Profile moves to an avatar in the header.
- **Phase 3: coach plans** (2026-10-21)
  - 4 coach plans, 26 exercises, one guided step per screen with start and end photos and a muscle map.
  - A tutorial link on YouTube for every exercise; the plan you did least recently is suggested.
  - Join 2 plans on a day you missed; a Done screen with steps, sets, volume and new records.
  - The step images are cached for the gym, so a plan works offline.
- **The day view** (2026-10-19)
  - The Today screen reads any day, with a date control in the top bar.
- **Owner feedback fixes** (2026-10-16)
  - A Reload screen instead of a blank page, and an error list in Profile.
  - A duration picker, gym time from your sessions, old days in the log and a swim time.
  - A summary when a session ends, and a session history.
  - Goals in Profile with goal lines on the charts; heart rate zones with bpm ranges.
  - Reorder and hide the Stats cards.
- **Email registration** (2026-10-04)
  - Open registration: create an account with a name, email and password.
- **Phase 2: live workout and CSV import** (2026-10-04)
  - Log a session set by set, with a rest timer, set edit and undo.
  - Volume, one-rep max, records, muscle balance and gap charts.
  - Import the old sheet with a review screen; export every table as CSV in one zip.
- **Phase 1: daily tracker** (2026-09-25)
  - Log the day; the Today dashboard; the analytics charts; Profile with a clean sign-out.
  - Offline first: saves land on the device and sync when online.
  - Installs on an iPhone; a sidebar layout on a laptop.
- **Phase 0: foundation** (2026-09-20)
  - The toolchain, the design system, the design prototype and the commit gate.
