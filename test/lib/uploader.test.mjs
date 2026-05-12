import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const uploadBundleMock = vi.fn().mockResolvedValue({ pieceCid: 'baga-success', copies: [] })
vi.mock('../../lib/foc.mjs', () => ({ uploadBundle: uploadBundleMock }))

let tmp
beforeEach(() => {
  vi.clearAllMocks()
  uploadBundleMock.mockResolvedValue({ pieceCid: 'baga-success', copies: [] })
  tmp = mkdtempSync(join(tmpdir(), 'sk-up-'))
})

describe('lib/uploader', () => {
  it('uploads a pending snapshot and updates status to uploaded', async () => {
    const { processOnce } = await import('../../lib/uploader.mjs')
    const { addSnapshot, getSnapshot } = await import('../../lib/index-store.mjs')

    mkdirSync(join(tmp, 'soul-keeper', 'pending'), { recursive: true })
    writeFileSync(join(tmp, 'soul-keeper', 'pending', 's1.enc'), 'encrypted-bytes')
    await addSnapshot(
      { stateDir: tmp },
      {
        id: 's1',
        createdAt: 'x',
        trigger: 'manual',
        scope: [],
        localPath: 'pending/s1.enc',
        sizeBytes: 15,
        sha256: '',
        status: 'pending',
      },
    )

    await processOnce({
      stateDir: tmp,
      sponsorKey: `0x${'11'.repeat(32)}`,
      sessionPrivateKey: `0x${'22'.repeat(32)}`,
      rpcUrl: 'https://rpc',
    })

    const snap = await getSnapshot({ stateDir: tmp }, 's1')
    expect(snap.status).toBe('uploaded')
    expect(snap.cid).toBe('baga-success')
    expect(snap.uploadedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(uploadBundleMock).toHaveBeenCalledOnce()
  })

  it('marks snapshot failed on upload error and increments attempts', async () => {
    uploadBundleMock.mockRejectedValueOnce(new Error('rpc timeout'))
    const { processOnce } = await import('../../lib/uploader.mjs')
    const { addSnapshot, getSnapshot } = await import('../../lib/index-store.mjs')

    mkdirSync(join(tmp, 'soul-keeper', 'pending'), { recursive: true })
    writeFileSync(join(tmp, 'soul-keeper', 'pending', 's2.enc'), 'x')
    await addSnapshot(
      { stateDir: tmp },
      {
        id: 's2',
        createdAt: 'x',
        trigger: 'manual',
        scope: [],
        localPath: 'pending/s2.enc',
        sizeBytes: 1,
        sha256: '',
        status: 'pending',
      },
    )

    await processOnce({
      stateDir: tmp,
      sponsorKey: `0x${'11'.repeat(32)}`,
      sessionPrivateKey: `0x${'22'.repeat(32)}`,
      rpcUrl: 'https://rpc',
    })

    const snap = await getSnapshot({ stateDir: tmp }, 's2')
    expect(snap.status).toBe('failed')
    expect(snap.lastError).toMatch(/rpc timeout/)
    expect(snap.uploadAttempts).toBe(1)
  })

  it('retries previously-failed snapshots', async () => {
    const { processOnce } = await import('../../lib/uploader.mjs')
    const { addSnapshot, getSnapshot } = await import('../../lib/index-store.mjs')

    mkdirSync(join(tmp, 'soul-keeper', 'pending'), { recursive: true })
    writeFileSync(join(tmp, 'soul-keeper', 'pending', 's3.enc'), 'data')
    await addSnapshot(
      { stateDir: tmp },
      {
        id: 's3',
        createdAt: 'x',
        trigger: 'manual',
        scope: [],
        localPath: 'pending/s3.enc',
        sizeBytes: 4,
        sha256: '',
        status: 'failed',
        uploadAttempts: 2,
        lastError: 'previous',
      },
    )

    await processOnce({
      stateDir: tmp,
      sponsorKey: `0x${'11'.repeat(32)}`,
      sessionPrivateKey: `0x${'22'.repeat(32)}`,
      rpcUrl: 'https://rpc',
    })

    const snap = await getSnapshot({ stateDir: tmp }, 's3')
    expect(snap.status).toBe('uploaded')
    expect(snap.uploadAttempts).toBe(3)
  })

  it('skips already-uploaded snapshots', async () => {
    const { processOnce } = await import('../../lib/uploader.mjs')
    const { addSnapshot } = await import('../../lib/index-store.mjs')

    await addSnapshot(
      { stateDir: tmp },
      {
        id: 's4',
        createdAt: 'x',
        trigger: 'manual',
        scope: [],
        localPath: 'pending/s4.enc',
        sizeBytes: 0,
        sha256: '',
        status: 'uploaded',
        cid: 'already-done',
      },
    )

    await processOnce({
      stateDir: tmp,
      sponsorKey: `0x${'11'.repeat(32)}`,
      sessionPrivateKey: `0x${'22'.repeat(32)}`,
      rpcUrl: 'https://rpc',
    })

    expect(uploadBundleMock).not.toHaveBeenCalled()
  })
})
