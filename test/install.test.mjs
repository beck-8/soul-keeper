import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

let tmp
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'sk-install-'))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe('install.mjs', () => {
  it('writes hooks to Claude Code settings.json', () => {
    mkdirSync(join(tmp, '.claude'), { recursive: true })
    const result = spawnSync('node', ['install.mjs', '--runtime=claude-code'], {
      env: { ...process.env, HOME: tmp, USERPROFILE: tmp },
      timeout: 10_000,
    })
    expect(result.status).toBe(0)

    const settingsPath = join(tmp, '.claude', 'settings.json')
    expect(existsSync(settingsPath)).toBe(true)
    const cfg = JSON.parse(readFileSync(settingsPath, 'utf8'))
    expect(cfg.hooks.PreCompact).toBeDefined()
    expect(cfg.hooks.PreCompact.length).toBeGreaterThan(0)
    expect(cfg.hooks.SessionStart).toBeDefined()
  })

  it('writes hooks to OpenClaw openclaw.json', () => {
    mkdirSync(join(tmp, '.openclaw'), { recursive: true })
    const result = spawnSync('node', ['install.mjs', '--runtime=openclaw'], {
      env: { ...process.env, HOME: tmp, USERPROFILE: tmp },
      timeout: 10_000,
    })
    expect(result.status).toBe(0)

    const cfgPath = join(tmp, '.openclaw', 'openclaw.json')
    expect(existsSync(cfgPath)).toBe(true)
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'))
    expect(cfg.hooks.mappings.before_compaction).toBeDefined()
    expect(cfg.hooks.mappings.before_compaction.length).toBeGreaterThan(0)
    expect(cfg.hooks.mappings['agent:bootstrap']).toBeDefined()
  })

  it('--runtime=both writes to both configs when both exist', () => {
    mkdirSync(join(tmp, '.claude'), { recursive: true })
    mkdirSync(join(tmp, '.openclaw'), { recursive: true })
    const result = spawnSync('node', ['install.mjs', '--runtime=both'], {
      env: { ...process.env, HOME: tmp, USERPROFILE: tmp },
      timeout: 10_000,
    })
    expect(result.status).toBe(0)
    expect(existsSync(join(tmp, '.claude', 'settings.json'))).toBe(true)
    expect(existsSync(join(tmp, '.openclaw', 'openclaw.json'))).toBe(true)
  })
})
