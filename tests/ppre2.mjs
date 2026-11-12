// tests/ppre2.mjs — honest D3/D4 reproduction, 4 scenarios (id/en x 375/1280), 5 states each.
// Force locale via addInitScript; wait getLocale() + one translated key. Captures raw DOM.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = `http://localhost:${process.env.PORT || 3000}`;
const results = [];
const ev = { pageerror: [], console: [], requestfailed: [] };
const browser = await chromium.launch({ headless: true });
for (const locale of ['id', 'en']) {
  for (const vw of [375, 1280]) {
    const context = await browser.newContext({ viewport: { width: vw, height: 800 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.on('pageerror', (e) => ev.pageerror.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') ev.console.push(m.text()); });
    page.on('requestfailed', (r) => ev.requestfailed.push(r.url()));
    await page.addInitScript((loc) => { try { localStorage.setItem('MT.locale', loc); } catch (e) {} }, locale);
    await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    let ready = false;
    for (let i = 0; i < 80; i += 1) {
      ready = await page.evaluate(([loc, k]) => {
        try {
          const mt = window.MT;
          if (!mt || !mt.i18n || mt.i18n.getLocale() !== loc) return false;
          const v = mt.i18n.t(k);
          return typeof v === 'string' && v !== k && v.length > 1;
        } catch (e) { return false; }
      }, [locale, 'auth.login_title']);
      if (ready) break;
      await page.waitForTimeout(250);
    }
    if (!ready) { results.push({ locale, viewport: vw, i18nReady: false, error: 'locale not ready' }); await context.close(); continue; }
    const buttons = await page.$$('[data-secondary-action]');
    const btn = async (act) => {
      for (const b of buttons) {
        const t = await page.evaluate((el) => el.textContent.trim(), b);
        const a = await page.evaluate((el) => el.dataset.secondaryAction, b);
        if (a === act) return b;
      }
      return null;
    };
    const formState = async () => page.evaluate(() => {
      const form = document.getElementById('auth-form');
      const emails = (form ? form.querySelectorAll('input[type="email"]') : []).length;
      const inputs = form ? form.querySelectorAll('input').length : 0;
      const fields = (form ? form.querySelectorAll('[data-auth-field]') : []).map(f => f.dataset.authField) || [];
      return { emailInputs: emails, inputs, fields: fields.slice(0, 8) };
    });
    // S2: switch to register
    await page.click('[data-secondary-action="register"]');
    await page.waitForTimeout(600);
    const reg = await formState();
    // S3: switch to forgot
    await page.click('[data-secondary-action="forgot"]');
    await page.waitForTimeout(600);
    const forgot = await formState();
    // S4: back to login
    await page.click('[data-secondary-action="login"]');
    await page.waitForTimeout(600);
    const login2 = await formState();
    // S5: raw auth.* check in DOM + English text seeds
    const rawcheck = await page.evaluate(() => {
      const html = document.body.innerHTML;
      const raw = [...html.matchAll(/auth\.\w+/g)].map(m => m[0]).filter((v, i, a) => a.indexOf(v) === i);
      return { rawAuthKeys: [...new Set(raw)], undefinedInHtml: /undefined/.test(html), rawObj: /\[object Object\]/.test(html), hasEnglishText: /Create account|Already have an account|Sign in/i.test(document.body.textContent || '') };
    });
    results.push({ locale, viewport: vw, i18nReady: true, registerMode: reg, forgotMode: forgot, loginMode2: login2, registerMode2: reg2, rawcheck });
    await context.close();
  }
}
await browser.close();
import { writeFileSync } from 'fs';
const out = { timestamp: new Date().toISOString(), matrix: results };
writeFileSync(join(ROOT, 'tmp-state/evidence/ppre2-results.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
process.exit(0);
