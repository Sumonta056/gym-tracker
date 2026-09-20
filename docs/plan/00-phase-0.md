# Phase 0 — Foundation

Goal: a repository where every later step is fast, safe and consistent.
Nothing in this phase ships a feature. Everything in this phase stops a mistake.

Exit condition: `pnpm verify` passes, the commit gate blocks a commit with no report,
and the style guide route renders every design token.

---

## 0.1 Scaffold and pin the toolchain

**Do**

1. Pin Node 25 in `.nvmrc` and in `package.json` `engines`.
2. Use pnpm. Pin it in `packageManager`.
3. Scaffold:
   ```
   pnpm create next-app@latest . --ts --app --tailwind --eslint --no-src-dir --import-alias "@/*"
   ```
4. Delete the scaffold demo content in `app/page.tsx` and `app/globals.css`.
5. Write `.gitignore` additions: `reports/`, `.env*.local`, `playwright-report/`,
   `coverage/`, `test-results/`.
6. Write `.env.example` with `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

**Files** `.nvmrc`, `package.json`, `.gitignore`, `.env.example`

**Done when** `pnpm dev` serves an empty page with no console error.

---

## 0.2 TypeScript, ESLint and Prettier

**Do**

1. `tsconfig.json`: set `strict: true`, `noUncheckedIndexedAccess: true`,
   `noImplicitOverride: true`, `verbatimModuleSyntax: true`.
2. Install ESLint 9 flat config with these plugins:
   `@typescript-eslint` (strict-type-checked), `eslint-config-next`,
   `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, `@vitest/eslint-plugin`.
3. Add these project rules in `eslint.config.mjs`:
   - `import/order` with groups and alphabetical order.
   - `@typescript-eslint/no-floating-promises` error.
   - `@typescript-eslint/consistent-type-imports` error.
   - `jsx-a11y/no-static-element-interactions` error.
   - A `no-restricted-imports` rule: no file under `app/` or `components/` may
     import `@/lib/supabase/*`. Only `lib/sync/*` may import it. This enforces
     architecture rule 1.
4. Install Prettier 3 with `prettier-plugin-tailwindcss`. Write `.prettierrc`:
   ```json
   {
     "semi": false,
     "singleQuote": true,
     "printWidth": 100,
     "trailingComma": "all",
     "plugins": ["prettier-plugin-tailwindcss"]
   }
   ```
5. Write `.prettierignore`: `pnpm-lock.yaml`, `coverage`, `.next`, `reports`,
   `docs/design/prototype`.
6. Add scripts:
   ```json
   {
     "lint": "eslint .",
     "lint:fix": "eslint . --fix",
     "format": "prettier --write .",
     "format:check": "prettier --check .",
     "typecheck": "tsc --noEmit"
   }
   ```

**Done when** `pnpm lint && pnpm format:check && pnpm typecheck` all pass.

---

## 0.3 Husky, lint-staged and commitlint

**Do**

1. `pnpm add -D husky lint-staged @commitlint/cli @commitlint/config-conventional`
2. `pnpm exec husky init`
3. `lint-staged.config.mjs`:
   ```js
   export default {
     '*.{ts,tsx}': ['eslint --fix --max-warnings=0', 'prettier --write'],
     '*.{json,md,css}': ['prettier --write'],
   }
   ```
4. `.husky/pre-commit`:
   ```sh
   pnpm exec lint-staged
   pnpm typecheck
   pnpm vitest related --run --passWithNoTests $(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' | tr '\n' ' ')
   ```
5. `.husky/commit-msg`: `pnpm exec commitlint --edit $1`
6. `.husky/pre-push`: `pnpm verify`
7. `commitlint.config.mjs`: extend `config-conventional`. Add this scope list:
   `setup`, `db`, `sync`, `ui`, `design`, `charts`, `pwa`, `auth`, `csv`, `test`,
   `docs`, `ci`. Set `scope-enum` to that list and `scope-empty` to never.

**Test by hand**

- `git commit -m "bad message"` fails.
- `git commit -m "feat(ui): add the tab bar"` passes the message check.

**Done when** both checks above behave as written.

---

## 0.4 The Vitest harness

**Do**

1. `pnpm add -D vitest @vitest/coverage-v8 jsdom @testing-library/react
@testing-library/user-event @testing-library/jest-dom fake-indexeddb`
2. `vitest.config.ts` with two projects:
   - `unit`: environment `node`, includes `lib/**/*.test.ts`.
   - `ui`: environment `jsdom`, includes `components/**/*.test.tsx` and
     `app/**/*.test.tsx`, setup file `tests/setup.ui.ts`.
