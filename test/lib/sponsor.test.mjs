import { describe, expect, it } from 'vitest'

describe('lib/sponsor', () => {
  it('hasSponsorKey returns true once key is configured', async () => {
    const mod = await import('../../lib/sponsor.mjs')
    expect(mod.hasSponsorKey()).toBe(true)
  })

  it('SPONSOR_LIMITS exposes rate and lockup allowances', async () => {
    const { SPONSOR_LIMITS } = await import('../../lib/sponsor.mjs')
    expect(typeof SPONSOR_LIMITS.rateAllowance).toBe('bigint')
    expect(typeof SPONSOR_LIMITS.lockupAllowance).toBe('bigint')
    expect(SPONSOR_LIMITS.lockupAllowance).toBeGreaterThan(0n)
  })

  it('getSponsor throws if network is mainnet', async () => {
    const { getSponsor } = await import('../../lib/sponsor.mjs')
    expect(() => getSponsor({ network: 'mainnet' })).toThrow(/calibration/i)
  })

  it('getSponsor returns key info on calibration', async () => {
    const { getSponsor } = await import('../../lib/sponsor.mjs')
    const s = getSponsor({ network: 'calibration' })
    expect(s.network).toBe('calibration')
    expect(s.rpcUrl).toMatch(/calibration/i)
    expect(s.privateKey).toMatch(/^0x[0-9a-f]{64}$/i)
    expect(s.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })
})
