#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createBundle } from '../../../lib/bundle.mjs'
import { loadConfig } from '../../../lib/config.mjs'
import { encryptBundle } from '../../../lib/crypto.mjs'
import { addSnapshot } from '../../../lib/index-store.mjs'
import { ClaudeCodeRuntime } from '../../../lib/runtime/claude-code.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const stateDir = process.env.SOUL_KEEPER_STATE_DIR ?? ClaudeCodeRuntime.stateDir()

async function main() {
  // Read JSON event from stdin (may be empty)
  let input = ''
  try {
    input = readFileSync(0, 'utf8')
  } catch {}
  let event = {}
  try {
    event = input ? JSON.parse(input) : {}
  } catch {}
  const cwd = event.cwd ?? process.cwd()

  const cfg = await loadConfig({ stateDir })
  if (!cfg.passwordHash) return // No setup yet — silent no-op

  // Password recovery for hook: read from session-cached file written by /soul setup
  const sessionPwFile = join(stateDir, 'soul-keeper', '.session-password')
  let password
  try {
    password = readFileSync(sessionPwFile, 'utf8').trim()
  } catch {
    return // No cached password — skip silently
  }

  const sources = ClaudeCodeRuntime.defaultBackupSources(cwd)
  const { bytes: bundleBytes } = await createBundle({
    sources,
    baseDir: cwd,
    scope: ['memory', 'soul'],
  })
  const encrypted = await encryptBundle(bundleBytes, password)

  const id = `${new Date().toISOString().replaceAll(':', '-').slice(0, 19)}-${Math.random().toString(16).slice(2, 8)}`
  const pendingDir = join(stateDir, 'soul-keeper', 'pending')
  mkdirSync(pendingDir, { recursive: true })
  const localPath = `pending/${id}.enc`
  writeFileSync(join(stateDir, 'soul-keeper', localPath), encrypted)

  await addSnapshot(
    { stateDir },
    {
      id,
      createdAt: new Date().toISOString(),
      trigger: 'pre-compact',
      scope: ['memory', 'soul'],
      localPath,
      sizeBytes: encrypted.length,
      sha256: '',
      status: 'pending',
    },
  )

  // Spawn detached uploader; don't wait
  spawn('node', [join(HERE, '..', '..', '..', 'lib', 'uploader.mjs'), `--stateDir=${stateDir}`], {
    detached: true,
    stdio: 'ignore',
  }).unref()
}

main().catch((err) => {
  // Never block compact on hook failure
  console.error(`[soul-keeper] PreCompact hook error: ${err.message}`)
  process.exit(0)
})
