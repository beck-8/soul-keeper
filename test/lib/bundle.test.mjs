import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createBundle, extractBundle } from '../../lib/bundle.mjs'

let workDir
beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'soul-bundle-'))
})
afterEach(() => {
  rmSync(workDir, { recursive: true, force: true })
})

describe('lib/bundle', () => {
  it('creates a bundle from files', async () => {
    const src = join(workDir, 'src')
    mkdirSync(src)
    writeFileSync(join(src, 'a.md'), 'hello')
    writeFileSync(join(src, 'b.md'), 'world')

    const { bytes, manifest } = await createBundle({
      sources: [join(src, 'a.md'), join(src, 'b.md')],
      baseDir: src,
    })

    expect(bytes.length).toBeGreaterThan(0)
    expect(manifest.files).toHaveLength(2)
    expect(manifest.files.map((f) => f.path).sort()).toEqual(['a.md', 'b.md'])
    expect(manifest.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('extracts a bundle losslessly', async () => {
    const src = join(workDir, 'src')
    mkdirSync(src)
    writeFileSync(join(src, 'memory.md'), 'persistent memory')

    const { bytes } = await createBundle({
      sources: [join(src, 'memory.md')],
      baseDir: src,
    })

    const out = join(workDir, 'out')
    mkdirSync(out)
    await extractBundle(bytes, out)
    expect(readFileSync(join(out, 'memory.md'), 'utf8')).toBe('persistent memory')
  })

  it('skips missing source files silently', async () => {
    const src = join(workDir, 'src')
    mkdirSync(src)
    writeFileSync(join(src, 'a.md'), 'present')

    const { manifest } = await createBundle({
      sources: [join(src, 'a.md'), join(src, 'missing.md')],
      baseDir: src,
    })
    expect(manifest.files).toHaveLength(1)
    expect(manifest.skipped).toContain(join(src, 'missing.md'))
  })

  it('handles directory sources by including all files', async () => {
    const src = join(workDir, 'src')
    mkdirSync(src)
    mkdirSync(join(src, 'memory'))
    writeFileSync(join(src, 'memory', 'one.md'), 'a')
    writeFileSync(join(src, 'memory', 'two.md'), 'b')

    const { manifest } = await createBundle({
      sources: [join(src, 'memory')],
      baseDir: src,
    })
    expect(manifest.files.map((f) => f.path).sort()).toEqual(['memory/one.md', 'memory/two.md'])
  })
})
