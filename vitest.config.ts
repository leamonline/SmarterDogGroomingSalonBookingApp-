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
    pool: 'forks',
    poolOptions: {
      forks: {
        // iCloud Drive paths can slow native-module loading; give workers more time
        execArgv: [],
      },
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
    teardownTimeout: 10_000,
  },
});
