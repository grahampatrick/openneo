import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // CLI entrypoints run side-effecting main() on import; covered via the
      // import/verify Definition-of-Done run, not unit tests.
      exclude: ['src/import.ts', 'src/verify.ts', 'src/fetch-sources.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
})
