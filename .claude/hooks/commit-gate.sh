#!/usr/bin/env bash
# Gym Tracker commit gate.
#
# No commit is allowed until a report exists for exactly the staged change.
# The gate blocks unless sha256(staged diff) equals reports/.last-report-hash.
#
# Wired as a PreToolUse hook on Bash, matching "git commit". Claude Code sends the
# tool input as JSON on stdin. Exit 2 blocks the tool call and shows stderr to Claude.
#
# It is also safe to run by hand from a plain shell, with no stdin at all:
#   .claude/hooks/commit-gate.sh ; echo $?

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HASH_FILE="$REPO_ROOT/reports/.last-report-hash"

# Read the hook payload only when stdin is a pipe or a file. A terminal would hang.
PAYLOAD=""
if [ ! -t 0 ]; then
  PAYLOAD="$(cat 2>/dev/null || true)"
fi

# Read tool_input.command only. Matching the whole payload gates any command that
# merely mentions both words, for example "git diff" piped into a path named commit-*.
# With no payload (a manual probe) fall through and evaluate the gate.
if [ -n "$PAYLOAD" ]; then
  COMMAND="$(printf '%s' "$PAYLOAD" | python3 -c 'import sys, json
try:
    print(json.load(sys.stdin).get("tool_input", {}).get("command", ""))
except Exception:
    print("")' 2>/dev/null || true)"

  # Gate a segment that starts with git and reaches commit before any other verb.
  # The option group allows a flag on its own and a flag with a value, as in "git -C dir".
  if ! printf '%s' "$COMMAND" |
    grep -Eq '(^|[;&|])[[:space:]]*git([[:space:]]+-[^[:space:]]*([[:space:]]+[^-][^[:space:]]*)?)*[[:space:]]+commit([[:space:]]|$)'; then
    exit 0
  fi
fi

fail() {
  cat >&2 <<'MESSAGE'
BLOCKED: no report matches the staged change.

Run the commit-report skill first.

It writes reports/<YYYY-MM-DD>-<slug>.html and refreshes reports/.last-report-hash.

Until step 0.8 ships that skill, write the report by hand into reports/ and then
refresh the hash yourself, as the very last action before committing:

  git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash

Restaging anything makes the hash stale, so run it again after any git add.
MESSAGE
  exit 2
}

if ! command -v shasum >/dev/null 2>&1; then
  echo "BLOCKED: shasum not found, cannot verify the report hash." >&2
  fail
fi

if [ ! -f "$HASH_FILE" ]; then
  fail
fi

# Trim whitespace and any trailing newline from the stored hash before comparing.
STORED="$(tr -d '[:space:]' <"$HASH_FILE")"
ACTUAL="$(git -C "$REPO_ROOT" diff --cached | shasum -a 256 | cut -d' ' -f1)"

if [ -z "$STORED" ] || [ "$STORED" != "$ACTUAL" ]; then
  fail
fi

exit 0
