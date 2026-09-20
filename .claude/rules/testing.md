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

## Naming

- Unit test: beside its subject, `<subject>.test.ts`, or `.test.tsx` for a component.
- End to end test: `tests/e2e/<feature>.spec.ts`.
- `describe` names the unit under test. `it` reads as a sentence, for example
  `it('returns 0 for an empty string')`.
- One behaviour per `it`. No shared mutable state between tests.

## End to end

- Playwright runs three projects: iPhone 14, Pixel 7 and desktop 1440.
- axe reports zero serious or critical issues on every route.

## The gate

`pnpm verify` runs format, lint, typecheck, coverage and build. It must pass before
any step is done.
