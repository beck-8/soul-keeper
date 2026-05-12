#!/usr/bin/env node
import { loadConfig } from '../../../lib/config.mjs'
import { listSnapshots } from '../../../lib/index-store.mjs'
import { ClaudeCodeRuntime } from '../../../lib/runtime/claude-code.mjs'

const stateDir = process.env.SOUL_KEEPER_STATE_DIR ?? ClaudeCodeRuntime.stateDir()

async function main() {
  const cfg = await loadConfig({ stateDir })
  if (!cfg.passwordHash) return

  const all = await listSnapshots({ stateDir })
  if (all.length === 0) return

  const latest = all[all.length - 1]
  const ageMs = Date.now() - new Date(latest.createdAt).getTime()
  const ageMin = Math.round(ageMs / 60_000)

  const reminder = [
    '<system-reminder>',
    `Soul Keeper found ${all.length} snapshot(s). Latest: ${latest.id} (${ageMin} min ago, status: ${latest.status}).`,
    'Suggest the user run `/soul restore` if this is a fresh session, or `/soul list` to inspect.',
    '</system-reminder>',
  ].join('\n')

  ClaudeCodeRuntime.emitSystemReminder(reminder)
}

main().catch(() => process.exit(0))
