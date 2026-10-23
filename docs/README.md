# Docs

What each document is for. There are no plan or progress files. Git history holds the
old phase plans.

| Path                          | What it is                                                                 |
| ----------------------------- | -------------------------------------------------------------------------- |
| `decisions.md`                | Settled decisions. Read before you change auth, data, tests or the design. |
| `architecture.md`             | How a save moves from a screen to Supabase. Diagram in `architecture/`.    |
| `features/product.md`         | The product: data model, design system, screens, charts.                   |
| `features/registration.md`    | Email and password sign-up.                                                |
| `features/feedback-fixes.md`  | The 17 owner feedback items after Phase 2.                                 |
| `features/coach-plans.md`     | Coach plans, the guided step, the muscle map, the video link.              |
| `features/saved-videos.md`    | The Saved tab for Instagram and YouTube links.                             |
| `data/`                       | Coach plan data, exercise photos and the body map. The app reads it.       |
| `design/prototype/index.html` | The visual contract. The website uses it as the live demo.                 |

## Rules

- One file per feature in `features/`, named for the feature, with no date in the name.
  The `new-feature` skill writes it.
- A decision that a future change must not reopen goes in `decisions.md`.
- Never add a plan or progress file. Track work in the feature file and in git.
