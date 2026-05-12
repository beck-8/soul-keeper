import { describe, expect, it } from 'vitest'
import { decryptBundle, encryptBundle } from '../../lib/crypto.mjs'

describe('lib/crypto', () => {
  it('encrypts then decrypts to identical bytes', async () => {
    const plaintext = new TextEncoder().encode('hello soul world')
    const ciphertext = await encryptBundle(plaintext, 'pw123')
    expect(ciphertext.length).toBeGreaterThan(plaintext.length)
    const decrypted = await decryptBundle(ciphertext, 'pw123')
    expect(new TextDecoder().decode(decrypted)).toBe('hello soul world')
  })

  it('wrong password throws auth failure', async () => {
    const plaintext = new TextEncoder().encode('secret stuff')
    const ciphertext = await encryptBundle(plaintext, 'right-pw')
    await expect(decryptBundle(ciphertext, 'wrong-pw')).rejects.toThrow()
  })

  it('handles empty bundle', async () => {
    const ciphertext = await encryptBundle(new Uint8Array(0), 'pw')
    const decrypted = await decryptBundle(ciphertext, 'pw')
    expect(decrypted.byteLength).toBe(0)
  })

  it('handles large bundle (>256 KiB triggers chunked path)', async () => {
    const big = new Uint8Array(300 * 1024)
    for (let i = 0; i < big.length; i++) big[i] = i & 0xff
    const ciphertext = await encryptBundle(big, 'pw')
    const decrypted = await decryptBundle(ciphertext, 'pw')
    expect(decrypted).toEqual(big)
  })
})
