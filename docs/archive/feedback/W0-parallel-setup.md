# Step W0 — The e2e lock for parallel steps

**Branch:** `fix/w0-e2e-lock`, in its own worktree, cut from `fix/feedback-fixes` · **Wave:** 0 ·
**Size:** S · **Depends on:** nothing · **Unlocks:** every step ·
**Agent to use:** none

## Why this step exists

The fix track runs up to 3 steps at the same time, each in its own git worktree. Every
e2e run uses port 3100 and the one shared test account in `.env.test.local`. Two e2e
runs at the same time test the wrong build or change each other's rows. This step adds a
lock, so only 1 e2e run happens on this machine at a time. Lint, typecheck, unit tests
and the build still run in parallel.

## Before you start

1. Make the worktree, unless you are already in it on branch `fix/w0-e2e-lock`:
   ```bash
   cd /Users/cefalo_1/Documents/Projects/gym-tracker
   git worktree add ../gym-tracker-w0 -b fix/w0-e2e-lock fix/feedback-fixes
   cd ../gym-tracker-w0
   cp ../gym-tracker/.env.local ../gym-tracker/.env.test.local .
   export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"
   pnpm install
   ```
2. Check: `test ! -f scripts/e2e-lock.mjs`. If the file exists, W0 is already done. Stop
   and report.

## Context to read first

1. `package.json`, the `verify` script.
2. `playwright.config.ts`, the `webServer` block. Port 3100 and `reuseExistingServer`.
3. `.claude/rules/testing.md`, "The gate".

## Goal

`pnpm verify:parallel` does what `pnpm verify` does, but the e2e part waits for a
machine-wide lock and refuses to start when port 3100 is already in use.

## Do

1. Write `scripts/e2e-lock.mjs`:

   ```js
   import { spawn } from 'node:child_process'
   import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
   import { createServer } from 'node:net'
   import { tmpdir } from 'node:os'
   import { join } from 'node:path'

   const LOCK_DIR = join(tmpdir(), 'gym-tracker-e2e.lock')
   const OWNER_FILE = join(LOCK_DIR, 'owner')
   const POLL_MS = 15000
   const PORT = 3100

   function alive(pid) {
     try {
       process.kill(pid, 0)
       return true
     } catch {
       return false
     }
   }

   function ownerPid() {
     try {
       return Number(readFileSync(OWNER_FILE, 'utf8').split('\n')[0])
     } catch {
       return Number.NaN
     }
   }

   function tryAcquire() {
     try {
       mkdirSync(LOCK_DIR)
       writeFileSync(OWNER_FILE, `${String(process.pid)}\n${process.cwd()}\n`)
       return true
     } catch {
       const pid = ownerPid()
       if (Number.isInteger(pid) && pid > 0 && !alive(pid)) {
         rmSync(LOCK_DIR, { recursive: true, force: true })
       }
       return false
     }
   }

   function release() {
     if (ownerPid() === process.pid) rmSync(LOCK_DIR, { recursive: true, force: true })
   }

   function portFree(port) {
     return new Promise((resolve) => {
       const server = createServer()
       server.once('error', () => resolve(false))
       server.once('listening', () => server.close(() => resolve(true)))
       server.listen(port, '127.0.0.1')
     })
   }

   const [command, ...args] = process.argv.slice(2)
   if (!command) {
     console.error('Usage: node scripts/e2e-lock.mjs <command> [args...]')
     process.exit(2)
   }

   while (!tryAcquire()) {
     console.log(`Waiting for the e2e lock at ${LOCK_DIR}`)
     await new Promise((resolve) => setTimeout(resolve, POLL_MS))
   }

   if (!(await portFree(PORT))) {
     release()
     console.error(`Port ${String(PORT)} is in use. Stop the other server, then run again.`)
     process.exit(1)
   }

   const child = spawn(command, args, { stdio: 'inherit' })
   for (const signal of ['SIGINT', 'SIGTERM']) {
     process.on(signal, () => child.kill(signal))
   }
   child.on('error', (error) => {
     release()
     console.error(error)
     process.exit(1)
   })
   child.on('exit', (code, signal) => {
     release()
     process.exit(code ?? (signal ? 1 : 0))
   })
   ```

2. Add to `package.json` `scripts`, after `verify`:

   ```json
   "verify:parallel": "pnpm static && pnpm test:cov && pnpm build && node scripts/e2e-lock.mjs pnpm e2e"
   ```

3. Add this section to the end of `.claude/rules/testing.md`:

   ```markdown
   ## Parallel steps

   When more than 1 worktree runs a step at the same time, run `pnpm verify:parallel`,
   not `pnpm verify`. It waits for a machine-wide lock before the e2e suite, so only 1
   suite uses port 3100 and the shared test account at a time. A lock left by a dead
   process is removed on the next run. To clear it by hand:
   `rm -rf "$(node -p "require('os').tmpdir()")/gym-tracker-e2e.lock"`.
   ```

