import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/smoke',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: 'list',
  outputDir: 'output/playwright/test-results',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'PORT=4173 JWT_SECRET=smoke-test-secret-123456789012345 CORS_ORIGIN=http://127.0.0.1:4173 npm start',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
