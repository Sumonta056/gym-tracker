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

SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET_DIR="$PWD"

# Read the hook payload only when stdin is a pipe or a file. A terminal would hang.
PAYLOAD=""
if [ ! -t 0 ]; then
  PAYLOAD="$(cat 2>/dev/null || true)"
fi

# Read tool_input.command only. Matching the whole payload gates any command that
# merely mentions both words, for example "git diff" piped into a path named commit-*.
# With no payload (a manual probe) fall through and evaluate the gate.
if [ -n "$PAYLOAD" ]; then
  VERDICT="$(GATE_PAYLOAD="$PAYLOAD" GATE_PWD="$PWD" python3 - <<'PY' 2>/dev/null || printf 'GATED\t%s' "$PWD"
import json, os, re, shlex

try:
    payload = json.loads(os.environ["GATE_PAYLOAD"])
except Exception:
    payload = {}
command = str(payload.get("tool_input", {}).get("command", ""))
cwd = str(payload.get("cwd") or os.environ["GATE_PWD"])

def resolve(base, path):
    path = os.path.expanduser(os.path.expandvars(path))
    return os.path.normpath(os.path.join(base, path))

def words(segment):
    try:
        return shlex.split(segment)
    except ValueError:
        return segment.split()

assignment = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")
here = cwd
for segment in re.split(r"[;&|\n]+|\$\(|`", command):
    tokens = words(segment)
    while tokens and (assignment.match(tokens[0]) or tokens[0] in ("env", "command", "exec", "!")):
        tokens.pop(0)
    if not tokens:
        continue
    if tokens[0] in ("cd", "pushd") and len(tokens) > 1:
        here = resolve(here, tokens[1])
        continue
    if os.path.basename(tokens[0]) != "git":
        continue
    target = here
    index = 1
    while index < len(tokens) and tokens[index].startswith("-"):
        option = tokens[index]
        if option == "-C" and index + 1 < len(tokens):
            target = resolve(target, tokens[index + 1])
            index += 2
        elif option in ("-c", "--git-dir", "--work-tree", "--namespace") and index + 1 < len(tokens):
            index += 2
        else:
            index += 1
    if index < len(tokens) and tokens[index] == "commit":
        print("GATED\t" + target)
        raise SystemExit
print("PASS")
PY
)"

  case "$VERDICT" in
    GATED*) TARGET_DIR="${VERDICT#GATED?}" ;;
    *) exit 0 ;;
  esac
fi

REPO_ROOT="$(git -C "$TARGET_DIR" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$SCRIPT_ROOT")"
HASH_FILE="$REPO_ROOT/reports/.last-report-hash"

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
