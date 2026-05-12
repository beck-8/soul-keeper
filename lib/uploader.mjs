import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { uploadBundle } from './foc.mjs'
import { listSnapshots, updateSnapshot } from './index-store.mjs'

export async function processOnce({ stateDir, sponsorKey, sessionPrivateKey, rpcUrl }) {
  const all = await listSnapshots({ stateDir })
  const queue = all.filter((s) => s.status === 'pending' || s.status === 'failed')
  for (const snap of queue) {
    try {
      await updateSnapshot({ stateDir }, snap.id, { status: 'uploading' })
      const bytes = await readFile(join(stateDir, 'soul-keeper', snap.localPath))
      const { pieceCid } = await uploadBundle({
        bytes,
        sponsorKey,
        sessionPrivateKey,
        rpcUrl,
      })
      await updateSnapshot({ stateDir }, snap.id, {
        status: 'uploaded',
        cid: pieceCid,
        uploadedAt: new Date().toISOString(),
        uploadAttempts: (snap.uploadAttempts ?? 0) + 1,
        lastError: null,
      })
    } catch (err) {
      await updateSnapshot({ stateDir }, snap.id, {
        status: 'failed',
        lastError: err.message,
        uploadAttempts: (snap.uploadAttempts ?? 0) + 1,
      })
    }
  }
}

/**
 * Resolve the session private key for a stateDir.
 * Order: explicit arg → `.session-password` file (derive) → throw.
 */
export async function resolveSessionPrivateKey({ stateDir, sessionKey }) {
  if (sessionKey?.startsWith('0x') && sessionKey.length === 66) return sessionKey

  // Fallback: derive from cached password
  try {
    const pw = readFileSync(join(stateDir, 'soul-keeper', '.session-password'), 'utf8').trim()
    const { deriveSessionKey } = await import('./wallet.mjs')
    return await deriveSessionKey(pw)
  } catch (err) {
    throw new Error(
      `No --sessionKey arg and could not read <stateDir>/soul-keeper/.session-password (${err.message}). Run /soul setup or pass --sessionKey=0x... explicitly.`,
    )
  }
}

// CLI entry: `node lib/uploader.mjs --stateDir=<path> [--sessionKey=0x...]`
// If --sessionKey is omitted, derives it from <stateDir>/soul-keeper/.session-password.
const isCliInvocation =
  process.argv[1] != null && import.meta.url === `file://${process.argv[1].replaceAll('\\', '/')}`
if (isCliInvocation) {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=')
      return [k, v ?? true]
    }),
  )
  const { getSponsor } = await import('./sponsor.mjs')
  const { loadConfig } = await import('./config.mjs')
  const cfg = await loadConfig({ stateDir: args.stateDir })
  const sponsor = getSponsor({ network: cfg.network })
  const sessionPrivateKey = await resolveSessionPrivateKey({
    stateDir: args.stateDir,
    sessionKey: args.sessionKey,
  })
  await processOnce({
    stateDir: args.stateDir,
    sponsorKey: sponsor.privateKey,
    sessionPrivateKey,
    rpcUrl: sponsor.rpcUrl,
  })
}
