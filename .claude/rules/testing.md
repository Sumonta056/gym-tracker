# Testing rules

## Test first

Write the tests before the implementation for these three. They carry most of the
risk.

- `lib/duration.ts` — every parse and format round trip.
- `lib/sync/**` — a lost write, a duplicate row, a retry after failure.
- `lib/metrics/**` — every derived number.

Everything else may be tested after the code.

## Coverage floors

Enforced by the Vitest config. A run below a floor fails.

| Path              | Lines | Branches | Functions |
| ----------------- | ----- | -------- | --------- |
| `lib/duration.ts` | 100   | 100      | 100       |
| `lib/metrics/**`  | 100   | 95       | 100       |
| `lib/sync/**`     | 95    | 90       | 95        |
| `lib/**` (rest)   | 85    | 75       | 85        |
| `components/**`   | 85    | 75       | 85        |
| `app/**`          | 85    | 75       | 85        |

## Every source file has a test

`pnpm test:required` fails on any `.ts` or `.tsx` under `lib/`, `components/` or
`app/` with no `<name>.test.ts` or `<name>.test.tsx` beside it. `.husky/pre-commit`
runs it on the staged files.

A file that truly has no unit seam goes in the `EXEMPT` list in
`scripts/require-tests.mjs`, with a reason. Today that list holds `app/sw.ts` and
`app/layout.tsx`. Never add a file to get past the gate.

## Naming

- Unit test: beside its subject, `<subject>.test.ts`, or `.test.tsx` for a component.
- End to end test: `tests/e2e/<feature>.spec.ts`.
- `describe` names the unit under test. `it` reads as a sentence, for example
  `it('returns 0 for an empty string')`.
- One behaviour per `it`. No shared mutable state between tests.

## End to end

- Playwright runs three projects: iPhone 14, Pixel 7 and desktop 1440.
- axe reports zero serious or critical issues on every route.
- `tests/e2e/responsive.spec.ts` proves the three design rules that need a real
  browser: no sideways scroll from 320 px to 2560 px, every tap target 44 px or
  taller, and exactly one navigation visible at every width.

## The gate

`pnpm static` runs format, lint, typecheck, the design check and the test rule.
`pnpm verify` runs `pnpm static`, then coverage, then the build, then the end to end
suite. It must pass before any step is done.

Continuous integration runs the same gates in three parallel jobs: **Static**,
**Unit tests** and **Browser**, where Browser is a matrix of iPhone 14, Pixel 7 and
desktop 1440.
