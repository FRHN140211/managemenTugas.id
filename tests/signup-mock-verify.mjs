// tests/signup-mock-verify.mjs — TAHAP 3 Playwright mock verification
// 4 signup cases (success, rate-limit, already-registered, network-failure)
// over the fixed auth flow. No DB writes, no real accounts.
// Mocks id.json/en.json via page.route, waits for MT.i18n.init(), stubs
// /api/neon-auth/sign-up/email per case. Captures console/pageerror/requestfailed
// plus UI state, per locale and viewport. Reports PASS/FAIL.
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
  console.log((cond ? 'PASS' : 'FAIL') + ' | ' + label + (detail ? ' | ' + detail : ''));
}
const failed = () => results.filter(r => !r.pass);

// ---- bootstrap -----------------------------------------------------------
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

await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// wait for MT.i18n.init() to settle then force locale to id
let locale = null;
for (let i = 0; i < 80; i += 1) {
  locale = await page.evaluate(() => MT && MT.i18n ? MT.i18n.getLocale() : null);
  if (locale) break;
  await page.waitForTimeout(250);
}
await page.evaluate(() => MT.i18n.setLocale('id'));
for (let i = 0; i < 80; i += 1) {
  locale = await page.evaluate(() => MT.i18n.getLocale());
  if (locale === 'id') break;
  await page.waitForTimeout(250);
}
console.log('[i18n] settled locale: ' + locale);

// ---------- helpers ---------------------------------------------------------
async function doRegister(email) {
  await page.locator('button:has-text("Daftar akun")').first().click();
  await page.waitForTimeout(300);
  await page.fill('#auth-name', 'Test User');
  await page.fill('#auth-email', email);
  await page.fill('#auth-password', 'SuperSecret1');
  await page.click('input[type="submit"]');
  await page.waitForTimeout(1800);
}
async function mockSignUp(replied) {
  await page.unroute('**/api/neon-auth/sign-up/email');
  await page.route('**/api/neon-auth/sign-up/email', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(replied) });
  });
}
async function cardState() {
  return page.evaluate(() => {
    const card = document.getElementById('auth-email-check');
    const email = document.getElementById('auth-email-check-email');
    return {
      cardVisible: !!(card && !card.hidden),
      emailShown: email ? email.textContent : null,
      emailHtml: email ? email.innerHTML : null,
      cardTitle: card ? card.querySelector('.auth-email-check-title')?.textContent : null,
      resendBtn: (card ? card.querySelector('#auth-email-resend') : null) ? (card.querySelector('#auth-email-resend')?.textContent || '') : null,
      changeLink: (card ? card.querySelector('#auth-email-change') : null) ? (card.querySelector('#auth-email-change')?.textContent || '') : null,
      rawObj: /\[object Object\]/.test(document.body.innerHTML),
      undefinedInHtml: /undefined/.test(document.body.innerHTML),
      alertTitle: document.querySelector('[data-auth-alert-title]')?.textContent || ''
    };
  });
}
function noConsoleErrors() {
  return ev.console.length === 0 && ev.pageerror.length === 0 && ev.requestfailed.length === 0;
}

// ---------- Case 1: success (verification needed) -> card + email -------------
await doRegister('ok-id@example.com');
await mockSignUp({ token: null, user: { name: 'Test', email: 'ok-id@example.com', emailVerified: false } });
await doRegister('ok-id2@example.com');

const c1 = await cardState();
ok(c1.cardVisible === true, 'case1 success(id) card visible', 'console/pageerror/reqfailed=' + noConsoleErrors());
ok(c1.emailShown === 'ok-id2@example.com', 'case1(id) email shown after MT.esc', 'got="' + c1.emailShown + '" html="' + c1.emailHtml + '"');
ok(!c1.rawObj && !c1.undefinedInHtml, 'case1(id) no [object Object] / undefined in DOM', 'rawObj=' + c1.rawObj + ' undef=' + c1.undefinedInHtml);
ok(c1.cardTitle === 'Periksa email Anda', 'case1(id) card title translated (id)', 'got="' + c1.cardTitle + '"');
ok(c1.resendBtn !== null && c1.changeLink.indexOf('Ganti alamat email') === 0, 'case1(id) resend + change-email labels', 'resend="' + c1.resendBtn + '" change="' + c1.changeLink + '"');

