// playwright.config.js — Playwright E2E configuration for ManagenTugas.id
import { defineConfig } from '@playwright/test';

const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  // Suite ini menjalankan banyak browser terhadap satu server dev yang sama.
  // Dengan fullyParallel + worker tak terbatas, teardown context saling mengunci
  // (timeout 30s) sehingga test yang sehat ikut gagal. Batasi worker agar stabil.
  fullyParallel: true,
  workers: process.env.CI ? 1 : 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'list' : 'line',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  use: {
    baseURL: baseUrl,
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    // Screenshots on failure
    screenshot: 'only-on-failure',
    // Trace on failure
    trace: 'on-first-retry',
    // Video on failure
    video: 'retain-on-failure'
  },
  // Start the dev server during tests
  webServer: {
    command: process.env.NODE_ENV === 'production' ? 'npm start' : 'npm run dev',
    url: baseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
    env: {
      // Test environment variables
      NODE_ENV: 'test',
      EMAIL_PROVIDER: 'mock',
      RATE_LIMIT_BACKEND: 'memory'
    }
  },
  // Global setup — project is ESM ("type": "module"), so `require` is not available.
  globalSetup: './tests/e2e/global-setup.js'
});
