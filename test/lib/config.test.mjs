import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hasPassword, loadConfig, saveConfig } from '../../lib/config.mjs'

let tmp
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'sk-cfg-'))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe('lib/config', () => {
  it('loadConfig returns empty defaults when no file exists', async () => {
    const cfg = await loadConfig({ stateDir: tmp })
    expect(cfg.passwordHash).toBeUndefined()
    expect(cfg.network).toBe('calibration')
  })

  it('saveConfig persists and loadConfig retrieves', async () => {
    await saveConfig({ stateDir: tmp }, { passwordHash: 'abc', network: 'calibration' })
    const cfg = await loadConfig({ stateDir: tmp })
    expect(cfg.passwordHash).toBe('abc')
  })

  it('hasPassword reflects whether passwordHash is set', async () => {
    expect(await hasPassword({ stateDir: tmp })).toBe(false)
    await saveConfig({ stateDir: tmp }, { passwordHash: 'x' })
    expect(await hasPassword({ stateDir: tmp })).toBe(true)
  })
})
