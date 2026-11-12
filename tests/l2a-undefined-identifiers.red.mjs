// tests/l2a-undefined-identifiers.red.mjs
// L2/D2 regression guard: registrasi dengan email belum terverifikasi tidak boleh
// menghasilkan ReferenceError / identifier undefined (dulu: `hasilMasup` di
// views-auth.js ~:334) dan harus masuk ke layar verifikasi OTP yang benar.
//
// Catatan: versi lama test ini menguji kartu "auth-email-check". UI itu bukan alur
// aktif lagi — registrasi kini langsung membuka mode OTP (#auth-otp) dengan email
// inline di .auth-otp-email. Assertion disesuaikan dengan perilaku nyata.
//
// Script Playwright mandiri (bukan node:test). Jalankan: node tests/l2a-undefined-identifiers.red.mjs
// Prasyarat: server lokal hidup di PORT (default 3000).
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = `http://localhost:${process.env.PORT || 3000}`;
const results = [];
const ev = { console: [], pageerror: [], requestfailed: [] };

function ok(cond, label, detail) {
  results.push({ label, pass: !!cond, detail: detail || '' });
  console.log(`${cond ? 'PASS' : 'FAIL'} | ${label}${detail ? ' | ' + detail : ''}`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') ev.console.push('[' + m.type() + '] ' + m.text()); });
page.on('pageerror', (e) => ev.pageerror.push(String(e)));
page.on('requestfailed', (r) => ev.requestfailed.push(r.url() + ' ' + r.failure().errorText));

const idJson = readFileSync(join(ROOT, 'assets/locales/id.json'), 'utf-8');
const enJson = readFileSync(join(ROOT, 'assets/locales/en.json'), 'utf-8');
await page.route('**/*.json', async (route) => {
  const u = route.request().url();
  if (u.includes('id.json')) { await route.fulfill({ status: 200, contentType: 'application/json', body: idJson }); return; }
  if (u.includes('en.json')) { await route.fulfill({ status: 200, contentType: 'application/json', body: enJson }); return; }
  await route.continue();
});

// Sign-up sukses tetapi belum terverifikasi + endpoint OTP sukses (keduanya mock).
await page.route('**/api/neon-auth/sign-up/email', (route) => route.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ token: null, user: { name: 'Test', email: 'undef@example.com', emailVerified: false } })
}));
await page.route('**/api/neon-auth/email-otp/**', (route) => route.fulfill({
  status: 200, contentType: 'application/json', body: JSON.stringify({ success: true })
}));

const tungguI18n = async (locale) => {
  for (let i = 0; i < 60; i += 1) {
    const siap = await page.evaluate(() => !!(window.MT && MT.i18n && MT.i18n.getLocale && MT.i18n.getLocale()));
    if (siap) break;
    await page.waitForTimeout(250);
  }
  if (locale) {
    await page.evaluate((l) => window.MT.i18n.setLocale(l), locale);
    for (let i = 0; i < 60; i += 1) {
      if (await page.evaluate((l) => MT.i18n.getLocale() === l, locale)) break;
      await page.waitForTimeout(250);
    }
  }
  await page.waitForTimeout(400);
};

// Toggle adalah mesin dua-mode: dari mode apa pun, satu klik mengembalikan ke login.
async function masukModeDaftar() {
  const modeSekarang = async () => page.evaluate(() => {
    const vis = (k) => { const e = document.querySelector('[data-auth-field="' + k + '"]'); return !!(e && !e.hidden); };
    if (vis('nama')) return 'register';
    if (vis('verifikasi-otp')) return 'otp';
    return 'login';
  });
  const toggle = page.locator('[data-auth-mode-toggle]').first();
  for (let i = 0; i < 4 && (await modeSekarang()) !== 'register'; i += 1) {
    if (!(await toggle.count())) break;
    await toggle.click();
    await page.waitForTimeout(350);
  }
}

