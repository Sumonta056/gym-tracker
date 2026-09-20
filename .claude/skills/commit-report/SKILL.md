---
name: commit-report
description: Generate the commit report that opens the commit gate for exactly the staged
  change. Use before any commit, when the gate blocks a `git commit`, when asked to
  "write the report", "run the report", "open the gate", or when a plan step is finished
  and about to be committed.
---

# The commit report

No commit is allowed until a report exists for exactly the staged change.
`.claude/hooks/commit-gate.sh` blocks `git commit` unless the sha256 of the staged
diff equals `reports/.last-report-hash`. This skill writes the report and refreshes
that hash.

The user runs the commit. You never run `git commit` yourself.

## Before you start

Read `.claude/rules/git.md`. Confirm the change is finished and the working tree holds
nothing you do not mean to ship.

## Steps

### 1. Run the gates

```
pnpm verify
```

Until step 0.11 ships `verify`, run them one by one: `pnpm format:check`,
`pnpm lint --max-warnings=0`, `pnpm typecheck`, `pnpm test:cov`, `pnpm build`.

`pnpm test:cov` writes `coverage/coverage-summary.json`. The report reads it. Without
it the coverage table is replaced by a plain warning line.

For the test counts, also write the Vitest JSON report:

```
pnpm vitest run --reporter=json --outputFile=reports/.vitest-report.json
```

That file is optional. Without it the report says so instead of inventing numbers.

### 2. Stage the change

The user stages it, or you do it on their instruction. The report describes the staged
diff and nothing else. **Restage anything and the hash goes stale**, so finish staging
before step 4.

### 3. Write `reports/.draft.md`

Front matter, then four headings. Fifth heading optional.

```markdown
---
title: The commit report generator
slug: commit-report-generator
subtitle: Phase 0 · step 0.8
scope: setup
---

## What this commit does

- Plain language, one line per change. Use `code` for a path or a command.
- **Bold** for the part that matters.

## Improvements

- What is better now.

## Fallbacks

- What was cut, deferred, stubbed or worked around, and why.

## Things to consider

- Risk, follow-up, anything the user must decide.

## Evidence

Optional prose or a fenced block. The script appends the test counts, the coverage
table, the changed file list and the diff stat below whatever you write here.
```

Rules the parser enforces:

| Rule                | Detail                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------- |
| Front matter        | Optional. `---` fenced. `key: value` lines. Keys used: `title`, `slug`, `subtitle`, `scope`. |
| Headings            | `#`, `##` or `###`. The text must match a section title exactly, spelling and case.          |
| Required sections   | What this commit does · Improvements · Fallbacks · Things to consider. Missing one fails.    |
| Evidence            | Optional. Its prose is placed above the generated tables.                                    |
| Body                | Flat `-` bullets, plain paragraphs, and ` ``` ` fenced blocks. No tables, no nesting.        |
| Inline              | `` `code` `` and `**bold**` only. Everything else is escaped as plain text.                  |
| A heading before it | Any other heading before the first section title becomes the title if front matter has none. |

The slug decides the filename. It is taken in this order, first one wins:

1. `--slug=<value>` on the command line, or a bare first argument.
2. The `slug:` line in the front matter.
3. The `title:` line, or the first heading above the sections.

Whatever wins is lowercased and non-alphanumeric runs become `-`.

### 4. Run the script

```
pnpm report
```

Or with an explicit slug: `pnpm report --slug=daily-tracker-shell`.

It writes `reports/<YYYY-MM-DD>-<slug>.html`, then writes `reports/.last-report-hash`
last. It refuses to write anything when nothing is staged, and when the draft is
missing or incomplete.

It runs on Node 25 with no bundler and no `tsx`. It imports only `node:` built-ins and
nothing from the project.

### 5. Hand the commit to the user

Print the report path and the commit command. Do not run it.

```
git commit -m "<type>(<scope>): <subject>"
```

Types: `feat` `fix` `chore` `docs` `test` `refactor` `perf` `build` `ci` `style`
`revert`. Scopes: `setup` `db` `sync` `ui` `design` `charts` `pwa` `auth` `csv` `test`
`docs` `ci`. Nothing else passes commitlint.

Never bypass the gate. No `--no-verify`. No editing the hash by hand once the script
exists.

## Done when

- `reports/<date>-<slug>.html` opens in a browser and reads cleanly.
- The five sections are present, in order, and the Evidence section holds the counts,
  the coverage table and the changed file list.
- `.claude/hooks/commit-gate.sh` exits 0 for the staged diff.
- The user has the commit command and has not been committed for.
