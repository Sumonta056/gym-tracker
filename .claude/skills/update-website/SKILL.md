---
name: update-website
description:
  Update the GitHub Pages website (`site/`), its screenshots and `README.md` after a user-visible change ships. Use when asked to "update the
  website", "update the README", "refresh screenshots", or "the site is out of date";
  after any user-visible `feat` commit under `app/` or `components/`; and when the CI
  step "The website shows every new feature" (`pnpm site:check`) fails.
---

# Update the website and README

The website lives in `site/` and deploys to `https://sumonta056.github.io/gym-tracker/`
through `.github/workflows/pages.yml`, after the `CI` workflow passes on a push to `main`.
`pnpm site:build` writes `_site/`: a copy of `site/`, checked by the coach image guard. There
is no live demo. The screenshots come from the real app through `pnpm site:shots`.

**Before you start:** the feature must be built. `pnpm site:shots` captures the current
`.next` build, so uncommitted or unbuilt code does not show. Plan the edits and get approval
before you change files. Never commit without being asked.

## 1. Find what changed

- `git log --oneline $(git log -1 --format=%H -- site README.md)..HEAD` lists the commits
  since the last website update.
- `pnpm site:check --range <that commit>..HEAD` names every `feat` under `app/` or
  `components/` the website does not show yet.
- Read the feature file in `docs/features/` for each one.
- Keep only what a user sees. Tests, refactors, sync internals and CI stay out.

## 2. Map each change to the places it shows

**The rule: every feature block shows a phone (390) and a laptop (1440) screenshot**, each in
its frame with a short caption. No block ships with only one of them.

| Area changed                  | Website block in `site/index.html`             | Screenshots                                                                                | `README.md` section                   |
| ----------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------- |
| Today                         | `#f-today`, hero                               | `today-390.png`, `today-1440.png`                                                          | Features › Today                      |
| The day control, date picker  | `#f-day`                                       | `day-picker-390.png`, `day-picker-1440.png`                                                | Features › Day view and date picker   |
| Log the day, duration picker  | `#f-log`                                       | `log-390.png`, `log-1440.png`                                                              | Features › Log the day                |
| Stats, a chart, the edit mode | `#f-stats`                                     | `analytics-390.png`, `analytics-1440.png`                                                  | Features › Stats and charts           |
| Live workout                  | `#f-workout`                                   | `workout-live-390.png`, `workout-live-1440.png`                                            | Features › Live workout               |
| Coach plans, the guided step  | `#f-plans`                                     | `plan-step-390.png`, `plan-step-1440.png`                                                  | Features › Coach plans                |
| Muscle map                    | `#f-muscles`                                   | `plan-muscles-390.png`, `plan-muscles-1440.png`                                            | Features › Muscle map                 |
| Session done                  | `#f-done`                                      | `plan-done-390.png`, `plan-done-1440.png`                                                  | Features › Session done               |
| Saved videos                  | `#f-saved`                                     | `saved-390.png`, `saved-1440.png`                                                          | Features › Saved videos               |
| CSV import and export         | `#f-import`                                    | `import-390.png`, `import-1440.png`                                                        | Features › CSV import                 |
| Profile, goals, sync state    | `#f-profile`                                   | `profile-390.png`, `profile-1440.png`                                                      | Features › Profile and goals          |
| Offline sync                  | `#f-offline`, `#sync` (CSS explainer, no shot) | —                                                                                          | Features › Offline sync, How it works |
| Install, sign-up              | `#install` (device tabs, What you get)         | —                                                                                          | Install the app                       |
| New route                     | a new `.wrap.feature` block; alternate `flip`  | 2 new entries in `SHOTS` in `scripts/site-screenshots.mjs`: `<name>-390` and `<name>-1440` | a new Features subsection             |
| New field on a screen         | the matching block's list                      | retake both shots of that screen                                                           | the matching subsection               |
| New field the sample lacks    | —                                              | extend `scripts/site-sample-data.mjs`                                                      | —                                     |
| A phase or a feature closes   | —                                              | —                                                                                          | Changelog, newest first               |

## 3. Take the screenshots