3. `tests/setup.ui.ts`: import `@testing-library/jest-dom/vitest`, import
   `fake-indexeddb/auto`, and reset the Dexie database between tests.
4. Coverage thresholds. Fail the run below these numbers:
   | Path              | Lines | Branches | Functions |
   | ----------------- | ----- | -------- | --------- |
   | `lib/duration.ts` | 100   | 100      | 100       |
   | `lib/metrics/**`  | 100   | 95       | 100       |
   | `lib/sync/**`     | 95    | 90       | 95        |
   | `lib/**` (rest)   | 85    | 75       | 85        |
5. Add scripts: `"test": "vitest run"`, `"test:watch": "vitest"`,
   `"test:cov": "vitest run --coverage"`.
6. Write one smoke test so the harness proves itself.

**Done when** `pnpm test:cov` passes and writes `coverage/coverage-summary.json`.

---

## 0.5 The Playwright harness

**Do**

1. `pnpm add -D @playwright/test` then `pnpm exec playwright install chromium webkit`
2. `playwright.config.ts` with three projects:
   - `mobile-safari`: device `iPhone 14`, the main target.
   - `mobile-chrome`: device `Pixel 7`.
   - `desktop`: Chromium at 1440 x 900, the laptop target.
3. Set `webServer` to `pnpm build && pnpm start` so tests run the real build.
4. Write `tests/e2e/smoke.spec.ts`: load `/`, expect no console error, and take a
   screenshot on all three projects.
5. Add scripts: `"e2e": "playwright test"`, `"e2e:ui": "playwright test --ui"`.

**Done when** `pnpm e2e` passes on all three projects.

---

## 0.6 Continuous integration and the pull request template

**Do**

1. `.github/workflows/ci.yml`. One job, on push and on pull request:
   ```
   setup pnpm + node 25 + cache
   pnpm install --frozen-lockfile
   pnpm format:check
   pnpm lint
   pnpm typecheck
   pnpm test:cov
   pnpm build
   pnpm e2e
   upload coverage/ and playwright-report/ as artifacts
   ```
2. `.github/workflows/lighthouse.yml`: run Lighthouse CI on the built app.
   Fail if the Progressive Web App installability audit fails, or if the
   accessibility score drops below 95.
3. `.github/pull_request_template.md` with these sections:
   What changed · Why · Screens touched (mobile and desktop screenshots) ·
   Tests added · Link to the commit report · Risks.

**Done when** CI is green on the first push.

---

## 0.7 The Claude workspace

This is the part that keeps every later session consistent.

### 0.7.1 `CLAUDE.md` (root)

Short. It points at everything else. It holds only the rules that must never be
missed: the architecture rules, the commit gate, and the link to the design skill.

### 0.7.2 `.claude/rules/`

One file per topic. Each file is short and testable.

| File               | Content                                                                          |
| ------------------ | -------------------------------------------------------------------------------- |
| `architecture.md`  | The repository rule, the UUID rule, the soft delete rule, the seconds rule       |
| `testing.md`       | Test first for `lib/duration.ts` and `lib/sync/**`. Coverage thresholds. Naming. |
| `git.md`           | Conventional commits, the scope list, the commit gate, branch naming             |
| `accessibility.md` | 44 px targets, real `button` and `a`, labels, 4.5:1 contrast                     |

### 0.7.3 `.claude/skills/`

| Skill           | Purpose                                                                     |
| --------------- | --------------------------------------------------------------------------- |
| `design-system` | **The most important one.** See section 0.9. Any page work loads it first.  |
| `commit-report` | Builds `reports/*.html` and unlocks the commit gate. See 0.8.               |
| `add-screen`    | Scaffolds a route, its test, its responsive shell and its style guide entry |
| `db-migration`  | Writes a paired Supabase SQL migration and a Dexie version bump together    |

### 0.7.4 `.claude/agents/`

| Agent          | Purpose                                                                | Tools                   |
| -------------- | ---------------------------------------------------------------------- | ----------------------- |
| `ui-reviewer`  | Checks a changed screen against `design-system`. Reports drift only.   | Read, Grep, Glob        |
| `sync-auditor` | Reviews any change under `lib/sync/**` for a lost write or a duplicate | Read, Grep, Glob, Bash  |
| `test-writer`  | Writes Vitest cases from a step's acceptance list                      | Read, Write, Edit, Bash |

### 0.7.5 `.claude/settings.json` — hooks and permissions

Three hooks:

1. **PreToolUse on `Bash`, matching `git commit`** → run
   `.claude/hooks/commit-gate.sh`. It blocks the commit when no report matches the
   staged diff. See 0.8.
