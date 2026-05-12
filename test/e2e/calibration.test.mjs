import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { createBundle, extractBundle } from '../../lib/bundle.mjs'
import { decryptBundle, encryptBundle } from '../../lib/crypto.mjs'
import { downloadBundle, loginUserSessionKey, uploadBundle } from '../../lib/foc.mjs'
import { getSponsor, hasSponsorKey } from '../../lib/sponsor.mjs'
import { deriveAll } from '../../lib/wallet.mjs'

const SKIP = !hasSponsorKey()

describe.skipIf(SKIP)('e2e: Calibration round trip', () => {
  let tmp
  let sources

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'sk-e2e-'))
    mkdirSync(join(tmp, 'memory'))
    writeFileSync(join(tmp, 'memory', 'MEMORY.md'), `- e2e fact ${Date.now()}`)
    writeFileSync(join(tmp, 'soul.md'), `# I am a test soul ${Date.now()}`)
    sources = [join(tmp, 'memory'), join(tmp, 'soul.md')]
  })

  it('backup → upload to FOC → download → decrypt → restore matches', async () => {
    const password = `e2e-test-pw-${Date.now()}`
    const { sessionPrivateKey, sessionAddress } = await deriveAll(password)
    const sponsor = getSponsor({ network: 'calibration' })

    // One-time: authorize this session key on chain so Synapse.create accepts it
    console.log('Authorizing session key on-chain (this can take ~30s)...')
    await loginUserSessionKey({
      sponsorKey: sponsor.privateKey,
      userSessionAddress: sessionAddress,
      rpcUrl: sponsor.rpcUrl,
    })

    // 1. Bundle source files
    const { bytes: bundleBytes, manifest } = await createBundle({
      sources,
      baseDir: tmp,
      scope: ['memory', 'soul'],
    })
    expect(manifest.files.length).toBeGreaterThan(0)

    // 2. Encrypt
    const encrypted = await encryptBundle(bundleBytes, password)

    // 3. Upload to FOC (1-2 min)
    console.log(`Uploading ${encrypted.length} bytes to FOC...`)
    const { pieceCid } = await uploadBundle({
      bytes: encrypted,
      sponsorKey: sponsor.privateKey,
      sessionPrivateKey,
      rpcUrl: sponsor.rpcUrl,
    })
    expect(pieceCid).toMatch(/^baga6ea4/)
    console.log(`Uploaded PieceCID: ${pieceCid}`)

    // 4. Download back
    console.log('Downloading from FOC...')
    const downloaded = await downloadBundle({
      pieceCid,
      sponsorKey: sponsor.privateKey,
      sessionPrivateKey,
      rpcUrl: sponsor.rpcUrl,
    })

    // 5. Decrypt
    const decrypted = await decryptBundle(downloaded, password)
    expect(decrypted).toEqual(bundleBytes)

    // 6. Extract and verify
    const out = mkdtempSync(join(tmpdir(), 'sk-e2e-out-'))
    try {
      await extractBundle(decrypted, out)
      expect(existsSync(join(out, 'memory', 'MEMORY.md'))).toBe(true)
      expect(readFileSync(join(out, 'memory', 'MEMORY.md'), 'utf8')).toMatch(/e2e fact/)
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  }, 300_000) // 5 min timeout for real FOC roundtrip
})
