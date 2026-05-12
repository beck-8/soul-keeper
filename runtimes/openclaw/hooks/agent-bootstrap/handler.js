import { loadConfig } from '../../../../lib/config.mjs'
import { listSnapshots } from '../../../../lib/index-store.mjs'
import { OpenClawRuntime } from '../../../../lib/runtime/openclaw.mjs'

/** @param {{ messages: { push: (m: string) => void } }} event */
export default async function handler(event) {
  const stateDir = process.env.SOUL_KEEPER_STATE_DIR ?? OpenClawRuntime.stateDir()
  const cfg = await loadConfig({ stateDir })
  if (!cfg.passwordHash) return

  const all = await listSnapshots({ stateDir })
  if (all.length === 0) return

  const latest = all[all.length - 1]
  const ageMin = Math.round((Date.now() - new Date(latest.createdAt).getTime()) / 60_000)

  event.messages.push(
    `🦞 Soul Keeper: ${all.length} snapshot(s) available. Latest ${latest.id} from ${ageMin} min ago (${latest.status}). Run /soul restore if appropriate.`,
  )
}
