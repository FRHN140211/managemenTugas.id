// tests/e2e/global-setup.js
// Global setup for Playwright E2E tests.
// Playwright requires exactly one default-exported function.
// Catatan: aplikasi adalah SPA hash-routing yang disajikan server Express lewat
// `webServer` di playwright.config.js (default http://localhost:3000). Setup ini
// sengaja TIDAK menjalankan server mock kedua — cukup memastikan target hidup.

export default async function globalSetup() {
  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';
  console.log('[E2E] Verifying target at ' + baseUrl + ' ...');
  const res = await fetch(baseUrl, { method: 'GET' });
  if (!res.ok) {
    throw new Error('[E2E] Target ' + baseUrl + ' returned HTTP ' + res.status);
  }
  console.log('[E2E] Target ready (HTTP ' + res.status + ')');
}
