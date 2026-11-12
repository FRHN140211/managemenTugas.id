import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ extraHTTPHeaders: { Origin: 'http://localhost:3000' } });
  const page = await context.newPage();

  const out = {
    pageErrors: [],
    consoleLogs: [],
    requests: [],
    responses: [],
    alertTitle: '',
    alertMessage: '',
    otpModeShown: false
  };

  page.on('pageerror', err => out.pageErrors.push(err.message));
  page.on('console', msg => out.consoleLogs.push(msg.type() + ': ' + msg.text()));
  page.on('request', request => {
    if (request.url().includes('/api/')) {
      out.requests.push({ url: request.url(), method: request.method() });
    }
  });
  page.on('response', async (response) => {
    if (response.url().includes('/api/')) {
      try {
        const body = await response.json();
        out.responses.push({ url: response.url(), status: response.status(), body });
      } catch (e) {
        out.responses.push({ url: response.url(), status: response.status(), error: 'parse failed' });
      }
    }
  });

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

  await page.click('[data-auth-mode-toggle]');
  await page.waitForTimeout(500);

  const testEmail = 'otp-test-' + Date.now() + '@example.com';
  await page.fill('#auth-name', 'OTP Test User');
  await page.fill('#auth-email', testEmail);
  await page.fill('#auth-password', 'TestPass123!');
  await page.fill('#auth-password-confirm', 'TestPass123!');

  await page.click('#auth-submit');
  await page.waitForTimeout(4000);

  out.alertTitle = await page.evaluate(() => {
    const el = document.querySelector('[data-auth-alert-title]');
    return el ? el.textContent : '';
  });
  out.alertMessage = await page.evaluate(() => {
    const el = document.querySelector('[data-auth-alert-message]');
    return el ? el.textContent : '';
  });
  out.otpModeShown = await page.isVisible('[data-auth-field="verifikasi-otp"]');

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