4. Make the commit gate follow the worktree it runs in. In `.claude/hooks/commit-gate.sh`,
   replace the `REPO_ROOT=` line with:

   ```bash
   SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
   REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || printf '%s' "$SCRIPT_ROOT")"
   ```

   The hook runs from `$CLAUDE_PROJECT_DIR`, which can be the main folder while the
   commit happens in a worktree. With this change the gate reads the hash file and the
   staged diff of the folder the commit runs in. The gate still blocks a commit with no
   matching report. This is not a bypass.

5. In `.claude/rules/git.md`, under "Branch naming", add:

   ```markdown
   The fix track runs 1 step per worktree: `../gym-tracker-<step>` on branch
   `fix/<step>-<slug>`, cut from `fix/feedback-fixes`. Each worktree has its own `reports/`. The commit
   gate reads the worktree it runs in.
   ```

## Acceptance criteria

- [ ] In a second worktree, a commit with a matching `reports/.last-report-hash` in that
      worktree passes the gate, and a commit with no report is blocked.
- [ ] Two runs at the same time wait for each other: the second starts only after the
      first ends.
- [ ] A lock whose owner process is dead is removed, and the run goes on.
- [ ] A busy port 3100 stops the run with exit code 1 and the message, and frees the lock.
- [ ] The exit code of the command passes through (test 4 below).
- [ ] `pnpm lint` passes on the new script.

## Tests

Run each check by hand and paste the output into the commit report.

1. Two at once:
   ```bash
   node scripts/e2e-lock.mjs node -e "setTimeout(() => console.log('A done'), 4000)" &
   sleep 1
   time node scripts/e2e-lock.mjs node -e "console.log('B done')"
   ```
   Expected: "Waiting for the e2e lock", then "A done" before "B done". B takes about 15 s.
2. Stale lock:
   ```bash
   L="$(node -p "require('os').tmpdir()")/gym-tracker-e2e.lock"
   mkdir "$L" && printf '999999\n/x\n' > "$L/owner"
   node scripts/e2e-lock.mjs node -e "console.log('ran')"
   ```
   Expected: "ran" after 1 poll. `test ! -d "$L"` afterwards.
3. Busy port:
   ```bash
   node -e "require('net').createServer().listen(3100,'127.0.0.1')" &
   node scripts/e2e-lock.mjs node -e "console.log('no')"; echo "exit=$?"
   kill %1
   ```
   Expected: the port message and `exit=1`. The lock directory is gone.
4. Exit code: `node scripts/e2e-lock.mjs node -e "process.exit(3)"; echo "exit=$?"` gives `exit=3`.
5. Gate in a worktree, from inside `../gym-tracker-w0`:
   ```bash
   echo x > gate-probe.txt && git add gate-probe.txt
   printf '{"tool_input":{"command":"git commit -m probe"}}' | CLAUDE_PROJECT_DIR=../gym-tracker .claude/hooks/commit-gate.sh; echo "no report: exit=$?"
   git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash
   printf '{"tool_input":{"command":"git commit -m probe"}}' | .claude/hooks/commit-gate.sh; echo "report: exit=$?"
   git reset -q gate-probe.txt && rm gate-probe.txt reports/.last-report-hash
   ```
   Expected: `no report: exit=2`, then `report: exit=0`.

## Verification

`pnpm verify:parallel`. It must pass with the same result as `pnpm verify`.

## Files touched

- `scripts/e2e-lock.mjs` (new)
- `package.json`
- `.claude/rules/testing.md`
- `.claude/rules/git.md`
- `.claude/hooks/commit-gate.sh`

## When the step is done

1. `pnpm verify:parallel` is green.
2. Stage the files, then run the `commit-report` skill. The skill reports on the staged
   diff. This step file tells you to commit, so it overrides the line in the skill that
   says you never commit.
   ```bash
   git add scripts/e2e-lock.mjs package.json .claude/rules/testing.md .claude/rules/git.md .claude/hooks/commit-gate.sh
   ```
3. Commit on `fix/w0-e2e-lock`:
   ```bash
   git commit -m "build(test): add an e2e lock for parallel worktrees"
   ```
   If you stage anything after the report, write the report hash again first:
   `git diff --cached | shasum -a 256 | cut -d' ' -f1 > reports/.last-report-hash`.
4. Do not push. Do not merge. Do not edit `PROGRESS.md` or `index.md`.
5. Report the branch, the commit hash and the verify result.
