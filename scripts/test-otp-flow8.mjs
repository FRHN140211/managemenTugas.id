import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ extraHTTPHeaders: { Origin: 'http://localhost:3000' } });
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text());
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

  const result = await page.evaluate(() => {
    const alertTitle = document.querySelector('[data-auth-alert-title]');
    const otpField = document.querySelector('[data-auth-field="verifikasi-otp"]');
    const submitBtn = document.getElementById('auth-submit');
    
    return {
      alertTitle: alertTitle ? alertTitle.textContent : 'NOT FOUND',
      otpExists: !!otpField,
      otpHidden: otpField ? otpField.hidden : 'N/A',
      submitText: submitBtn ? submitBtn.textContent.trim() : 'NOT FOUND'
    };
  });

  console.log('RESULT:', JSON.stringify(result, null, 2));
  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  await browser.close();
})();
