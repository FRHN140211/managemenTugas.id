// tests/ppre-repro.mjs — honest D3/D4 reproduction harness (PROMPT-MASTER L4 4a).
// Matriks: locale {id,en} x viewport {375,1280} x states.
// Force locale via addInitScript; wait for getLocale() AND one translation key (not raw).
// Captures: duplicate email fields (G1), login+forgot overlap (G4/D4), English text,
// raw auth.* keys, pageerror, console errors. Saves tmp-state/evidence/ppre-repro.json.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = `http://localhost:${process.env.PORT || 3000}`;
const results = [];
const ev = { pageerror: [], consoleErr: [], requestfailed: [] };
const browser = await chromium.launch({ headless: true });
for (const locale of ['id', 'en']) {
  for (const vw of [375, 1280]) {
    const context = await browser.newContext({ viewport: { width: vw, height: 800 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.on('pageerror', (e) => ev.pageerror.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') ev.console.push(m.text()); });
    page.on('requestfailed', (r) => ev.requestfailed.push(r.url()));
    // force locale before any script
    await page.addInitScript((loc) => { try { localStorage.setItem('MT.locale', loc); } catch (e) {} }, locale);
    await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    // wait for i18n ready: getLocale + one key translation
    let ready = false;
    for (let i = 0; i < 80; i += 1) {
      ready = await page.evaluate((k) => {
        try {
          const mt = window.MT;
          if (!mt || !mt.i18n || mt.i18n.getLocale() !== loc) return false;
          const v = mt.i18n.t(k);
          return typeof v === 'string' && v !== k && v.length > 1;
        } catch (e) { return false; }
      }, 'auth.login_title');
      if (ready) break;
      await page.waitForTimeout(250);
    }
    if (!ready) { results.push({ locale, viewport: vw, localeReady: false, error: 'locale not ready' }); await context.close(); continue; }
    // ---- mode switches ----
    const formState = async () => page.evaluate(() => {
      const form = document.getElementById('auth-form');
      const emails = (form ? form.querySelectorAll('input[type="email"]') : []).length;
      const inputs = form ? form.querySelectorAll('input').length : 0;
      const buttons = form ? Array.from(form.querySelectorAll('button')).map(b => b.textContent.trim()) : [];
      return { emailInputs: emails, inputs, buttonCount: buttons.length, buttons: buttons.slice(0, 8) };
    });
    // register mode (click Daftar akun)
    await page.click('button:has-text("Daftar akun")');
    await page.waitForTimeout(600);
    const reg = await formState();
    // forgot mode (click Lupa kata sandi?)
    await page.click('button:has-text("Lupa kata sandi?")');
    await page.waitForTimeout(600);
    const forgot = await formState();
    // login mode again (click Masuk button or toggle)
    await page.click('button:has-text("Masuk")');
    await page.waitForTimeout(600);
    const login2 = await formState();
    // register mode once more (direct switch test)
    await page.click('button:has-text("Daftar akun")');
    await page.waitForTimeout(600);
    const reg2 = await formState();
    // raw auth.* check in DOM + English text seeds
    const rawcheck = await page.evaluate(() => {
      const html = document.body.innerHTML;
      const raw = [...html.matchAll(/auth\.\w+/g)].map(m => m[0]).filter((v, i, a) => a.indexOf(v) === i);
      return {
        rawAuthKeys: [...new Set(raw)],
        undefinedInHtml: /undefined/.test(html),
        rawObj: /\[object Object\]/.test(html),
        hasEnglishText: /Create account|Already have an account|Sign in/i.test(document.body.textContent || '')
      };
    });
    results.push({ locale, viewport: vw, i18nReady: true, registerMode: reg, forgotMode: forgot, loginMode2: login2, registerMode2: reg2, rawcheck });
    await context.close();
  }
}
await browser.close();
const out = { timestamp: new Date().toISOString(), matrix: results };
require('fs').writeFileSync(join(ROOT, 'tmp-state/evidence/ppre-repro.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
process.exit(0);
