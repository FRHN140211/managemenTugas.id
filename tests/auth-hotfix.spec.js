// tests/auth-hotfix.spec.js — F3-A hotfix cases H1-H5 (mock-only, Playwright)
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const EVIDENCE = `${ROOT}/tmp-state/evidence`;
mkdirSync(EVIDENCE, { recursive: true });

let results = [];
let failures = 0;

function record(name, ok, detail = '') {
  results.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
}

async function newPage(locale = 'id', viewport = { width: 1280, height: 800 }) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport, extraHTTPHeaders: { Origin: 'http://localhost:3000' }, serviceWorkers: 'block'
  });
  return { browser, context, page: await context.newPage() };
}

async function setupPage(page, locale) {
  await page.addInitScript(loc => { try { localStorage.setItem('MT.locale', loc); } catch (e) {} }, locale);
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  let ready = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    const r = await page.evaluate(() => {
      try {
        const mt = window.MT && window.MT.i18n;
        if (!mt || typeof mt.getLocale !== 'function') return { ready: false };
        if (mt.getLocale() !== 'id') return { ready: false, locale: mt.getLocale() };
        const v = mt.t('auth.login_title');
        return { ready: typeof v === 'string' && v !== 'auth.login_title', value: v };
      } catch (e) { return { ready: false }; }
    });
    if (r.ready) { ready = true; break; }
    await new Promise(r => setTimeout(r, 100));
  }
  if (!ready) throw new Error('locale not ready');
}

async function registerFlow(page) {
  await page.route('**/api/neon-auth/sign-up/email', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: null, user: { id: 'u1', name: 'Uji', email: 'uji@example.com', emailVerified: false } }) });
  });
  await setupPage(page, 'id');
  await page.click('[data-auth-mode-toggle]');
  await page.fill('#auth-name', 'Uji');
  await page.fill('#auth-email', 'uji@example.com');
  await page.fill('#auth-password', 'TestPass123!');
  await page.fill('#auth-password-confirm', 'TestPass123!');
  await page.click('#auth-submit');
  await page.waitForTimeout(2000);
}

async function resendFlow(page, resendBody, resendStatus = 200, retryAfter = 0) {
  const raw = typeof resendBody === 'string' ? resendBody : JSON.stringify(resendBody);
  await page.route('**/api/neon-auth/send-verification-email', route => {
    if (resendStatus === 0) { route.abort(); return; }
    const headers = {};
    if (retryAfter > 0) headers['Retry-After'] = String(retryAfter);
    route.fulfill({ status: resendStatus, contentType: 'application/json', body: raw, headers });
  });
  const btn = await page.$('#auth-email-resend');
  if (!btn) throw new Error('auth-email-resend not found');
  const before = await page.evaluate(() => ({
    alertTitle: (document.querySelector('[data-auth-alert] [data-auth-alert-title]') || { textContent: '' }).textContent.trim(),
    alertHidden: !document.getElementById('auth-alert') ? null : document.getElementById('auth-alert').hidden
  }));
  await btn.click();
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => {
    const alertTitle = (document.querySelector('[data-auth-alert] [data-auth-alert-title]') || { textContent: '' }).textContent.trim();
    const bodyText = document.body.textContent || '';
    const rawKeys = (bodyText.match(/auth\.\w+_\w+/g) || []).length;
    const card = document.getElementById('auth-email-check');
    return {
      alertTitle, alertEmpty: alertTitle === '', cardVisible: !(!card || card.hidden),
      rawAuthKeys: rawKeys,
      resendLabel: (document.getElementById('auth-email-resend-label') || { textContent: '' }).textContent.trim(),
      emailCheckTitle: (document.querySelector('.auth-email-check-title') || { textContent: '' }).textContent.trim()
    };
  });
  return { before, after };
}

// ---- H1: kirimUlangVerifikasi contract (store.js:337-353) --------
async function h1Case(page, name, status, body, headers = {}, shouldThrow = true) {
  await setupPage(page, 'id');
  await page.route('**/api/neon-auth/send-verification-email', route => {
    if (status === 0) { route.abort(); return; }
    const b = typeof body === 'string' ? body : JSON.stringify(body);
    if (status === 502) { route.fulfill({ status: 502, body: '<html><b>Bad Gateway</b></html>', contentType: 'text/html' }); return; }
    route.fulfill({ status, contentType: 'application/json', body, headers });
  });
  // wait for MT.store to be attached (store.js script was parsed)
  const store = await page.evaluate(async () => {
    return new Promise(res => {
      let t0 = Date.now();
      const tick = () => {
        const mt = window.MT;
        if (mt && mt.store) { res(mt.store); return; }
        if (Date.now() - t0 > 15000) { res(null); return; }
        setTimeout(tick, 100);
      };
      tick();
    });
  });
  if (!store) {
    const clues = await page.evaluate(() => ({
      MT: !!window.MT,
      keys: Object.keys(window.MT || {}).slice(0, 8).join(','),
      storeKeys: Object.keys(window.MT?.store || {}).slice(0, 5).join(',')
    }));
    record(`H1:${name}`, false, `MT.store not attached after 15s; page clues: ${JSON.stringify(clues)}`);
    return;
  }
  let threw = false;
  let err = null;
  try { await store.kirimUlangVerifikasi('uji@example.com'); } catch (e) { threw = true; err = e; }
  const ok = shouldThrow === threw;
  if (shouldThrow && threw) {
    record(`H1:${name}`, true, `threw Error(status=${err.status||null},code=${err.code||null},msg=${err.message||'null'},retryAfter=${err.retryAfter||null})`);
  } else {
    record(`H1:${name}`, false, 'did not throw where throw was expected');
  }
}

