import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

function encodeProjectPath(cwd) {
  // Claude Code encoding: replace separators and colons with hyphens
  return cwd.replaceAll(/[\\/:]/g, '-')
}

export const ClaudeCodeRuntime = {
  name: 'claude-code',

  stateDir() {
    return join(homedir(), '.claude')
  },

  projectDir(cwd) {
    return join(this.stateDir(), 'projects', encodeProjectPath(cwd))
  },

  memoryDir(cwd) {
    return join(this.projectDir(cwd), 'memory')
  },

  configPath() {
    return join(this.stateDir(), 'settings.json')
  },

  defaultBackupSources(cwd) {
    return [this.memoryDir(cwd), join(cwd, 'soul.md')]
  },

  registerHooks(hookDefs) {
    const path = this.configPath()
    const current = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}
    current.hooks = current.hooks ?? {}
    for (const def of hookDefs) {
      current.hooks[def.event] = current.hooks[def.event] ?? []
      const exists = current.hooks[def.event].some((h) => h.command === def.command)
      if (!exists)
        current.hooks[def.event].push({ matcher: def.matcher ?? '', command: def.command })
    }
    writeFileSync(path, JSON.stringify(current, null, 2))
  },

  emitSystemReminder(text) {
    process.stdout.write(`${text}\n`)
  },
}