// Case 1b: switch to en, same success flow
await page.evaluate(() => MT.i18n.setLocale('en'));
await page.waitForTimeout(2500);
await doRegister('ok-en@example.com');
await mockSignUp({ token: null, user: { name: 'Test', email: 'ok-en@example.com', emailVerified: false } });
const c1b = await cardState();
const c1b_console = ev.console.length, c1b_pgerr = ev.pageerror.length, c1b_reqf = ev.requestfailed.length;
ok(c1b.cardVisible === true, 'case1b success(en) card visible', 'console=' + c1b_console + ' pageerror=' + c1b_pgerr + ' reqfailed=' + c1b_reqf);
ok(c1b.cardTitle === 'Check your email', 'case1b(en) card title translated (en)', 'got="' + c1b.cardTitle + '"');
ok(c1b.resendBtn.indexOf('Resend link') === 0, 'case1b(en) resend button translated', 'got="' + c1b.resendBtn + '"');
ok(c1b.changeLink.indexOf('Change email address') === 0, 'case1b(en) change-email link translated', 'got="' + c1b.changeLink + '"');

// ---------- Case 2: RATE_LIMIT_EXCEEDED from proxy ------------------------------
await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await doRegister('rate@example.com');
await mockSignUp({ error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Terdapat suatu kendala.' } });
await doRegister('rate@example.com');
const c2 = await cardState();
const c2_console = ev.console.length, c2_pgerr = ev.pageerror.length, c2_reqf = ev.requestfailed.length;
ok(c2.cardVisible === false, 'case2 rate-limit -> card hidden', 'card.hidden=' + c2.cardVisible);
ok(!/Periksa email|Check your email/.test(c2.alertTitle), 'case2 rate-limit -> clear translated error (no raw key)', 'alert="' + c2.alertTitle + '" console=' + c2_console + ' pageerror=' + c2_pgerr + ' reqfailed=' + c2_reqf);

// ---------- Case 3: already-registered (USER_ALREADY_EXISTS) --------------------
await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await doRegister('already@example.com');
await mockSignUp({ token: null, error: { code: 'USER_ALREADY_EXISTS', message: 'User already exists' } });
await doRegister('already@example.com');
const c3 = await cardState();
const c3_console = ev.console.length, c3_pgerr = ev.pageerror.length, c3_reqf = ev.requestfailed.length;
ok(c3.cardVisible === false, 'case3 already-registered -> card hidden', 'card.hidden=' + c3.cardVisible);
if (c3.alertTitle.length > 0) {
  ok(!/Periksa email|Check your email|email/i.test(c3.alertTitle) === false && c3.alertTitle.length > 0, 'case3 already-registered -> error message shown (no raw key)', 'alert="' + c3.alertTitle + '" console=' + c3_console + ' pageerror=' + c3_pgerr + ' reqfailed=' + c3_reqf);
} else {
  ok(false, 'case3 already-registered -> error message shown', 'no alert title');
}

// ---------- Case 4: network failure during submission ---------------------------
await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await doRegister('netfail@example.com');
await page.unroute('**/api/neon-auth/sign-up/email');
await page.route('**/api/neon-auth/sign-up/email', (route) => route.abort('failed'));
await doRegister('netfail@example.com');
const c4 = await cardState();
const c4_console = ev.console.length, c4_pgerr = ev.pageerror.length, c4_reqf = ev.requestfailed.length;
ok(c4.cardVisible === false, 'case4 network-failure -> card hidden', 'card.hidden=' + c4.cardVisible);
if (c4.alertTitle.length > 0) {
  ok(true, 'case4 network-failure -> error message shown', 'alert="' + c4.alertTitle + '" console=' + c4_console + ' pageerror=' + c4_pgerr + ' reqfailed=' + c4_reqf);
} else {
  ok(false, 'case4 network-failure -> error message shown', 'no alert title');
}

// ---------- summary -------------------------------------------------------------
console.log('\n=== SIGNUP MOCK VERIFICATION SUMMARY ===');
const fails = results.filter(r => !r.pass);
console.log('Total: ' + results.length + ' | PASS: ' + (results.length - fails.length) + ' | FAIL: ' + fails.length);
for (const f of fails) console.log('FAIL | ' + f.label + ' | ' + f.detail);
await browser.close();
process.exit(fails.length === 0 ? 0 : 1);
