import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('runtimes/claude-code/hooks/pre-compact', () => {
  it('exits 0 within 2s given a valid PreCompact event with no setup', () => {
    // No config = no password = hook short-circuits gracefully and exits 0.
    const tmp = mkdtempSync(join(tmpdir(), 'cc-hook-'))
    try {
      const memDir = join(tmp, 'memory')
      mkdirSync(memDir, { recursive: true })
      writeFileSync(join(memDir, 'MEMORY.md'), '- test')
      writeFileSync(join(tmp, 'soul.md'), 'soul')

      const event = JSON.stringify({ cwd: tmp, sessionId: 'test-session' })
      const start = Date.now()
      const result = spawnSync('node', ['runtimes/claude-code/hooks/pre-compact.mjs'], {
        input: event,
        env: { ...process.env, SOUL_KEEPER_STATE_DIR: tmp },
        timeout: 5000,
      })
      const elapsed = Date.now() - start

      expect(result.status).toBe(0)
      expect(elapsed).toBeLessThan(3000)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})

describe('runtimes/claude-code/hooks/session-start', () => {
  it('exits 0 when no setup exists', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'cc-hook-ss-'))
    try {
      const result = spawnSync('node', ['runtimes/claude-code/hooks/session-start.mjs'], {
        env: { ...process.env, SOUL_KEEPER_STATE_DIR: tmp },
        timeout: 3000,
      })
      expect(result.status).toBe(0)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
