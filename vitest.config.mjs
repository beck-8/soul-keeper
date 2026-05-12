import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.mjs'],
    exclude: ['test/e2e/**', 'node_modules/**'],
    testTimeout: 30_000,
    environment: 'node',
  },
})
