import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ extraHTTPHeaders: { Origin: 'http://localhost:3000' } });
  const page = await context.newPage();

  const out = {
    pageErrors: [],
    consoleLogs: [],
    registrationResponse: null,
    alertTitle: '',
    alertMessage: '',
    otpModeShown: false
  };

  page.on('pageerror', err => out.pageErrors.push(err.message));
  page.on('console', msg => out.consoleLogs.push(msg.type() + ': ' + msg.text()));

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

  // Get the last 10 console logs
  out.consoleLogs = out.consoleLogs.slice(-10);

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
