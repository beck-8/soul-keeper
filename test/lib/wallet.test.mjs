import { describe, expect, it } from 'vitest'
import { deriveAesKey, deriveAll, deriveSessionKey } from '../../lib/wallet.mjs'

describe('lib/wallet', () => {
  it('deriveAesKey is deterministic', async () => {
    const a = await deriveAesKey('hunter2')
    const b = await deriveAesKey('hunter2')
    expect(a).toEqual(b)
    expect(a.byteLength).toBe(32)
  })

  it('different passwords produce different AES keys', async () => {
    const a = await deriveAesKey('alpha')
    const b = await deriveAesKey('beta')
    expect(a).not.toEqual(b)
  })

  it('deriveSessionKey returns 32-byte hex EVM private key', async () => {
    const sk = await deriveSessionKey('hunter2')
    expect(sk).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('AES key and session key for same password are different', async () => {
    const aes = await deriveAesKey('hunter2')
    const sk = await deriveSessionKey('hunter2')
    const aesHex = `0x${Buffer.from(aes).toString('hex')}`
    expect(aesHex).not.toBe(sk)
  })

  it('deriveAll returns AES key, session private key, and EVM address', async () => {
    const all = await deriveAll('hunter2')
    expect(all.aesKey.byteLength).toBe(32)
    expect(all.sessionPrivateKey).toMatch(/^0x[0-9a-f]{64}$/)
    expect(all.sessionAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })

  it('deriveAll on same password produces same EVM address', async () => {
    const a = await deriveAll('hunter2')
    const b = await deriveAll('hunter2')
    expect(a.sessionAddress).toBe(b.sessionAddress)
  })
})
