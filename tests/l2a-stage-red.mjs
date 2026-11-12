// tests/l2a-stage-red.mjs
// L2: D2 undefined-identifier reproduction on a READ-ONLY staged copy of the code.
// Usage: node tests/l2a-stage-red.mjs <docroot>
//   <docroot> = full app tree with OLD pre-fix views-auth.js/store.js  -> EXPECT FAIL
//              <docroot> = live app tree (fixed)                    -> EXPECT PASS
// The server is an in-process read-only http.createServer (no child_process),
// mock proxy routes via page.route, serviceWorkers: 'block', waits for MT.i18n.init.
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync, createReadStream } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const docroot = process.argv[2];
if (!docroot) { console.error('usage: node l2a-stage-red.mjs <docroot>'); process.exit(2); }
if (!existsSync(join(docroot, 'assets'))) { console.error('docroot missing assets/'); process.exit(2); }

// ---- in-process read-only static server (port 0 -> assigned) ------------
const types = { '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8' };
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const file = join(docroot, urlPath.replace(/^\/+/, ''));
  if (!file.startsWith(docroot) || !existsSync(file)) { res.writeHead(404); res.end('NF'); return; }
  res.writeHead(200, { 'Content-Type': types[extname(file).toLowerCase()] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
server.listen(0, async () => {
  const port = server.address().port;
  const BASE = `http://localhost:${port}`;
  console.log(`[stage] docroot=${docroot} PORT=${port}`);

  // ---- harness ---------------------------------------------------------
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ extraHTTPHeaders: { Origin: BASE.replace('http://', 'http://') } , serviceWorkers: 'block' });
  const page = await context.newPage();
  const ev = { console: [], pageerror: [], requestfailed: [] };
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') ev.console.push('[' + m.type() + '] ' + m.text()); });
  page.on('pageerror', (e) => ev.pageerror.push(String(e)));
  page.on('requestfailed', (r) => ev.requestfailed.push(r.url() + ' ' + r.failure().errorText));

  const idJson = readFileSync(join(docroot, 'assets', 'locales', 'id.json'), 'utf-8');
  const enJson = readFileSync(join(docroot, 'assets', 'locales', 'en.json'), 'utf-8');
  await page.route('**/*.json', async (route) => {
    const u = route.request().url();
    if (u.includes('id.json')) { await route.fulfill({ status: 200, contentType: 'application/json', body: idJson }); return; }
    if (u.includes('en.json')) { await route.fulfill({ status: 200, contentType: 'application/json', body: enJson }); return; }
    await route.continue();
  });

  async function doRegister(email) {
    const toggle = await page.$('button:has-text("Daftar akun")');
    if (toggle) await toggle.click();
    await page.waitForTimeout(300);
    await page.fill('#auth-name', 'Test User');
    await page.fill('#auth-email', email);
    await page.fill('#auth-password', 'SuperSecret1');
    await page.click('button#auth-submit');
    await page.waitForTimeout(1800);
  }

  async function mockSignUp(body) {
    await page.unroute('**/api/neon-auth/sign-up/email');
    await page.route('**/api/neon-auth/sign-up/email', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }));
  }

  async function cardState() {
    return page.evaluate(() => {
      const card = document.getElementById('auth-email-check');
      const email = document.getElementById('auth-email-check-email');
      const alert = document.getElementById('auth-alert');
      return {
        cardVisible: !!(card && !card.hidden),
        emailShown: email ? email.textContent : null,
        cardTitle: card ? card.querySelector('.auth-email-check-title')?.textContent : null,
        alertTitle: alert ? alert.textContent : '',
        alertHidden: alert ? alert.hidden : null,
        rawObj: /\[object Object\]/.test(document.body.innerHTML),
        undefinedInHtml: /undefined/.test(document.body.innerHTML)
      };
    });
  }

  // ---- flow -------------------------------------------------------------
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  for (let i = 0; i < 60; i += 1) {
    const ok = await page.evaluate(() => MT && MT.i18n && MT.i18n.getLocale() === 'id');
    if (ok) break;
    await page.waitForTimeout(250);
  }
  await doRegister('undef-stage@example.com');
  await mockSignUp({ token: null, user: { name: 'Test', email: 'undef-stage@example.com', emailVerified: false } });
  await doRegister('undef-stage2@example.com');
  const c1 = await cardState();
  const passUndef = ev.pageerror.length === 0 && c1.cardVisible === true && c1.alertHidden === true && c1.alertTitle === '' && !c1.rawObj && !c1.undefinedInHtml;
  console.log(`[stage] locale id : pageerror=${ev.pageerror.length} cardVisible=${c1.cardVisible} alertHidden=${c1.alertHidden} alertTitle=${JSON.stringify(c1.alertTitle)} rawObj=${c1.rawObj} undefinedHtml=${c1.undefinedInHtml} -> ${passUndef ? 'PASS' : 'FAIL'}`);
  for (const p of ev.pageerror) console.log('[stage]   pageerror:', p);

  await page.evaluate(() => MT.i18n.setLocale('en'));
  for (let i = 0; i < 60; i += 1) {
    const ok = await page.evaluate(() => MT && MT.i18n && MT.i18n.getLocale() === 'en');
    if (ok) break;
    await page.waitForTimeout(250);
  }
  await doRegister('undef-stage3@example.com');
  await mockSignUp({ token: null, user: { name: 'Test', email: 'undef-stage3@example.com', emailVerified: false } });
  await doRegister('undef-stage4@example.com');
  const c2 = await cardState();
  const passEn = ev.pageerror.length === 0 && c2.cardVisible === true && c2.cardTitle === 'Check your email';
  console.log(`[stage] locale en : pageerror=${ev.pageerror.length} cardVisible=${c2.cardVisible} cardTitle=${JSON.stringify(c2.cardTitle)} -> ${passEn ? 'PASS' : 'FAIL'}`);
  for (const p of ev.pageerror) console.log('[stage]   pageerror:', p);

  // ---- summary ----------------------------------------------------------
  const fails = (ev.pageerror.length > 0) || !passUndef || !passEn;
  console.log(`
=== L2a STAGE RED RESULT: ${fails ? 'FAIL (D2 reproduced)' : 'PASS (no undefined identifiers)'} ===`);
  await browser.close();
  server.close();
  process.exit(fails ? 1 : 0);
});
