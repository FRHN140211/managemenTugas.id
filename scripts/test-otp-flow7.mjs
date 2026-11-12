import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ extraHTTPHeaders: { Origin: 'http://localhost:3000' } });
  const page = await context.newPage();

  // Catch all unhandled errors
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));
  
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

  // Intercept the form submission and add logging
  await page.evaluate(() => {
    const form = document.getElementById('auth-form');
    const originalSubmit = form.onsubmit;
    form.addEventListener('submit', function(e) {
      console.log('FORM SUBMIT');
    });
  });

  await page.click('[data-auth-mode-toggle]');
  await page.waitForTimeout(500);

  const testEmail = 'otp-test-' + Date.now() + '@example.com';
  await page.fill('#auth-name', 'OTP Test User');
  await page.fill('#auth-email', testEmail);
  await page.fill('#auth-password', 'TestPass123!');
  await page.fill('#auth-password-confirm', 'TestPass123!');

  // Click submit and wait
  await page.click('#auth-submit');
  await page.waitForTimeout(4000);

  const result = await page.evaluate(() => {
    const alertTitle = document.querySelector('[data-auth-alert-title]');
    const alertMessage = document.querySelector('[data-auth-alert-message]');
    const otpField = document.querySelector('[data-auth-field="verifikasi-otp"]');
    const submitBtn = document.getElementById('auth-submit');
    
    return {
      alertTitle: alertTitle ? alertTitle.textContent : '',
      alertMessage: alertMessage ? alertMessage.textContent : '',
      otpHidden: otpField ? otpField.hidden : 'not found',
      submitDisabled: submitBtn ? submitBtn.disabled : 'not found',
      submitText: submitBtn ? submitBtn.textContent : 'not found'
    };
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
