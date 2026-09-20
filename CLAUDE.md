# Gym Tracker

A personal gym log. It replaces an Excel sheet. One user. Installable on an iPhone.
It works with no network in the gym. It also works on a laptop.

**Start here:** `PROGRESS.md` names the next step. Never skip it.

| Document                                      | Purpose                                             |
| --------------------------------------------- | --------------------------------------------------- |
| `PROGRESS.md`                                 | The next step. Update it after every step.          |
| `docs/specs/2026-09-20-gym-tracker-design.md` | What we are building and why                        |
| `docs/plan/00-phase-0.md`                     | Foundation: tooling, Claude setup, design system    |
| `docs/plan/01-phase-1.md`                     | The daily tracker                                   |
| `docs/plan/02-phase-2.md`                     | The live workout log and the CSV import             |
| `docs/design/prototype/index.html`            | The visual contract. Open it in a browser.          |
| `.claude/skills/design-system/`               | Load this before any UI work                        |
| `.claude/rules/architecture.md`               | The repository, UUID, soft delete and seconds rules |
| `.claude/rules/testing.md`                    | Test first, coverage floors, test naming            |
| `.claude/rules/git.md`                        | Conventional commits, scopes, the gate, branches    |
| `.claude/rules/accessibility.md`              | 44 px targets, real elements, labels, contrast      |

## The Claude workspace

| Path                           | What it is                                                     |
| ------------------------------ | -------------------------------------------------------------- |
| `.claude/rules/`               | The four rule files above. Short and testable.                 |
| `.claude/skills/`              | `design-system`, `commit-report`, `add-screen`, `db-migration` |
| `.claude/agents/`              | `ui-reviewer`, `sync-auditor`, `test-writer`                   |
| `.claude/hooks/commit-gate.sh` | Blocks a commit with no matching report                        |
| `.claude/settings.json`        | The three hooks and the permission allow list                  |

Design mockups: https://claude.ai/artifact/8pajWGN8ykJNhxaGLSNNG4

## Stack

Next.js 15 App Router · TypeScript strict · Tailwind CSS v4 · shadcn/ui ·
`@serwist/next` · Dexie 4 · Supabase · Recharts · `motion` · react-hook-form + zod ·
Vitest · Playwright · Prettier · ESLint · Husky · commitlint · Vercel.

## Architecture rules

Full detail, with the allowed and forbidden imports spelled out:
`.claude/rules/architecture.md`.

1. **No screen calls Supabase.** Every screen calls `lib/db/repository.ts`. The
   repository writes to Dexie and returns at once. `lib/sync/worker.ts` is the only
   code that talks to Supabase. ESLint enforces this.
2. **The client generates every `id` as a UUID.** An offline write keeps its identity
   when it syncs, so a retry never creates a duplicate row.
3. **A write and its outbox entry share one transaction.** Never one without the
   other.
4. **Durations are integer seconds** in storage. `lib/duration.ts` owns every parse
   and every format.
5. **Weight is metric** in storage. The imperial toggle is display only.
6. **Soft delete.** Set `deleted_at`. A hard delete does not sync.
7. **Every table has a Row Level Security policy** of `user_id = auth.uid()`.
8. **One zod schema per entity** in `lib/schema/`. The form, the outbox and the CSV
   importer all import it. Never re-declare a shape.

## Design rules

Load `.claude/skills/design-system/` before any work under `app/` or `components/`.
The prototype at `docs/design/prototype/index.html` is the visual contract. The live
route `/styleguide` must match it. If they differ, one of them is a bug.

### Tokens

Figtree, weights 400 to 800. `font-variant-numeric: tabular-nums` on the body.

```
--color-ground       #0B0B0D   page background
--color-surface      #15151A   cards, inputs
--color-surface-2    #1E1E25   pressed state, secondary button
--color-border       #24242C   every card and input border
--color-text         #F4F4F7   primary text
--color-muted        #8C8C99   labels, secondary text
--color-dim          #6E6E7B   inactive tab, hint text
--color-accent       #C6F135   action, today, gym time
--color-accent-ink   #10160A   text on the accent fill
--color-data-cyan    #22D3EE   walk, steps, volume load
--color-data-violet  #A78BFA   weight, 7-day average
--color-warn         #FB923C   cardio zone, warning
--color-danger       #F87171   peak zone, destructive
--color-ok           #4ADE80   sync status
```

Card radius 20 px. Hero card 24 px. Input 16 px. Pill 999 px.
Side gutters 20 px on the phone. Gap between cards 11 to 12 px.

**No raw hex in a component.** Every color comes from a token. Charts read
`lib/design/tokens.ts`, which a unit test keeps in step with `globals.css`.

### Responsive contract

