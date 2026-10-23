---
name: release
description: Cut a Gym Tracker release — pick the semver version from the commits since
  the last tag, bump `package.json`, write `CHANGELOG.md` and the README changelog, and
  hand the owner the commit, tag and push commands. Use when asked to "release",
  "cut a version", "tag a release", "write the changelog" or "bump the version".
---

# Release

The owner runs the commit, the tag and the push. You never push.

## Before you start

1. You are on `main`, the tree is clean, and `git fetch --tags` is done.
2. The full `pnpm verify` passed on this commit, or the owner says to skip it.

## Steps

### 1. Find the changes

```
git describe --tags --abbrev=0
git log --oneline <last tag>..HEAD
```

No tag yet: take the whole history. Keep only what a user sees. Tests, refactors, CI
and docs stay out.

### 2. Pick the version

| Commits since the last tag                  | Bump                    |
| ------------------------------------------- | ----------------------- |
| A `!` after the type, or `BREAKING CHANGE:` | major                   |
| Any `feat`                                  | minor                   |
| Only `fix`, `perf`                          | patch                   |
| Nothing a user sees                         | stop and tell the owner |

Show the owner the version and the list. Wait for approval.

### 3. Write the files

- `package.json`: set `"version"`.
- `CHANGELOG.md`: add `## <version> — YYYY-MM-DD` at the top, under `# Changelog`.
  One bullet per change, plain words, the user's view. Create the file if it is
  missing.
- `README.md`, section `## Changelog`: add the same entry at the top. Keep the last 5
  entries there and link the rest to `CHANGELOG.md`.
- Run `pnpm exec prettier --write CHANGELOG.md README.md package.json`.

### 4. Gate and hand over

1. Stage the 3 files.
2. Run the `commit-report` skill.
3. Give the owner these commands:

```
git commit -m "chore(setup): release <version>"
git tag -a v<version> -m "v<version>"
git push origin main --follow-tags
```

## Done when

- `package.json`, `CHANGELOG.md` and the README changelog all name the same version.
- The report exists for the staged diff.
- The owner has the 3 commands.
