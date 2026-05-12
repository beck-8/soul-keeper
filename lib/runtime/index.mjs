import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { ClaudeCodeRuntime } from './claude-code.mjs'
import { OpenClawRuntime } from './openclaw.mjs'

export function detectRuntime() {
  const forced = process.env.SOUL_KEEPER_RUNTIME
  if (forced === 'claude-code') return ClaudeCodeRuntime
  if (forced === 'openclaw') return OpenClawRuntime

  if (existsSync(join(homedir(), '.openclaw'))) return OpenClawRuntime
  if (existsSync(join(homedir(), '.claude'))) return ClaudeCodeRuntime

  throw new Error('No supported agent runtime detected. Install Claude Code or OpenClaw first.')
}

export { ClaudeCodeRuntime, OpenClawRuntime }