2. **PostToolUse on `Edit` and `Write`, matching `*.ts` and `*.tsx`** → run
   `eslint --fix` and `prettier --write` on that one file. This keeps the tree
   formatted with no extra step.
3. **PostToolUse on `Edit` and `Write`, matching `app/**` and `components/**`** →
   print a reminder to check the change against the `design-system` skill on both
   390 px and 1440 px.

Permissions: allow `pnpm *`, `git status`, `git diff`, `git log`, `npx playwright *`.

**Done when** an edit to a `.tsx` file is auto-formatted, and a `git commit` with no
report is blocked with a clear message.

---

## 0.8 The commit report and the commit gate

**The rule.** No commit is allowed until a report exists for exactly the staged
change.

**Do**

1. `scripts/commit-report.ts`. It reads:
   - `git diff --cached --stat` and the file list,
   - `coverage/coverage-summary.json`,
   - the Vitest JSON report,
   - a Markdown body that Claude writes to `reports/.draft.md`.
     It writes `reports/<YYYY-MM-DD>-<slug>.html` and
     `reports/.last-report-hash` holding `git diff --cached | sha256`.
2. The report HTML holds five sections, in this order:
   - **What this commit does** — plain language, one line per change.
   - **Improvements** — what is better now.
   - **Fallbacks** — what was cut, deferred, stubbed or worked around.
   - **Things to consider** — risk, follow-up, anything the user must decide.
   - **Evidence** — test counts, coverage table, the changed file list, the
     mobile and desktop screenshots when a screen changed.
3. Style the report with the same design tokens, so it is readable and familiar.
4. `.claude/hooks/commit-gate.sh`:
   ```sh
   # Block unless sha256(staged diff) == contents of reports/.last-report-hash
   # On block, exit 2 with: "Run the commit-report skill first."
   ```
5. `.claude/skills/commit-report/SKILL.md` drives the whole flow: run the tests,
   write the draft, run the script, then commit.

**Done when** a commit with no report is blocked, and the same commit passes right
after the report is generated.

---

## 0.9 The design system: tokens, skill and prototype

This is what keeps every future page identical in feel.

### 0.9.1 One source of truth for the tokens

`app/globals.css` with Tailwind v4 `@theme`. Every token from the specification:

```css
@theme {
  --color-ground: #0b0b0d;
  --color-surface: #15151a;
  --color-surface-2: #1e1e25;
  --color-border: #24242c;
  --color-text: #f4f4f7;
  --color-muted: #8c8c99;
  --color-dim: #6e6e7b;
  --color-accent: #c6f135;
  --color-accent-ink: #10160a;
  --color-data-cyan: #22d3ee;
  --color-data-violet: #a78bfa;
  --color-warn: #fb923c;
  --color-danger: #f87171;
  --color-ok: #4ade80;

  --radius-card: 20px;
  --radius-hero: 24px;
  --radius-input: 16px;

  --font-sans: 'Figtree', system-ui, sans-serif;
}
```

`lib/design/tokens.ts` re-exports the same values for chart code, which cannot read
CSS variables. A unit test asserts that the two files agree. If they drift, the test
fails.

### 0.9.2 The primitives

Build these before any screen. Each one gets a test and a style guide entry.

| Component       | Notes                                                                        |
| --------------- | ---------------------------------------------------------------------------- |
| `AppShell`      | Responsive frame. Tab bar under 1024 px, sidebar at 1024 px and up.          |
| `Card`          | `surface`, 1 px `border`, `radius-card`. A `selected` variant uses `accent`. |
| `HeroCard`      | Filled `accent`, `accent-ink` text, `radius-hero`.                           |
| `StatCard`      | Micro label, 25 px number, optional bar or sparkline.                        |
| `MicroLabel`    | 9.5 to 10 px, weight 700, tracking 1.5 px, upper case, `muted`.              |
| `StatusChip`    | 6 px dot plus a word. `SYNCED` green, `OFFLINE` orange, `SYNCING` cyan.      |
| `NumberField`   | 52 px tall, `radius-input`, `inputMode` set for the phone keypad.            |
| `DurationField` | Accepts `1:12:05`, `72m`, `1h 12m`. Uses `lib/duration.ts`.                  |
| `SegmentedTabs` | Day / Week / Month. Accent pill on the selected tab.                         |
| `PrimaryButton` | 54 px tall, accent fill. `SecondaryButton` is surface-2 with a border.       |
| `SheetModal`    | Bottom sheet under 1024 px. Centered dialog at 1024 px and up.               |

### 0.9.3 The responsive contract

