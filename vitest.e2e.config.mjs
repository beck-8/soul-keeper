import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/e2e/**/*.test.mjs'],
    testTimeout: 600_000,
    environment: 'node',
  },
})