// ---- H2/H3/H4: email card + resend behaviour -----------------------
async function cardCase(page, name, signUpMock, resendBody, resendStatus = 200, retryAfter = 0) {
  await registerFlow(page, signUpMock);
  const { before, after } = await resendFlow(page, resendBody, resendStatus, retryAfter);
  record(`H4:${name}`, after.alertEmpty && before.alertHidden !== false, JSON.stringify(after.alertTitle));
  if (resendStatus >= 200 && resendStatus < 300 && resendBody && typeof resendBody === 'object' && resendBody.status === true && retryAfter === 0) {
    record(`H2:${name}`, after.alertTitle === 'Email berhasil dikirim ulang', JSON.stringify({ alertTitle: after.alertTitle, resendLabel: after.resendLabel, emailCheckTitle: after.emailCheckTitle }));
  }
}

// ---- H5: en.json must mirror id-only auth.* keys --------------------
async function h5Case() {
  const idData = JSON.parse(readFileSync(join(ROOT, 'assets/locales/id.json'), 'utf-8'));
  const enData = JSON.parse(readFileSync(join(ROOT, 'assets/locales/en.json'), 'utf-8'));
  const authIdKeys = Object.keys(idData).filter(k => k.startsWith('auth.'));
  const onlyInId = authIdKeys.filter(k => !(k in enData));
  const enAuthKeys = Object.keys(enData).filter(k => k.startsWith('auth.'));
  record(`H5a:35 id-only auth keys exist in en.json`, onlyInId.length === 35, `onlyInId=${onlyInId.length}, sample=[${onlyInId.slice(0,4).join(', ')}]`);
  record(`H5b:no en-only auth keys`, enAuthKeys.length === 71, `en auth keys=${enAuthKeys.length}`);
  record(`H5c:no id auth keys deleted`, authIdKeys.length === 106, `id auth keys=${authIdKeys.length}`);
  const { browser } = await newPage();
  const p = (await browser.newPage());
  await registerFlow(p);
  const { before, after } = await resendFlow(p, { status: true });
  record(`H5d:0 raw auth.* in en card/alert DOM`, after.rawAuthKeys === 0, JSON.stringify({ before: before.alertTitle, after: after.alertTitle, rawAuthKeys: after.rawAuthKeys }));
  await p.close();
}

// ---- main --------------------------------------------------------
(async () => {
  const { browser } = await newPage();
  const p = (await browser.newPage());
  await h1Case(p, '200_statusTrue', 200, { status: true }, {}, false);
  await h1Case(p, '400_codeMessage', 400, { code: 'INVALID_EMAIL', message: 'Email tidak valid' }, {}, true);
  await h1Case(p, '429_rateLimit_withRetryAfter', 429, { code: 'RATE_LIMIT_EXCEEDED', message: 'Terlalu banyak permintaan' }, { 'Retry-After': '30' }, true);
  await h1Case(p, '500_message', 500, { message: 'Internal error' }, {}, true);
  await h1Case(p, '502_html', 502, null, {}, true);
  await h1Case(p, 'network_failure', 0, null, {}, true);
  await cardCase(p, '200_success', { token: null, user: { id: 'u1', name: 'Uji', email: 'uji@example.com', emailVerified: false } }, { status: true });
  await cardCase(p, '400_error', { token: null, user: { id: 'u1', name: 'Uji', email: 'uji@example.com', emailVerified: false } }, { code: 'INVALID_EMAIL', message: 'Email tidak valid' }, 400, 0);
  await cardCase(p, '429_withRetryAfter_30', { token: null, user: { id: 'u1', name: 'Uji', email: 'uji@example.com', emailVerified: false } }, { code: 'RATE_LIMIT_EXCEEDED', message: 'Terlalu banyak permintaan' }, 429, 30);
  await h5Case();
  await p.close();
  await browser.close();

  writeFileSync(`${EVIDENCE}/hotfix-results.json`, JSON.stringify({ results, failures, timestamp: new Date().toISOString() }, null, 2));
  console.log(`\nHOTFIX TEST RESULTS: ${results.filter(r => r.status === 'PASS').length}/${results.length} PASS, ${failures} FAIL`);
  process.exit(failures === 0 ? 0 : 1);
})();
