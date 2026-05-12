import { webcrypto } from 'node:crypto'
import { privateKeyToAccount } from 'viem/accounts'

const PBKDF2_ITERS = 600_000
const SALT_AES = 'soul-keeper-aes-v1'
const SALT_SESSION = 'soul-keeper-session-v1'

async function pbkdf2(password, saltStr, lengthBytes) {
  const encoder = new TextEncoder()
  const baseKey = await webcrypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  )
  const bits = await webcrypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(saltStr),
      iterations: PBKDF2_ITERS,
      hash: 'SHA-256',
    },
    baseKey,
    lengthBytes * 8,
  )
  return new Uint8Array(bits)
}

export async function deriveAesKey(password) {
  return await pbkdf2(password, SALT_AES, 32)
}

export async function deriveSessionKey(password) {
  const bytes = await pbkdf2(password, SALT_SESSION, 32)
  return `0x${Buffer.from(bytes).toString('hex')}`
}

export async function deriveAll(password) {
  const aesKey = await deriveAesKey(password)
  const sessionPrivateKey = await deriveSessionKey(password)
  const account = privateKeyToAccount(sessionPrivateKey)
  return {
    aesKey,
    sessionPrivateKey,
    sessionAddress: account.address,
  }
}