| Range          | Layout                                                                                 |
| -------------- | -------------------------------------------------------------------------------------- |
| Under 640 px   | One column. 20 px gutters. Bottom tab bar with a centre action.                        |
| 640 to 1023 px | Two-column card grid. Bottom tab bar stays. 28 px gutters.                             |
| 1024 px and up | Left sidebar 240 px. Content capped at 1100 px, centred. Three columns. No bottom bar. |

- Mobile first. Write the phone style as the base. Add `md:` and `lg:` upward only.
- The tab bar adds `env(safe-area-inset-bottom)`.
- No horizontal scroll at any width from 320 px to 2560 px.
- Every tap target is 44 px or taller, at every breakpoint.
- Charts fill their container. Never set a fixed pixel width.
- Check every screen at 390 px, 768 px and 1440 px before you call it done.

### Accessibility

44 px tap targets, real `button` and `a` elements, a label on every control, 4.5:1
contrast on body text. Full detail: `.claude/rules/accessibility.md`.

### The design check runs by machine

`pnpm design:check` fails the build on drift. `.husky/pre-commit` runs it on the
staged files, so a drifting change cannot be committed.

| Check             | Rule                                                                                |
| ----------------- | ----------------------------------------------------------------------------------- |
| Raw hex           | No `#rrggbb` under `app/` or `components/`. Use a token.                            |
| Hand mixed colour | No `rgb()` or `rgba()` with literal channels. Use a token with an opacity modifier. |
| Micro label       | Only `components/ui/MicroLabel.tsx` may write `uppercase` or `tracking-[1.5px]`.    |
| Own frame         | Only `AppShell` may write `min-h-dvh` or `max-w-[1100px]`.                          |
| Button type       | Every `<button>` carries an explicit `type`.                                        |

The checks that need a real browser live in `tests/e2e/responsive.spec.ts`: no
sideways scroll from 320 px to 2560 px, every tap target 44 px or taller, and exactly
one navigation visible at every width. Every allowed exception is a named entry with a
reason in `scripts/design-check.mjs`. Never add one to get past the gate.

## Testing rules

Full detail, including test naming: `.claude/rules/testing.md`.

- **Write the tests first** for `lib/duration.ts`, `lib/sync/**` and `lib/metrics/**`.
  Those three carry most of the risk.
- Coverage floors, enforced by the Vitest config:

| Path              | Lines | Branches | Functions |
| ----------------- | ----- | -------- | --------- |
| `lib/duration.ts` | 100   | 100      | 100       |
| `lib/metrics/**`  | 100   | 95       | 100       |
| `lib/sync/**`     | 95    | 90       | 95        |
| `lib/**` (rest)   | 85    | 75       | 85        |
| `components/**`   | 85    | 75       | 85        |
| `app/**`          | 85    | 75       | 85        |

- Playwright runs three projects: iPhone 14, Pixel 7 and desktop 1440.
- axe must report zero serious or critical issues on every route.
- **Every source file has a test beside it.** `pnpm test:required` fails on any file
  under `lib/`, `components/` or `app/` with no `<name>.test.ts` or `.test.tsx`.
  A file that truly cannot be unit tested goes in the `EXEMPT` list in
  `scripts/require-tests.mjs`, with a reason.
- `pnpm verify` runs `pnpm static`, then coverage, then the build, then the
  end to end suite. It must pass before any step is done.
- `pnpm static` runs format, lint, typecheck, the design check and the test rule.

## The commit gate

Full detail, branch naming and the manual hash command: `.claude/rules/git.md`.

**You cannot commit until a report exists for the staged change.**

1. Run `pnpm verify`.
2. Run the `commit-report` skill. It writes `reports/<date>-<slug>.html` with five
   sections: what this commit does, improvements, fallbacks, things to consider,
   and evidence.
3. Then commit. A pre-tool hook blocks any `git commit` with no matching report.

Conventional commits only. Scopes: `setup`, `db`, `sync`, `ui`, `design`, `charts`,
`pwa`, `auth`, `csv`, `test`, `docs`, `ci`.

Never commit or push without being told to.

## Phases

Phase 0 is the foundation: tooling, the Claude workspace, the design system and the
prototype. Phase 1 is the daily tracker. Phase 2 is the live workout log and the CSV
import. Do not start a phase before the previous checklist passes.

# Custom System Prompt Extensions

## Bash Command Restrictions

- **Do not use script sourcing** or runtime shell evaluations (such as `.` or `source`) to configure environment managers like NVM or pyenv.
- **Execute tools directly** using their explicit environment paths or global system aliases already loaded in the environment if possible.
- **Prioritize project-local execution** using standard local tools (e.g., `pnpm lint`, `pnpm test:cov`) directly in the working directory without wrapping them in complex, multi-line initialization chains.
