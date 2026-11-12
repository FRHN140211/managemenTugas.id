// tests/otp-flow.mjs — mock-only Playwright verification of the OTP flow.
// USAGE: node tests/otp-flow.mjs <id|en> <375|1280> <out.json>
// 4 cases: id/en x 375/1280. Each: register -> otp screen -> wrong otp -> right otp
// -> resend -> login mode. Mock routes: id.json/en.json, /api/neon-auth sign-up,
// /api/neon-auth/email-otp verify+send. Reports PASS/FAIL per case.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = `http://localhost:${process.env.PORT || 3000}`;
const [locale, vw, outPath] = process.argv.slice(2);
let pass = 0, fail = 0;
const ev = { pageerror: [], consoleErr: [], requestfailed: [] };
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: Number(vw), height: 800 }, serviceWorkers: 'block' });
const page = await context.newPage();
page.on('pageerror', (e) => ev.pageerror.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') ev.consoleErr.push(m.text()); });
page.on('requestfailed', (r) => ev.requestfailed.push(r.url()));

// --- locale JSON mock ---
const localeJson = JSON.parse(readFileSync(join(ROOT, 'assets/locales', locale + '.json'), 'utf8'));
page.route('**/assets/locales/' + locale + '.json', (route) => route.fulfill({ body: JSON.stringify(localeJson) }));
// --- sign-up ---
page.route('**/api/neon-auth/sign-up/email', (route) => route.fulfill({ body: JSON.stringify({ user: { id: 'u1', name: 'Uji', email: 'uji@example.com', emailVerified: false } }) }));
// --- OTP verify (per-case stub) ---
page.route('**/api/neon-auth/email-otp/verify-email', async (route, request) => {
  const body = JSON.parse(await request.postData());
  if (body.otp === '999999') {
    return route.fulfill({ status: 400, body: JSON.stringify({ error: { message: 'Invalid code', code: 'INVALID_OTP', status: 400 } }) });
  }
  if (body.otp === 'expired') {
    return route.fulfill({ status: 400, body: JSON.stringify({ error: { message: 'Code expired', code: 'OTP_EXPIRED', status: 400 } }) });
  }
  if (body.otp === '123456') {
    return route.fulfill({ status: 200, body: JSON.stringify({ user: { id: 'u1', name: 'Uji', email: 'uji@example.com', emailVerified: true } }) });
  }
  return route.continue();
});
// --- resend ---
page.route('**/api/neon-auth/email-otp/send-verification-otp', (route) => route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) }));

const results = {};
try {
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const i18nOk = await page.evaluate(() => {
    try {
      const v = window.MT?.i18n?.t('auth.login_title');
      return typeof v === 'string' && v !== 'auth.login_title' && v.length > 1 && window.MT.i18n.getLocale() === locale;
    } catch (e) { return false; }
  });
  results.s1 = i18nOk;
  // S2 register
  await page.click('[data-auth-mode-toggle]');
  await page.waitForTimeout(400);
  await page.fill('#auth-name', 'Uji Tester');
  await page.fill('#auth-email', 'uji@example.com');
  await page.fill('#auth-password', 'TestPass123!');
  await page.fill('#auth-password-confirm', 'TestPass123!');
  await page.click('#auth-submit');
  await page.waitForTimeout(1200);
  const s2 = await page.evaluate(() => ({
    otpVisible: document.getElementById('auth-otp')?.hidden === false,
    resendVisible: document.getElementById('auth-resend-otp')?.hidden === false,
    emailShown: (document.querySelector('.auth-otp-email')?.textContent || '').includes('uji@example.com'),
    title: document.querySelector('[data-auth-heading]')?.textContent,
  }));
  results.s2 = s2;
  // S3 resend -> success message + countdown
  await page.click('#auth-resend-otp');
  await page.waitForTimeout(1200);
  const s3 = await page.evaluate(() => ({
    alert: document.querySelector('[role="alert"]')?.textContent || '',
    countdown: (document.getElementById('auth-otp-resend-countdown')?.textContent || '').trim(),
    btnDisabled: document.getElementById('auth-resend-otp')?.disabled || false,
  }));
  results.s3 = s3;
  // S4 wrong OTP -> error card; right OTP -> verifier response
  await page.fill('#auth-otp', '999999');
  await page.click('#auth-submit');
  await page.waitForTimeout(800);
  const s4Wrong = await page.evaluate(() => ({
    alert: document.querySelector('[role="alert"]')?.textContent || '',
  }));
  await page.fill('#auth-otp', '123456');
  await page.click('#auth-submit');
  await page.waitForTimeout(1500);
  const s4Right = await page.evaluate(() => {
    const otp = document.getElementById('auth-otp');
    const alert = document.querySelector('[role="alert"]');
    return {
      otpValue: otp ? otp.value : '',
      otpDisabled: otp ? otp.disabled : false,
      alert: alert ? alert.textContent : '',
      alertsVisible: !!alert,
      inputCleared: !otp || otp.value.trim() === '',
    };
  });
  results.s4 = { wrong: s4Wrong, right: s4Right };
  // S5 login mode still works
  await page.click('[data-auth-mode-toggle]');
  await page.waitForTimeout(500);
  const s5 = await page.evaluate(() => ({
    mode: document.querySelector('[data-auth-mode-toggle]')?.textContent.trim(),
    loginFields: document.getElementById('auth-form')?.querySelectorAll('input').length,
  }));
  results.s5 = s5;
  const ok = Object.entries(results).every(([, v]) => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'object') return Object.values(v).every(Boolean);
    return true;
  });
  console.log(JSON.stringify({ locale, viewport: Number(vw), results, ev, ok }));
} catch (e) {
  console.log(JSON.stringify({ locale, viewport: Number(vw), error: String(e), ev }));
} finally {
  await browser.close();
  writeFileSync(outPath, JSON.stringify({ locale, viewport: Number(vw), results, ok, ev }, null, 2));
  process.exit(ok ? 0 : 1);
}
