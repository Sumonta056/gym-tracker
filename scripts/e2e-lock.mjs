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
