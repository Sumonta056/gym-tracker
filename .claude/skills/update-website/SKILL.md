---
name: update-website
description: Update the GitHub Pages website (`site/`), its live demo links, its screenshots
  and `README.md` after a user-visible change ships. Use when asked to "update the
  website", "update the README", "refresh screenshots", or "the site is out of date";
  after any user-visible `feat` commit under `app/` or `components/`; and when the CI
  step "The website shows every new feature" (`pnpm site:check`) fails.
---

# Update the website and README

The website lives in `site/` and deploys to `https://sumonta056.github.io/gym-tracker/`
through `.github/workflows/pages.yml`, after the `CI` workflow passes on a push to `main`.
`pnpm site:build` writes `_site/`: a copy of `site/`, plus the design prototype
`docs/design/prototype/index.html` as the live demo in `_site/demo/`. The screenshots come
from the real app through `pnpm site:shots`.

**Before you start:** the feature must be built. `pnpm site:shots` captures the current
`.next` build, so uncommitted or unbuilt code does not show. Plan the edits and get approval
before you change files. Never commit without being asked.

## 1. Find what changed

- `git log --oneline $(git log -1 --format=%H -- site README.md)..HEAD` lists the commits
  since the last website update.
- `pnpm site:check --range <that commit>..HEAD` names every `feat` under `app/` or
  `components/` the website does not show yet.
- Read the spec in `docs/specs/` and the step lines in `PROGRESS.md` for each one.
- Keep only what a user sees. Tests, refactors, sync internals and CI stay out.

## 2. Map each change to the places it shows

| Area changed                  | Website block in `site/index.html`                               | Screenshot(s)                                              | `README.md` section                   | Demo plate (`data-plate`) |
| ----------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------- | ------------------------- |
| Today, the day control        | feature `<h3>Today</h3>`, hero                                   | `today-1440.png`, `today-390.png`                          | Features › Today                      | `p1`                      |
| Log days, the duration picker | feature `<h3>Log days</h3>`                                      | `log-1440.png`                                             | Features › Log days                   | `p2`                      |
| Stats, a chart, the edit mode | feature `<h3>Stats and charts</h3>`                              | `analytics-1440.png`, `analytics-390.png`                  | Features › Stats and charts           | `p5`                      |
| Live workout, history         | feature `<h3>Live workout</h3>`                                  | `workouts-1440.png`                                        | Features › Live workout               | `p3`                      |
| Coach plans, muscle map       | feature `<h3>Coach plans and muscle map</h3>`                    | `plan-step-1440.png`, `plan-step-390.png`                  | Features › Coach plans and muscle map | `p18`, `pl-guided`        |
| Saved videos                  | feature `<h3>Saved videos</h3>`                                  | `saved-1440.png`, `saved-390.png`                          | Features › Saved videos               | `p20`                     |
| CSV import, export, Profile   | feature `<h3>CSV import</h3>`                                    | `profile-390.png`                                          | Features › CSV import                 | `p10`                     |
| Offline sync                  | feature `<h3>Offline sync</h3>`, `#sync`                         | —                                                          | Features › Offline sync, How it works | —                         |
| Install, sign-up              | feature `<h3>Install on iPhone</h3>`, `#install`                 | —                                                          | Install                               | —                         |
| New route                     | a new `.wrap.feature` block; alternate `flip` with its neighbour | a new entry in `SHOTS` in `scripts/site-screenshots.mjs`   | a new Features subsection             | the route's plate         |
| New field on a screen         | the matching block's list                                        | retake that screen's shots                                 | the matching subsection               | —                         |
| New field the sample lacks    | —                                                                | extend `scripts/site-sample-data.mjs` so the shot shows it | —                                     | —                         |
| New prototype plate           | a `data-plate` link or a button in `#demo .tries`                | —                                                          | —                                     | the new plate id          |
| A phase or a feature closes   | —                                                                | —                                                          | Changelog, newest first               | —                         |

The demo jumps work like this: `site/site.js` reads `data-plate` on any element, scrolls
the demo frame to the element with that id in the prototype, and switches to the laptop
view when the id starts with `pl-`. The id must exist as `<span class="name" id="…">` in
`docs/design/prototype/index.html`.

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
- Each feature block: one `<h3>`, one or two sentences, at most 4 list items, then the
  "Try it in the demo →" link.
- Every new image gets a real `alt` that says what the picture shows, and the `width` and
  `height` of the file.
- README: the bullets go under the matching Features subsection, its screenshot after it.
  A phone shot is `<img … width="300">` in a centred `<p>`.
- When the product itself changes, update `<meta name="description">`, `og:description`,
  `twitter:description` and the JSON-LD `description` and `screenshot` in `site/index.html`.

## 5. Build and check

```sh
pnpm site:build
python3 -I -m http.server 8811 --directory _site
```

With Chrome DevTools MCP, in your own tab, closed at the end:

1. Open `http://127.0.0.1:8811/` at 390, 768 and 1440 px. No sideways scroll, every image
   loads, every "Try it in the demo →" jumps to its plate.
2. Open `http://127.0.0.1:8811/demo/`. The prototype loads with its photos.
3. `lighthouse_audit` on the home page: Accessibility 100 and SEO 100.

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
- The site reads cleanly at 390, 768 and 1440 px, and Lighthouse scores 100 for
  Accessibility and SEO.
- `pnpm format:check` passes.
- The owner has the commit command and has not been committed for.
