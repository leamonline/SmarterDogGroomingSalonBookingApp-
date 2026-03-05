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
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