async function doRegister(email) {
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' });
  await tungguI18n(null);
  await masukModeDaftar();
  await page.fill('#auth-name', 'Test User');
  await page.fill('#auth-email', email);
  await page.fill('#auth-password', 'SuperSecret1');
  const konfirmasi = page.locator('#auth-password-confirm');
  if ((await konfirmasi.count()) && (await konfirmasi.isVisible())) await konfirmasi.fill('SuperSecret1');
  await page.click('#auth-submit');
  await page.waitForTimeout(2000);
}

async function otpState() {
  return page.evaluate(() => {
    const txt = (sel) => document.querySelector(sel)?.textContent?.trim() ?? null;
    const vis = (sel) => { const e = document.querySelector(sel); return !!(e && !e.hidden && e.offsetParent !== null); };
    const alert = document.getElementById('auth-alert');
    return {
      otpFieldVisible: vis('#auth-otp'),
      otpEmailText: txt('.auth-otp-email'),
      resendVisible: vis('#auth-resend-otp'),
      heading: txt('[data-auth-heading]'),
      submitLabel: txt('#auth-submit'),
      alertVisible: vis('#auth-alert'),
      alertText: alert ? alert.textContent.replace(/\s+/g, ' ').trim() : null,
      rawObj: /\[object Object\]/.test(document.body.innerHTML),
      undefinedInHtml: /undefined/.test(document.body.innerHTML)
    };
  });
}

// ---- locale id ----------------------------------------------------------
await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' });
await tungguI18n('id');
await doRegister('undef-id@example.com');
const c1 = await otpState();
ok(c1.otpFieldVisible === true, 'L2a(id) layar OTP tampil', JSON.stringify(c1));
ok(c1.heading === 'Verifikasi email', 'L2a(id) judul OTP', 'got=' + c1.heading);
ok(typeof c1.otpEmailText === 'string' && c1.otpEmailText.includes('undef-id@example.com'), 'L2a(id) email ditampilkan', 'got=' + c1.otpEmailText);
ok(c1.submitLabel === 'Verifikasi kode', 'L2a(id) label submit', 'got=' + c1.submitLabel);
ok(c1.resendVisible === true, 'L2a(id) tombol kirim ulang tampil');
ok(c1.alertVisible === false, 'L2a(id) tidak ada alert galat', JSON.stringify(c1.alertText));
ok(c1.rawObj === false && c1.undefinedInHtml === false, 'L2a(id) tanpa [object Object] / undefined di DOM');

// ---- locale en ----------------------------------------------------------
await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' });
await tungguI18n('en');
await doRegister('undef-en@example.com');
const c2 = await otpState();
ok(c2.otpFieldVisible === true, 'L2a(en) OTP screen shown', JSON.stringify(c2));
ok(c2.heading === 'Verify email', 'L2a(en) OTP heading', 'got=' + c2.heading);
ok(typeof c2.otpEmailText === 'string' && c2.otpEmailText.includes('undef-en@example.com'), 'L2a(en) email shown', 'got=' + c2.otpEmailText);
ok(c2.alertVisible === false, 'L2a(en) no error alert', JSON.stringify(c2.alertText));
ok(c2.rawObj === false && c2.undefinedInHtml === false, 'L2a(en) no [object Object] / undefined in DOM');

// ---- regresi utama: tidak boleh ada ReferenceError / pageerror ---------
ok(ev.pageerror.length === 0, 'pageerror kosong (tidak ada ReferenceError hasilMasup)', JSON.stringify(ev.pageerror));

// ---- tidak boleh ada request yang gagal tak terduga --------------------
const gagalTidakTerduga = ev.requestfailed.filter((u) => !/favicon|\.map$/.test(u));
ok(gagalTidakTerduga.length === 0, 'tidak ada request gagal tak terduga', JSON.stringify(gagalTidakTerduga));

// ---- summary ------------------------------------------------------------
console.log('\n=== L2a RED TEST SUMMARY ===');
const fails = results.filter((r) => !r.pass);
console.log('Total: ' + results.length + ' | PASS: ' + (results.length - fails.length) + ' | FAIL: ' + fails.length);
for (const f of fails) console.log('FAIL | ' + f.label + ' | ' + f.detail);
await browser.close();
process.exit(fails.length === 0 ? 0 : 1);
