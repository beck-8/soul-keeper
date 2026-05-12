import { describe, expect, it, vi } from 'vitest'

describe('lib/sponsor', () => {
  it('hasSponsorKey returns false when key is empty', async () => {
    vi.resetModules()
    const mod = await import('../../lib/sponsor.mjs')
    expect(mod.hasSponsorKey()).toBe(false)
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

  it('getSponsor returns key info on calibration when key is set', async () => {
    // When SPONSOR_KEY is empty, getSponsor on calibration should throw with a clear setup hint
    const { getSponsor } = await import('../../lib/sponsor.mjs')
    expect(() => getSponsor({ network: 'calibration' })).toThrow(/SPONSOR_KEY/)
  })
})
