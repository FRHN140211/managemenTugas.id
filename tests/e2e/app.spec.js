// tests/e2e/app.spec.js — E2E untuk ManagenTugas.id (SPA hash-routing).
//
// Aplikasi nyata: satu dokumen `index.html` yang menyajikan dua view —
//   #view-auth (layar masuk / daftar / OTP)  dan  #view-app (shell aplikasi).
// Rute aplikasi memakai hash: #/dashboard, #/tugas, #/laporan, #/pengingat,
// #/pengguna, #/aktivitas. Path seperti /login atau /dashboard TIDAK ada di server.
//
// Semua assertion di bawah hanya memakai perilaku yang benar-benar disajikan
// aplikasi. Tidak ada kredensial nyata: alur Neon Auth di-mock lewat route
// interception, sesuai pola yang sudah dipakai suite lain di repo ini.
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

// Tunggu i18n selesai init (klik toggle sebelum init tidak mengganti mode).
async function tungguSiap(page) {
  await page.waitForFunction(() => !!(window.MT && MT.i18n && MT.i18n.getLocale && MT.i18n.getLocale()), null, { timeout: 15000 });
}

test.describe('ManagenTugas.id — shell & auth', () => {
  test('root menyajikan aplikasi dengan judul yang benar', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/ManagenTugas\.id|Masuk/i);
    await expect(page.locator('#view-auth')).toBeVisible();
  });

  test('layar masuk menampilkan form lengkap', async ({ page }) => {
    await page.goto(BASE_URL + '/#/login', { waitUntil: 'domcontentloaded' });
    await tungguSiap(page);
    await expect(page.locator('#auth-form')).toBeVisible();
    await expect(page.locator('#auth-email')).toBeVisible();
    await expect(page.locator('#auth-password')).toBeVisible();
    await expect(page.locator('#auth-submit')).toBeVisible();
    await expect(page.locator('[data-auth-heading]')).toBeVisible();
  });

  test('toggle berpindah ke mode daftar dan menampilkan field konfirmasi', async ({ page }) => {
    await page.goto(BASE_URL + '/#/login', { waitUntil: 'domcontentloaded' });
    await tungguSiap(page);
    await expect(page.locator('[data-auth-field="nama"]')).toBeHidden();

    await page.click('[data-auth-mode-toggle]');
    await expect(page.locator('[data-auth-field="nama"]')).toBeVisible();
    await expect(page.locator('#auth-password-confirm')).toBeVisible();
  });

  test('submit form kosong memunculkan validasi, bukan navigasi', async ({ page }) => {
    await page.goto(BASE_URL + '/#/login', { waitUntil: 'domcontentloaded' });
    await tungguSiap(page);
    await page.fill('#auth-email', '');
    await page.fill('#auth-password', '');
    await page.click('#auth-submit');
    // Tetap di dokumen yang sama dan form masih terlihat.
    await expect(page.locator('#auth-form')).toBeVisible();
    await expect(page.locator('#view-auth')).toBeVisible();
  });

  test('registrasi dengan email tak terverifikasi membuka layar OTP', async ({ page }) => {
    await page.route('**/api/neon-auth/sign-up/email', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: null, user: { name: 'E2E User', email: 'e2e@example.com', emailVerified: false } })
    }));
    await page.route('**/api/neon-auth/email-otp/**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true })
    }));

    await page.goto(BASE_URL + '/#/login', { waitUntil: 'domcontentloaded' });
    await tungguSiap(page);
    await page.click('[data-auth-mode-toggle]');
    await page.waitForTimeout(300);
    await page.fill('#auth-name', 'E2E User');
    await page.fill('#auth-email', 'e2e@example.com');
    await page.fill('#auth-password', 'SuperSecret1');
    await page.fill('#auth-password-confirm', 'SuperSecret1');
    await page.click('#auth-submit');

    await expect(page.locator('#auth-otp')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.auth-otp-email')).toContainText('e2e@example.com');
    await expect(page.locator('#auth-resend-otp')).toBeVisible();
    // Tidak ada error halaman (regresi identifier undefined).
    await expect(page.locator('body')).not.toContainText('[object Object]');
  });

  test('tidak ada console error kritis saat memuat halaman', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(String(err)));

    await page.goto(BASE_URL + '/#/login', { waitUntil: 'networkidle' });
    await tungguSiap(page);
    await page.waitForTimeout(1000);

    const kritis = errors.filter((e) =>
      !/favicon|sandbox|ERR_INTERNET_DISCONNECTED|Failed to load resource/i.test(e));
    expect(kritis, 'console errors: ' + JSON.stringify(kritis)).toHaveLength(0);
  });

  test('shell aplikasi tetap tersembunyi sebelum login', async ({ page }) => {
    await page.goto(BASE_URL + '/#/dashboard', { waitUntil: 'domcontentloaded' });
    await tungguSiap(page);
    // Tanpa sesi, rute aplikasi tidak boleh membuka shell.
    await expect(page.locator('#view-app')).toBeHidden();
  });

  test('halaman offline tersedia', async ({ request }) => {
    const res = await request.get(BASE_URL + '/offline.html');
    expect(res.status()).toBe(200);
  });

  test('endpoint health publik merespons JSON', async ({ request }) => {
    const res = await request.get(BASE_URL + '/api/health');
    // 200 = sehat, 503 = DB tidak tersedia, 429 = rate limit suite (memory backend).
    expect([200, 429, 503]).toContain(res.status());
    expect(res.headers()['content-type']).toContain('application/json');
  });
});
