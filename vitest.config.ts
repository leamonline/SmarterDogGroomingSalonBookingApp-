import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    // API tests only — no browser plugins needed
    include: ['test/api.test.ts'],
    pool: 'forks',
    // Vitest 4 moved pool-specific worker args to top-level test options.
    // Keep this explicit so forked workers don't inherit stray Node flags.
    execArgv: [],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    teardownTimeout: 10_000,
  },
});
