import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addSnapshot, getSnapshot, listSnapshots, updateSnapshot } from '../../lib/index-store.mjs'

let tmp
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'sk-idx-'))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe('lib/index-store', () => {
  it('addSnapshot persists and listSnapshots retrieves', async () => {
    await addSnapshot(
      { stateDir: tmp },
      {
        id: 's1',
        createdAt: '2026-05-12T00:00:00Z',
        trigger: 'manual',
        scope: ['memory'],
        localPath: 'pending/s1.enc',
        sizeBytes: 100,
        sha256: 'aa',
        status: 'pending',
      },
    )
    const all = await listSnapshots({ stateDir: tmp })
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe('s1')
  })

  it('updateSnapshot merges patch fields', async () => {
    await addSnapshot(
      { stateDir: tmp },
      {
        id: 's1',
        createdAt: 'x',
        trigger: 'manual',
        scope: [],
        localPath: 'p',
        sizeBytes: 0,
        sha256: '',
        status: 'pending',
      },
    )
    await updateSnapshot({ stateDir: tmp }, 's1', { status: 'uploaded', cid: 'baga...' })
    const snap = await getSnapshot({ stateDir: tmp }, 's1')
    expect(snap.status).toBe('uploaded')
    expect(snap.cid).toBe('baga...')
  })

  it('listSnapshots returns empty array when index missing', async () => {
    expect(await listSnapshots({ stateDir: tmp })).toEqual([])
  })

  it('getSnapshot returns undefined for unknown id', async () => {
    expect(await getSnapshot({ stateDir: tmp }, 'missing')).toBeUndefined()
  })
})
