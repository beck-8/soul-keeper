import { describe, expect, it } from 'vitest'

describe('vendored foc-encryption', () => {
  it('imports without throwing', async () => {
    const mod = await import('#foc-encryption')
    expect(mod).toBeDefined()
    expect(Object.keys(mod).length).toBeGreaterThan(0)
  })
})