```sh
pnpm site:shots --build                         # every shot, after a fresh build
pnpm site:shots --only today-390,saved-1440     # only these, on the current build
```

- It needs `E2E_EMAIL` and `E2E_PASSWORD` in `.env.test.local` and the Supabase keys in
  `.env.local`. It uses port 3100: never run it while another `pnpm e2e` or `next start`
  runs.
- The rules it enforces: every Supabase write is blocked, the sample rows go into this
  browser's IndexedDB only, every exercise image comes from `docs/data/fedb-images/`, and
  the account email becomes `you@example.com`. Never loosen one of them.
- Read every new PNG. It must show the change, with no half-loaded image and no spinner.
  1440 shots are 1800 × 1125, 390 shots 780 × 1688.

## 4. Write the text

- The website and the README use the same words for the same thing. Sentence case, plain
  verbs, short sentences.
- Each feature block: one `<h3>`, one plain sentence, "You can:" and at most 4 list items
  that start with a verb, then the phone shot and the laptop shot, each with a short
  `<figcaption>`. The phone shot comes first under 1024 px; from 1024 px the 2 sit side by
  side, and a `flip` block swaps their order.
- Every image but the 2 hero images has `loading="lazy"`.
- Every new image gets a real `alt` that says what the picture shows, and the `width` and
  `height` of the file.
- README: "You can:" and the bullets go under the matching Features subsection, then the
  phone shot as `<img … width="300">` in a centred `<p>`, then the laptop shot.
- When the product itself changes, update `<meta name="description">`, `og:description`,
  `twitter:description` and the JSON-LD `description` and `screenshot` in `site/index.html`.
- Keep the hero stickers (`.stickers` in `site/index.html`) and the "Built with care" strip true. A new fact gets a short sticker tag; place it with `--x` and `--y` so it keeps at least 50 px from the title, the paragraph and the buttons at 1400 and 1920 px. Re-count when a chart card
  (`components/charts/statsCards.ts`), a seeded exercise (`supabase/migrations/`), a body
  region (`docs/data/body-polygons.json`) or the test count changes. Test counts round down
  to the nearest 10 with a "+".
- Keep the `FAQPage` JSON-LD word for word in step with the visible `#faq`, and set the
  `lastmod` in `site/sitemap.xml` to the day of any content change.

## 5. Build and check

```sh
pnpm site:build
python3 -I -m http.server 8811 --directory _site
```

With Chrome DevTools MCP, in your own tab, closed at the end:

1. Open `http://127.0.0.1:8811/` at 390, 768, 1024, 1280 and 1440 px. No sideways scroll,
   every image loads, the hero text is centred over the buttons, every install tab opens
   its own steps.
2. `lighthouse_audit` on the home page: Accessibility 100 and SEO 100.

Then:

```sh
pnpm exec prettier --write site README.md
pnpm format:check
```

Stop the server when you are done.

`pnpm site:check` reads commits only. It passes once this update is committed in the same
push as the features.

## 6. The licence rule

The coach photos in `docs/data/coach-images/` and `public/exercises/` have an unknown
source. Never publish one: not in `site/`, not in a screenshot, not in the README. The guard
in `scripts/build-site.mjs` fails the build when one reaches `_site/`. Never weaken the
guard and never add an exception to it. Use `docs/data/fedb-images/` instead.

## 7. Commit

Ask first. The commit goes through the project gate: run the `commit-report` skill, which
needs a report for exactly the staged change.

| Change                      | Commit                  |
| --------------------------- | ----------------------- |
| Text, screenshots, README   | `docs(docs): <subject>` |
| `pages.yml` or the CI check | `ci(ci): <subject>`     |

Scopes come from `.claude/rules/git.md`; `site` is not one. The commit body carries no
`Site-update: none` line: this commit is the site update.

## Done when

- Every `feat` that `pnpm site:check` named is on the website and in the README.
- `pnpm site:build` passes its image guard.
- Every feature block shows a phone and a laptop shot.
- The site reads cleanly at 390, 768, 1024, 1280 and 1440 px, and Lighthouse scores 100 for
  Accessibility and SEO.
- `pnpm format:check` passes.
- The owner has the commit command and has not been committed for.
