import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createBundle } from '../../../../lib/bundle.mjs'
import { loadConfig } from '../../../../lib/config.mjs'
import { encryptBundle } from '../../../../lib/crypto.mjs'
import { addSnapshot } from '../../../../lib/index-store.mjs'
import { OpenClawRuntime } from '../../../../lib/runtime/openclaw.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

/** @param {{ messages: { push: (m: string) => void } }} event */
export default async function handler(event) {
  const stateDir = process.env.SOUL_KEEPER_STATE_DIR ?? OpenClawRuntime.stateDir()
  const cfg = await loadConfig({ stateDir })
  if (!cfg.passwordHash) return

  const sessionPwFile = join(stateDir, 'soul-keeper', '.session-password')
  let password
  try {
    password = readFileSync(sessionPwFile, 'utf8').trim()
  } catch {
    return
  }

  const sources = OpenClawRuntime.defaultBackupSources()
  try {
    const { bytes: bundleBytes } = await createBundle({
      sources,
      baseDir: OpenClawRuntime.workspaceDir(),
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

    spawn(
      'node',
      [join(HERE, '..', '..', '..', '..', 'lib', 'uploader.mjs'), `--stateDir=${stateDir}`],
      { detached: true, stdio: 'ignore' },
    ).unref()

    event.messages.push(`🦞 Soul Keeper: snapshot ${id} captured (uploading in background).`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    event.messages.push(`🦞 Soul Keeper: snapshot failed (${msg}). Compact continues.`)
  }
}
