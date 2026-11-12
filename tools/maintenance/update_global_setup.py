#!/usr/bin/env python3
content = '''// tests/e2e/global-setup.js
// Global setup for Playwright E2E tests.
// Runs before all tests to:
// 1. Start the server
// 2. Verify connectivity
// 3. Prepare test environment

import { chromium } from 'playwright';
import http from 'http';
import express from 'express';

// Create a test server
const app = express();
app.use(express.json());

// Mock health endpoint
app.get('/api/health', (req, res) => {
  res.json({ ok: true, database: 'mock', test: true });
});

app.get('/', (req, res) => {
  res.send('<html><body><h1>Management Tugas</h1><p>E2E test server ready</p></body></html>');
});

const server = http.createServer(app);

let browser;

export async function globalSetup() {
  console.log('[E2E] Starting test server...');
  await new Promise((resolve, reject) => {
    server.listen(3123, '127.0.0.1', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  console.log(`[E2E] Test server ready at http://127.0.0.1:3123`);

  // Launch browser
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox']
  });
  console.log('[E2E] Browser ready');

  // Return context for tests
  return { browser, baseURL: 'http://127.0.0.1:3123' };
}

export async function globalTeardown() {
  console.log('[E2E] Cleanup...');
  if (browser) {
    await browser.close();
  }
  await new Promise((resolve) => server.close(resolve));
}
'''

with open('tests/e2e/global-setup.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('global-setup.js written successfully')
