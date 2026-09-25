# Git rules

## Conventional commits only

```
<type>(<scope>): <subject in the imperative, lower case, no full stop>
```

Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`,
`style`, `revert`.

Scopes, and nothing else:

`setup` · `db` · `sync` · `ui` · `design` · `charts` · `pwa` · `auth` · `csv` ·
`test` · `docs` · `ci`

commitlint rejects any other scope.

## The gate

No commit is allowed until a report exists for exactly the staged change.

1. Run `pnpm verify`. It includes the design check and the test rule.
2. Run the `commit-report` skill. It writes `reports/<YYYY-MM-DD>-<slug>.html` with
   five sections: what this commit does, improvements, fallbacks, things to consider,
   and evidence. It also writes `reports/.last-report-hash`.
3. **A UI change needs screenshots in the report.** A staged change under `app/`,
   `components/` or `docs/design/prototype/` must add a Screenshots section to the
   report: every changed page at 390 px, 768 px and 1440 px, and the matching
   prototype screen. The user never has to ask for it. The `commit-report` skill says
   how.
4. Then commit.

`.claude/hooks/commit-gate.sh` runs before every `git commit` in a Bash tool call. It
blocks unless `sha256` of the staged diff equals the contents of
`reports/.last-report-hash`.

### Regenerating the hash by hand

Until step 0.8 ships the report generator, write the hash yourself after the report
is in place:

```
git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash
```

Restage anything and the hash goes stale, so run this again as the last action before
committing.

Never bypass the gate. No `--no-verify`. No disabling a hook.

## Branch naming

```
<type>/<short-kebab-subject>
```

For example `feat/daily-tracker-shell`, `fix/duration-round-trip`,
`chore/phase-0-claude-workspace`.

Phase 0 is the one agreed exception: it runs on `main`.

## Never without being told

Never run `git commit`, `git push`, or any destructive git operation unless the user
asks for it in that turn.