| Range          | Layout                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| Under 640 px   | One column. 20 px side gutters. Bottom tab bar with a centre action button.                               |
| 640 to 1023 px | Two-column card grid. Bottom tab bar stays. Gutters grow to 28 px.                                        |
| 1024 px and up | Left sidebar 240 px. Content column capped at 1100 px and centred. Three-column card grid. No bottom bar. |

Fixed rules:

- Mobile first. Write the base style for the phone. Add `md:` and `lg:` upward only.
- The bottom tab bar adds `padding-bottom: env(safe-area-inset-bottom)`.
- Set `viewport-fit=cover` and `interactive-widget=resizes-content`.
- No horizontal scroll at any width from 320 px to 2560 px.
- Every tap target is 44 px or taller, on every breakpoint.
- Charts fill their container width. Never set a fixed pixel width.
- Test every screen at 390 px, 768 px and 1440 px.

### 0.9.4 The `design-system` skill

`.claude/skills/design-system/SKILL.md` plus these reference files:

| File                       | Content                                         |
| -------------------------- | ----------------------------------------------- |
| `references/tokens.md`     | The full token table and when to use each color |
| `references/components.md` | Every primitive above, with its markup recipe   |
| `references/responsive.md` | The table and the fixed rules of 0.9.3          |
| `references/checklist.md`  | The pass or fail list below                     |

The skill description makes it load for any work under `app/`, `components/` or on
styling. Its checklist:

1. Does every color come from a token? No raw hex in a component.
2. Does the page use `AppShell`, not its own frame?
3. Is there a bottom tab bar under 1024 px and a sidebar at 1024 px and up?
4. Is every tap target 44 px or taller?
5. Does the page render with no horizontal scroll at 320, 390, 768, 1024 and 1440 px?
6. Is every interactive element a real `button`, `a` or `input` with a label?
7. Do numbers use tabular figures?
8. Do the micro labels use `MicroLabel`, not a hand-written style?
9. Is the new component in the style guide route?

### 0.9.5 The prototype in the repository

Two artefacts. They are the visual contract.

1. **`docs/design/prototype/index.html`** — one standalone file, no build step. It
   shows all seven screens side by side at 390 px. Open it in any browser. It is
   generated from the approved mockups and it never imports project code, so it
   cannot drift by accident. A `README.md` beside it names the canvas link.
2. **`app/styleguide/page.tsx`** — a live route. It renders every token swatch,
   every type step and every primitive, at the current breakpoint. It is the drift
   detector: the prototype shows the target, the style guide shows the truth, and
   the two must match.

Guard the style guide route behind `process.env.NODE_ENV !== 'production'`, or
behind a `NEXT_PUBLIC_ENABLE_STYLEGUIDE` flag, so it never ships to the live app.

**Done when** `/styleguide` renders every primitive at 390 px, 768 px and 1440 px,
and the prototype file opens in a browser with no console error.

---

## 0.10 The Progressive Web App shell

**Do**

1. `app/manifest.ts`: name, short name, `display: "standalone"`,
   `background_color` and `theme_color` set to `#0B0B0D`, `start_url: "/"`,
   `orientation: "portrait"`.
2. Icons: 192 px, 512 px, and a 512 px maskable icon. Plus `apple-touch-icon.png`
   at 180 px. Use the dumbbell mark from the sign-in mockup on the accent fill.
3. `pnpm add -D @serwist/next` and `pnpm add serwist`. Configure a precache of the
   app shell and a network-first policy for the Supabase calls.
4. `app/~offline/page.tsx`: the offline fallback. It states that the data is safe on
   the phone and that it syncs later.
5. Metadata in `app/layout.tsx`: `viewport-fit=cover`, `apple-mobile-web-app-capable`,
   `apple-mobile-web-app-status-bar-style: black-translucent`.

**Done when** the Lighthouse installability audit passes on the built app.

---

## 0.11 Phase 0 verification

**Do**

1. Add the umbrella script:
   ```json
   { "verify": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:cov && pnpm build" }
   ```
2. Run the full list and record the result in the Phase 0 commit report.

**Checklist**

- [ ] `pnpm verify` passes.
- [ ] `pnpm e2e` passes on iPhone 14, Pixel 7 and desktop 1440.
- [ ] A bad commit message is rejected.
- [ ] A commit with no report is blocked.
- [ ] `/styleguide` matches `docs/design/prototype/index.html`.
- [ ] Lighthouse: installable, accessibility 95 or higher.
- [ ] CI is green.
- [ ] No horizontal scroll from 320 px to 2560 px on the style guide.

**Commit** `chore(setup): phase 0 foundation, tooling and design system`
