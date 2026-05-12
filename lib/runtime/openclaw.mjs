import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const OpenClawRuntime = {
  name: 'openclaw',

  stateDir() {
    return join(homedir(), '.openclaw')
  },

  workspaceDir() {
    return join(this.stateDir(), 'workspace')
  },

  configPath() {
    return join(this.stateDir(), 'openclaw.json')
  },

  defaultBackupSources() {
    const ws = this.workspaceDir()
    return [
      join(ws, 'MEMORY.md'),
      join(ws, 'SOUL.md'),
      join(ws, 'AGENTS.md'),
      join(ws, 'USER.md'),
      join(ws, 'DREAMS.md'),
      join(ws, 'memory'),
    ]
  },

  registerHooks(hookDefs) {
    const path = this.configPath()
    const current = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}
    current.hooks = current.hooks ?? { enabled: true, mappings: {} }
    current.hooks.mappings = current.hooks.mappings ?? {}
    for (const def of hookDefs) {
      current.hooks.mappings[def.event] = current.hooks.mappings[def.event] ?? []
      if (!current.hooks.mappings[def.event].includes(def.hookDir)) {
        current.hooks.mappings[def.event].push(def.hookDir)
      }
    }
    writeFileSync(path, JSON.stringify(current, null, 2))
  },

  emitSystemReminder(text) {
    // Handler wrapper provides actual event.messages.push; this stdout path is a fallback for CLI use
    process.stdout.write(`${text}\n`)
  },
}
