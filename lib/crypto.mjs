import { CoseAlgorithm, decrypt, deriveKey, encrypt, parseEnvelope } from '#foc-encryption'

const CHUNKED_THRESHOLD_BYTES = 256 * 1024

export async function encryptBundle(plaintext, password) {
  const { cek, salt } = await deriveKey({ kind: 'password', password })

  const options =
    plaintext.byteLength > CHUNKED_THRESHOLD_BYTES
      ? { algorithm: CoseAlgorithm.CHUNKED_AES_256_GCM_STREAM, appMetadata: { salt } }
      : { algorithm: CoseAlgorithm.AES_256_GCM, appMetadata: { salt } }

  return await encrypt(plaintext, cek, options)
}

export async function decryptBundle(ciphertext, password) {
  const meta = parseEnvelope(ciphertext)
  const salt = meta.appMetadata?.salt
  if (!(salt instanceof Uint8Array)) {
    throw new Error('Envelope is missing salt in appMetadata; cannot derive key')
  }
  const { cek } = await deriveKey({ kind: 'password', password }, salt)
  return await decrypt(ciphertext, cek)
}
