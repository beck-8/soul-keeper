#!/usr/bin/env node
import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ClaudeCodeRuntime, OpenClawRuntime } from './lib/runtime/index.mjs'

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  }),
)

const SKILL_ROOT = dirname(fileURLToPath(import.meta.url))

function installForClaudeCode() {
  const stateDir = ClaudeCodeRuntime.stateDir()
  if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true })
  ClaudeCodeRuntime.registerHooks([
    {
      event: 'PreCompact',
      matcher: '',
      command: `node "${join(SKILL_ROOT, 'runtimes/claude-code/hooks/pre-compact.mjs')}"`,
    },
    {
      event: 'SessionStart',
      matcher: '',
      command: `node "${join(SKILL_ROOT, 'runtimes/claude-code/hooks/session-start.mjs')}"`,
    },
  ])
  console.log('✅ Soul Keeper hooks registered with Claude Code')
}

function installForOpenClaw() {
  const stateDir = OpenClawRuntime.stateDir()
  if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true })
  OpenClawRuntime.registerHooks([
    {
      event: 'before_compaction',
      hookDir: join(SKILL_ROOT, 'runtimes/openclaw/hooks/before-compaction'),
    },
    {
      event: 'agent:bootstrap',
      hookDir: join(SKILL_ROOT, 'runtimes/openclaw/hooks/agent-bootstrap'),
    },
  ])
  console.log('✅ Soul Keeper hooks registered with OpenClaw')
}

const target = args.runtime ?? 'auto'

if (target === 'claude-code') {
  installForClaudeCode()
} else if (target === 'openclaw') {
  installForOpenClaw()
} else if (target === 'both') {
  if (existsSync(ClaudeCodeRuntime.stateDir())) installForClaudeCode()
  if (existsSync(OpenClawRuntime.stateDir())) installForOpenClaw()
} else {
  // auto-detect: install where the runtime state dir exists
  if (existsSync(join(homedir(), '.openclaw'))) installForOpenClaw()
  if (existsSync(join(homedir(), '.claude'))) installForClaudeCode()
}

console.log('\nNext: Run `/soul setup` inside your agent to set your password.')
