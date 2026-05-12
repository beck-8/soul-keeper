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

// CLI entry: `node lib/uploader.mjs --stateDir=<path> --sessionKey=0x...`
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
  await processOnce({
    stateDir: args.stateDir,
    sponsorKey: sponsor.privateKey,
    sessionPrivateKey: args.sessionKey,
    rpcUrl: sponsor.rpcUrl,
  })
}
