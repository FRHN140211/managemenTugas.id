import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ extraHTTPHeaders: { Origin: 'http://localhost:3000' } });
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', err => errors.push('PAGEERROR: ' + err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push('CONSOLE_ERROR: ' + msg.text());
    if (msg.type() === 'warning') errors.push('CONSOLE_WARN: ' + msg.text());
  });
  page.on('unhandledrejection', err => errors.push('UNHANDLED_REJECTION: ' + (err.message || err)));

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

  const result = await page.evaluate(() => {
    // Check if the store.registrasi function exists and works
    return new Promise((resolve) => {
      MT.store.registrasi('test', 'test-' + Date.now() + '@example.com', 'TestPass123!')
        .then(res => resolve({ storeResult: res }))
        .catch(err => resolve({ storeError: err.message, code: err.code }));
    });
  });

  console.log('STORE TEST:', JSON.stringify(result, null, 2));
  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  await browser.close();
})();
