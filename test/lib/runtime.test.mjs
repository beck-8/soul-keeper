import { describe, expect, it } from 'vitest'
import { ClaudeCodeRuntime } from '../../lib/runtime/claude-code.mjs'
import { OpenClawRuntime } from '../../lib/runtime/openclaw.mjs'

describe('runtime: claude-code', () => {
  it('has name claude-code', () => {
    expect(ClaudeCodeRuntime.name).toBe('claude-code')
  })

  it('stateDir ends with .claude', () => {
    expect(ClaudeCodeRuntime.stateDir()).toMatch(/[\\/]\.claude$/)
  })

  it('configPath ends with settings.json', () => {
    expect(ClaudeCodeRuntime.configPath()).toMatch(/settings\.json$/)
  })

  it('defaultBackupSources includes a memory dir', () => {
    const sources = ClaudeCodeRuntime.defaultBackupSources(process.cwd())
    expect(sources.some((p) => p.includes('memory'))).toBe(true)
  })
})

describe('runtime: openclaw', () => {
  it('has name openclaw', () => {
    expect(OpenClawRuntime.name).toBe('openclaw')
  })

  it('stateDir ends with .openclaw', () => {
    expect(OpenClawRuntime.stateDir()).toMatch(/[\\/]\.openclaw$/)
  })

  it('configPath ends with openclaw.json', () => {
    expect(OpenClawRuntime.configPath()).toMatch(/openclaw\.json$/)
  })

  it('defaultBackupSources includes MEMORY.md and SOUL.md', () => {
    const sources = OpenClawRuntime.defaultBackupSources()
    expect(sources.some((p) => p.endsWith('MEMORY.md'))).toBe(true)
    expect(sources.some((p) => p.endsWith('SOUL.md'))).toBe(true)
  })
})
